import { Command } from 'jsr:@cliffy/command@1.0.0';
import { walk } from 'jsr:@std/fs@0.224.0';
import { join, basename, extname, relative } from 'jsr:@std/path@0.224.0';
import { DB } from 'https://deno.land/x/sqlite/mod.ts';
import { parse } from 'https://deno.land/std@0.224.0/csv/mod.ts';
import { fetchRecords as fetchGristRecords } from "https://raw.githubusercontent.com/sherlock-iremus/sherlock-deno/refs/heads/main/common-grist.ts";
import { addFileRecordsToGrist, addRunRecordToGrist, getMD5FromFile, getRunName } from './utils.ts';

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

const { repo, inputRegex } = options;
const tool = 'CSV to SQLite';

if (!inputRegex) {
  console.error('Missing required argument --input-regex');
  Deno.exit(1);
}

let re: RegExp;
try {
  re = new RegExp(inputRegex);
} catch (e) {
  console.error('Invalid input-regex:', e.message || e);
  Deno.exit(1);
}

const matchedCsvPaths: string[] = [];
for await (const entry of walk(repo)) {
  if (!entry.isFile) continue;
  const relPath = relative(repo, entry.path);
  if (re.test(entry.path) || re.test(relPath)) {
    if (extname(entry.path).toLowerCase() === '.csv') {
      matchedCsvPaths.push(entry.path);
      console.log(`Found CSV: ${relPath}`);
    }
  }
}

if (matchedCsvPaths.length === 0) {
  console.error(`No CSV files found matching regex: ${inputRegex}`);
  Deno.exit(1);
}

const outDir = join(repo, '/dat', getRunName(options.runName, tool));
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

for (const csvPath of matchedCsvPaths) {
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

const collectionRecords: CollectionRecord[] = await fetchGristRecords(
  options.gristBase,
  options.gristApiKey,
  options.gristDocId,
  options.gristCollectionTableId
);
const existingCollectionId = collectionRecords.find(r => r.fields.UUID === options.collectionUuid)?.id;
if (!existingCollectionId) {
  console.error(`Could not find collection in Grist with UUID ${options.collectionUuid}`);
  Deno.exit(1);
}

const inputFileIds: number[] = [];
try {
  const rawFileRecords: RawRecord[] = await fetchGristRecords(
    options.gristBase,
    options.gristApiKey,
    options.gristDocId,
    options.gristFilesTableId
  );

  for (const csvPath of matchedCsvPaths) {
    try {
      const md5 = await getMD5FromFile(csvPath);
      const matching = rawFileRecords.find(r => r?.fields?.MD5 === md5);
      if (matching?.id) inputFileIds.push(matching.id);
    } catch (_e) {
      console.warn(`Could not hash CSV file for Grist linking: ${csvPath}`);
    }
  }
} catch (_e) {
  console.warn('Could not resolve input CSV files in Grist. Run will still be recorded.');
}

const runRecordId = await addRunRecordToGrist(options, existingCollectionId, tool, options.runName, inputFileIds, null, JSON.stringify({
  inputRegex,
  matchedCsvCount: matchedCsvPaths.length,
  outputDbCount: outputPaths.length,
}));

if (!runRecordId) {
  console.error('Could not create run record in Grist');
  Deno.exit(1);
}

addFileRecordsToGrist(options, existingCollectionId, runRecordId, 'dat', outputPaths);
