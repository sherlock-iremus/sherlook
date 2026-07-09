import { Command } from 'jsr:@cliffy/command@1.0.0';
import { basename } from 'jsr:@std/path@0.224.0';
import { addRunRecordToGrist, getMimeTypeByPath, getScriptDefinition, ScriptDefinition, SCRIPT_TYPE, getRegexFromInput, getIdsByMD5FromGrist, getFilesMatchingRegex, getGristIdsByMatchedFiles, logScriptStart, getCorrespondingRunId, getCorrespondingCollectionId, logScriptEnd } from './utils.ts';
import { DAT_FOLDER_PATH, GEN_FOLDER_PATH } from './consts.ts';

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

const { repo, collectionUuid, inputRegex, albertBase, albertApiKey } = options;

const scriptDefiniton: ScriptDefinition = getScriptDefinition(
  "Albert Collection Ingestion",
  SCRIPT_TYPE.determinist,
  options.runName,
  GEN_FOLDER_PATH,
  undefined
);

logScriptStart(scriptDefiniton);
const collectionRecordId = await getCorrespondingCollectionId(options, collectionUuid);
const existingRunId = await getCorrespondingRunId(options, collectionRecordId, scriptDefiniton.runName);

const matches = await getFilesMatchingRegex(repo, inputRegex);
const inputGristIds = await getGristIdsByMatchedFiles(options, matches);

console.log(`Creating collection '${options.runName}' in Albert...`);
const resp = await fetch(albertBase + '/v1/collections', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${albertApiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: options.runName,
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

console.log(`Pushing files to collection '${options.runName}' in Albert...`);

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

const runRecordId = await addRunRecordToGrist(options, collectionRecordId, scriptDefiniton.toolName, scriptDefiniton.runName, inputGristIds, JSON.stringify(albertResp, null, 2), null, existingRunId);
logScriptEnd(scriptDefiniton, runRecordId);