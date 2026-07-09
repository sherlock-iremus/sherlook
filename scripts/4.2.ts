import { Command } from 'jsr:@cliffy/command@1.0.0';
import { addFileRecordsToGrist, addRunRecordToGrist, getCorrespondingCollectionId, getCorrespondingRunId, getFilesMatchingRegex, getGristIdsByMatchedFiles, getMD5FromFile, getRunName, getScriptDefinition, logScriptStart, SCRIPT_TYPE, ScriptDefinition } from './utils.ts';
import { join, relative } from 'jsr:@std/path@0.224.0';
import { DB } from 'https://deno.land/x/sqlite/mod.ts';
import { DAT_FOLDER_PATH, ANA_FOLDER_PATH } from './consts.ts';

const { options } = await new Command()
  .name('SHERLOOK 4.2')
  .description('Query SQLite databases via Albert')
  .option('--repo <repo:string>', '')
  .option('--collection-uuid <collection-uuid:string>', '')
  .option('--grist-api-key <grist-api-key:string>', '')
  .option('--grist-base <grist-base:string>', '')
  .option('--grist-doc-id <grist-doc-id:string>', '')
  .option('--grist-files-table-id <grist-files-table-id:string>', '')
  .option('--grist-run-table-id <grist-run-table-id:string>', '')
  .option('--grist-collection-table-id <grist-collection-table-id:string>', '')
  .option('--run-name <run-name:string>', '')
  .option('--prompt <prompt:string>', '')
  .option('--albert-base <albert-base:string>', '')
  .option('--albert-api-key <albert-api-key:string>', '')
  .option('--input-files-regex <input-files-regex:string>', '')
  .parse();

const { repo, prompt, albertBase, albertApiKey, inputFilesRegex, collectionUuid } = options;

const scriptDefiniton: ScriptDefinition = getScriptDefinition(
    "Albert SQLite Query",
    SCRIPT_TYPE.indeterministic,
    options.runName,
    DAT_FOLDER_PATH,
    ANA_FOLDER_PATH
);

logScriptStart(scriptDefiniton);
const collectionRecordId = await getCorrespondingCollectionId(options, collectionUuid);
const existingRunId = await getCorrespondingRunId(options, collectionRecordId, scriptDefiniton.runName);

console.log('🔍 Step 1: Searching for SQLite files matching regex...');

const matchedDbFiles = await getFilesMatchingRegex(repo, inputFilesRegex);

console.log(`\n🔍 Step 2: Analyzing database schema...`);

interface SchemaInfo {
  tables: Array<{ name: string; sql: string; samples: Array<Record<string, unknown>> }>;
}

const schemaInfo: SchemaInfo = { tables: [] };

for (const dbPath of matchedDbFiles) {
  console.log(`  📂 Opening ${relative(repo, dbPath)}...`);
  const db = new DB(dbPath);
  try {
    const tableResults = db.query(`SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
    for (const [tableName, createSql] of tableResults as Array<[string, string]>) {
      console.log(`    📋 Table: ${tableName}`);
      const samples = db.query(`SELECT * FROM "${tableName}" LIMIT 10`) as Array<Record<string, unknown>>;
      schemaInfo.tables.push({
        name: tableName,
        sql: createSql,
        samples: samples
      });
    }
  } finally {
    db.close();
  }
}

if (schemaInfo.tables.length === 0) {
  console.error('❌ No tables found in SQLite database');
  Deno.exit(1);
}

console.log(`\n🤖 Step 3: Sending schema to Albert for SQL query generation...`);

const schemaContext = schemaInfo.tables
  .map(table => `Table: ${table.name}\nSchema: ${table.sql}\nSample rows:\n${JSON.stringify(table.samples, null, 2)}`)
  .join('\n\n');

const albertQueryPrompt = `Voici le schéma d'une base de données SQLite:\n\n${schemaContext}\n\nQuestion de l'utilisateur: ${prompt}\n\nGénère une requête SQL qui répond à cette question. Retourne UNIQUEMENT la requête SQL, sans explication, sans backquotes ni mention du language de programmation.`;

const queryRes = await fetch(`${albertBase}v1/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${albertApiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
    messages: [
      {
        role: 'user',
        content: albertQueryPrompt
      }
    ]
  })
});

