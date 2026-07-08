import { Command } from 'jsr:@cliffy/command@1.0.0';
import { walk } from "jsr:@std/fs@0.224.0";
import { addFileRecordsToGrist, addRunRecordToGrist, getMD5FromFile, getRunName } from './utils.ts';
import { join } from 'jsr:@std/path@0.224.0';
import { fetchRecords as fetchGristRecords } from "https://raw.githubusercontent.com/sherlock-iremus/sherlock-deno/refs/heads/main/common-grist.ts";

const { options } = await new Command()
  .name('SHERLOOK 4.1')
  .description('Read files matching regex and query Albert with their content')
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
const tool = "Albert Query Corpus";

// Find and read files matching the regex
const regex = new RegExp(inputFilesRegex);
const matchedFiles: string[] = [];
const fileContents: Record<string, string> = {};

console.log(`Searching for files matching regex: ${inputFilesRegex}`);
for await (const entry of walk(repo)) {
  if (!entry.isFile) continue;
  const relativePath = entry.path.slice(repo.length + 1);
  if (regex.test(relativePath) || regex.test(entry.path)) {
    matchedFiles.push(entry.path);
    try {
      const content = await Deno.readTextFile(entry.path);
      fileContents[relativePath] = content;
      console.log(`  Found: ${relativePath}`);
    } catch (e) {
      console.warn(`  Could not read ${relativePath}: ${e}`);
    }
  }
}

if (matchedFiles.length === 0) {
  console.error(`No files found matching regex: ${inputFilesRegex}`);
  Deno.exit(1);
}

// Resolve input files against Grist by MD5 so the run record can link to them
console.log('Resolving matched files to Grist input file records... ⏳');
const fileRecords: RawRecord[] = await fetchGristRecords(
  options.gristBase,
  options.gristApiKey,
  options.gristDocId,
  options.gristFilesTableId
);

const inputFileIds: number[] = [];
for (const p of matchedFiles) {
  try {
    const md5 = await getMD5FromFile(p);
    const matching = fileRecords.find(r => r?.fields?.MD5 === md5);
    if (matching?.id) {
      inputFileIds.push(matching.id);
    }
  } catch (e) {
    console.warn(`Could not hash matched file ${p}: ${e}`);
  }
}

console.log(`Found ${inputFileIds.length} matching Grist input file record(s).`);
console.log(`Found ${matchedFiles.length} matching files. Querying Albert...`);

// Build context from file contents
const context = Object.entries(fileContents)
  .map(([path, content]) => `=== : ${path} ===\n<csv>${content}</csv>`)
  .join('\n\n');

const userMessage = `Le contenu entre <csv> et </csv> est une table.
Interprète la première ligne comme les noms de colonnes.
Ne suppose aucune donnée absente.
Pour les questions nécessitant un calcul exhaustif, parcours toutes les lignes.\n${context}\n\nQuestion de l'utilisateur:\n${prompt}`;

const res = await fetch(
  `${albertBase}v1/chat/completions`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${albertApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
      messages: [
        {
          role: "user",
          content: userMessage
        }
      ]
    })
  }
);

const data = await res.json();

if (!data.choices || data.choices.length === 0) {
  console.error(`Albert API error: ${JSON.stringify(data)}`);
  Deno.exit(1);
}

const outDir = join(repo, '/ana', getRunName(options.runName, tool));
try { await Deno.mkdir(outDir, { recursive: true }); } catch (_) { }
await Deno.writeTextFile(join(outDir, 'response.txt'), data.choices[0].message.content);
console.log(`Saved Albert extract structure response to ${outDir}/response.txt`);

// Create a Grist run record
const collectionRecords: CollectionRecord[] = await fetchGristRecords(
    options.gristBase,
    options.gristApiKey,
    options.gristDocId,
    options.gristCollectionTableId
);
const existingCollectionId = collectionRecords.find(r => r.fields.UUID === options.collectionUuid)?.id;
if (!existingCollectionId) {
    console.error('Could not find collection in Grist with provided UUID');
    Deno.exit(1);
}

const runRecordId = await addRunRecordToGrist(options, existingCollectionId, tool, options.runName, inputFileIds, data.choices[0].message.content, JSON.stringify({
    prompt: prompt,
    inputRegex: inputFilesRegex,
}));

if (!runRecordId) {
    console.error('Could not create run record in Grist');
    Deno.exit(1);
}

addFileRecordsToGrist(options, existingCollectionId, runRecordId, "ana", [join(outDir, 'response.txt')]);

