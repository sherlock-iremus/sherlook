import { Command } from 'jsr:@cliffy/command@1.0.0';
import { join, basename, extname, relative } from 'jsr:@std/path@0.224.0';
import { DB } from 'https://deno.land/x/sqlite/mod.ts';
import { parse } from 'https://deno.land/std@0.224.0/csv/mod.ts';
import { addFileRecordsToGrist, addRunRecordToGrist, getCorrespondingCollectionId, getCorrespondingRunId, getFilesMatchingRegex, getGristIdsByMatchedFiles, getMD5FromFile, getRunName, getScriptDefinition, logScriptEnd, logScriptStart, SCRIPT_TYPE, ScriptDefinition } from './utils.ts';
import { DAT_FOLDER_PATH } from './consts.ts';

const { options } = await new Command()
  .name('SHERLOOK 3.1.4')
  .description('Find CSV files by regex and convert them to SQLite using headers')
  .option('--repo <repo:string>', '')
  .option('--collection-uuid <collection-uuid:string>', '')
  .option('--grist-api-key <grist-api-key:string>', '')
  .option('--grist-base <grist-base:string>', '')
  .option('--grist-doc-id <grist-doc-id:string>', '')
  .option('--grist-files-table-id <grist-files-table-id:string>', '')
  .option('--grist-run-table-id <grist-run-table-id:string>', '')
  .option('--grist-collection-table-id <grist-collection-table-id:string>', '')
  .option('--run-name <run-name:string>', '')
  .option('--input-regex <input-regex:string>', '')
  .parse();

const { repo, collectionUuid, inputRegex } = options;
const scriptDefiniton: ScriptDefinition = getScriptDefinition(
    "CSV to SQLite",
    SCRIPT_TYPE.determinist,
    options.runName,
    DAT_FOLDER_PATH,
    DAT_FOLDER_PATH
);

logScriptStart(scriptDefiniton);
const collectionRecordId = await getCorrespondingCollectionId(options, collectionUuid);
const existingRunId = await getCorrespondingRunId(options, collectionRecordId, scriptDefiniton.runName);


const matches = await getFilesMatchingRegex(repo, inputRegex);

const outDir = join(repo, scriptDefiniton.outputFolder);
try { await Deno.mkdir(outDir, { recursive: true }); } catch (_) { /* ignore if already exists */ }

const outputPaths: string[] = [];

const existingNames = new Set<string>();
const makeUniqueName = (base: string) => {
  let name = base;
  let count = 1;
  while (existingNames.has(name)) {
    name = `${base}_${count}`;
    count += 1;
  }
  existingNames.add(name);
  return name;
};

for (const csvPath of matches) {
  const csvText = await Deno.readTextFile(csvPath);
  const rows = await parse(csvText, { skipFirstRow: false, trimLeadingSpace: true }) as Array<string[]>;

  if (rows.length === 0) {
    console.warn(`Skipping empty CSV: ${csvPath}`);
    continue;
  }

  const headers = rows[0].map((header) => header.trim());
  if (headers.length === 0) {
    console.warn(`Skipping CSV with no headers: ${csvPath}`);
    continue;
  }

  const tableName = basename(csvPath, extname(csvPath)).replace(/[^a-zA-Z0-9_]/g, '_') || 'data';
  const sanitizedColumns = headers.map((header) => {
    const name = header.trim() || 'column';
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
  });

  const outputName = makeUniqueName(`${basename(csvPath, extname(csvPath))}.sqlite`);
  const outputDbPath = join(outDir, outputName);

  const db = new DB(outputDbPath);
  try {
    const createCols = sanitizedColumns.map((col) => `"${col}" TEXT`).join(', ');
    db.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (${createCols})`);

    const placeholders = sanitizedColumns.map(() => '?').join(', ');
    const insertStmt = db.prepareQuery(`INSERT INTO "${tableName}" (${sanitizedColumns.map((col) => `"${col}"`).join(', ')}) VALUES (${placeholders})`);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const normalized = sanitizedColumns.map((_, index) => row[index] ?? '');
      insertStmt.execute(normalized);
    }

    insertStmt.finalize();
  } finally {
    db.close();
  }

  outputPaths.push(outputDbPath);
  console.log(`Created SQLite database at ${outputDbPath}`);
}

if (outputPaths.length === 0) {
  console.error('No SQLite databases were created. Exiting.');
  Deno.exit(1);
}

const inputFileIds = await getGristIdsByMatchedFiles(options, matches);
const runRecordId = await addRunRecordToGrist(options, collectionRecordId, scriptDefiniton.toolName, scriptDefiniton.runName, inputFileIds, null, JSON.stringify({
  inputRegex,
  matchedCsvCount: matches.length,
  outputDbCount: outputPaths.length,
}), existingRunId);

addFileRecordsToGrist(options, collectionRecordId, runRecordId, 'dat', outputPaths);
logScriptEnd(scriptDefiniton, runRecordId);