const queryData = await queryRes.json();
if (!queryData.choices || queryData.choices.length === 0) {
  console.error('❌ Albert API error (query generation):', JSON.stringify(queryData));
  Deno.exit(1);
}

const generatedSql = queryData.choices[0].message.content.trim();
console.log(`  ✓ Generated SQL: ${generatedSql}`);

console.log(`\n⚙️  Step 4: Executing SQL query against database...`);

let queryResults: Array<Record<string, unknown>> = [];
let executionError: string | null = null;

for (const dbPath of matchedDbFiles) {
  const db = new DB(dbPath);
  try {
    queryResults = db.query(generatedSql) as Array<Record<string, unknown>>;
    console.log(`  ✓ Query executed successfully. Got ${queryResults.length} rows.`);
    db.close();
    break;
  } catch (e) {
    executionError = String(e);
    console.warn(`  ⚠️  Query failed on ${relative(repo, dbPath)}: ${e}`);
    db.close();
  }
}

if (executionError && queryResults.length === 0) {
  console.error('❌ Could not execute SQL query on any database');
  Deno.exit(1);
}

console.log(`\n🤖 Step 5: Sending results to Albert for formatting and summary...`);

const albertSummaryPrompt = `Voici les résultats d'une requête SQL en réponse à la question: "${prompt}"\n\nRésultats:\n${JSON.stringify(queryResults, null, 2)}\n\nFormate et résume ces résultats de manière claire et concise pour l'utilisateur.`;

const summaryRes = await fetch(`${albertBase}v1/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${albertApiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
    messages: [
      {
        role: 'user',
        content: albertSummaryPrompt
      }
    ]
  })
});

const summaryData = await summaryRes.json();
if (!summaryData.choices || summaryData.choices.length === 0) {
  console.error('❌ Albert API error (summary):', JSON.stringify(summaryData));
  Deno.exit(1);
}

const finalSummary = summaryData.choices[0].message.content;
console.log(`\n📝 Final Summary:\n${finalSummary}`);

const outDir = join(repo, scriptDefiniton.outputFolder);
try { await Deno.mkdir(outDir, { recursive: true }); } catch (_) { /* ignore */ }

const outputLog = `Query: ${generatedSql}\n\nResults (${queryResults.length} rows):\n${JSON.stringify(queryResults, null, 2)}\n\nSummary:\n${finalSummary}`;
await Deno.writeTextFile(join(outDir, 'response.txt'), outputLog);
await Deno.writeTextFile(join(outDir, 'query.sql'), generatedSql);
await Deno.writeTextFile(join(outDir, 'results.json'), JSON.stringify(queryResults, null, 2));

console.log(`\n✅ Step 6: Saving results...`);
console.log(`  📄 Saved to: ${outDir}`);

const inputFileIds = await getGristIdsByMatchedFiles(options, matchedDbFiles);

console.log(`\n🗂️  Step 7: Recording run in Grist...`);

const runRecordId = await addRunRecordToGrist(options, collectionRecordId, scriptDefiniton.toolName, scriptDefiniton.runName, inputFileIds, finalSummary, JSON.stringify({
  prompt,
  inputRegex: inputFilesRegex,
  generatedSql,
  rowsReturned: queryResults.length
}), existingRunId);

await addFileRecordsToGrist(options, collectionRecordId, runRecordId, 'ana', [
  join(outDir, 'response.txt'),
  join(outDir, 'query.sql'),
  join(outDir, 'results.json')
]);

console.log(`\n✅ Done!`);