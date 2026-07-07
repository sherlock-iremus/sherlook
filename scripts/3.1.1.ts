import { Command } from 'jsr:@cliffy/command@1.0.0';
import { walk } from 'jsr:@std/fs@0.224.0';
import { join, basename } from 'jsr:@std/path@0.224.0';
import { fetchRecords as fetchGristRecords } from "https://raw.githubusercontent.com/sherlock-iremus/sherlock-deno/refs/heads/main/common-grist.ts";
import { addRunRecordToGrist, getMD5FromFile, getRunName, getMimeTypeByPath } from './utils.ts';

const { options } = await new Command()
  .name('SHERLOOK 3.1.1')
  .description('Iterate files matching input regex under repo and print matches')
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
  .option('--albert-base <albert-base:string>', '')
  .option('--albert-api-key <albert-api-key:string>', '')
  .parse();

const { repo, inputRegex } = options;
const { albertBase, albertApiKey } = options;
const tool = "Albert Collection Ingestion";
let re: RegExp | null = null;
if (inputRegex) {
  try {
    re = new RegExp(inputRegex);
  } catch (e) {
    console.error('Invalid input-regex:', e.message || e);
    Deno.exit(1);
  } 
}


console.log('Scanning repository for matching files...');
const matches: string[] = [];
for await (const entry of walk(repo, { maxDepth: 50 })) {
  if (!entry.isFile) continue;
  const p = entry.path;
  console.log(`Checking file: ${p}`);
  console.log(`Input regex: ${inputRegex}`);
  if (re) {
    if (re.test(p)) matches.push(p);
  }
}

console.log(`Found ${matches.length} matching file(s):`);
for (const m of matches) console.log(m);

if (matches.length === 0) {
  console.log('No files to push to Albert. Exiting.');
  Deno.exit(0);
}

// Lookup Files table in Grist to map MD5 -> file record id
console.log('Fetching Files table records from Grist... ⏳');
const fileRecords: RawRecord[] = await fetchGristRecords(
  options.gristBase,
  options.gristApiKey,
  options.gristDocId,
  options.gristFilesTableId
);

// Compute MD5s of matched files and collect corresponding Grist IDs
const matchedMd5s = new Map<string, string>();
for (const p of matches) {
  try {
    const md5 = await getMD5FromFile(p);
    matchedMd5s.set(p, md5);
  } catch (e) {
    console.warn(`Could not hash ${p}: ${e}`);
  }
}

const inputGristIds: number[] = [];
for (const rec of (fileRecords || [])) {
  if (!rec || !rec.fields) continue;
  const md5 = rec.fields.MD5;
  for (const [path, fileMd5] of matchedMd5s.entries()) {
    if (fileMd5 === md5) inputGristIds.push(rec.id);
  }
}

const runName = getRunName(options.runName, tool);
console.log(`Creating collection '${runName}' in Albert...`);
const resp = await fetch(albertBase + '/v1/collections', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${albertApiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: runName,
  }),
});

if (!resp.ok) {
  console.error('Albert API error:', resp.status, await resp.text());
  Deno.exit(1);
}

const albertResp = await resp.json();
const albertCollectionId = albertResp.id || albertResp.collection_id || albertResp._id;
if (!albertCollectionId) {
  console.error('Could not determine Albert collection id from response');
  Deno.exit(1);
}

console.log(`Pushing files to collection '${runName}' in Albert...`);

// Upload each matched file as a separate document under the created collection
for (const p of matches) {
  try {
    const bytes = await Deno.readFile(p);
    const blob = new Blob([bytes], { type: getMimeTypeByPath(p) });
    const fd = new FormData();
    fd.append('file', blob, basename(p));
    fd.append('collection_id', String(albertCollectionId));
    fd.append('name', basename(p));
    fd.append('chunk_size', '2048');
    fd.append('chunk_overlap', '200');
    fd.append('metadata', JSON.stringify({ source: p }));

    const r = await fetch(albertBase + '/v1/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${albertApiKey}` },
      body: fd,
    });

    if (!r.ok) {
      console.error('Albert upload error for', p, r.status, await r.text());
      continue;
    }
    const j = await r.json();
    console.log('Uploaded', p, '->', j);
  } catch (e) {
    console.error('Upload failed for', p, e);
  }
}

// Create a Grist run record linking input files (those matched in Grist) and then record the output file
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

const runRecordId = await addRunRecordToGrist(options, existingCollectionId, tool, options.runName, inputGristIds, JSON.stringify(albertResp, null, 2));
if (!runRecordId) {
  console.error('Could not create run record in Grist');
  Deno.exit(1);
}