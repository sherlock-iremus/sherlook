import { Command } from 'jsr:@cliffy/command@1.0.0';
import { addFileRecordsToGrist, addRunRecordToGrist, getMD5FromFile } from './utils.ts';
import { fetchRecords as fetchGristRecords } from "https://raw.githubusercontent.com/sherlock-iremus/sherlock-deno/refs/heads/main/common-grist.ts";

const { options } = await new Command()
  .name("SHERLOOK Convert PDFs to Images")
  .description("Crée des registres Grist pour les images PNG générées à partir des PDF.")
  .version('v1.0.0')
  .option('--repo <repo:string>', "")
  .option("--collection-uuid <collection-uuid:string>", "")
  .option("--grist-api-key <grist-api-key:string>", "")
  .option("--grist-base <grist-base:string>", "")
  .option("--grist-doc-id <grist-doc-id:string>", "")
  .option("--grist-files-table-id <grist-files-table-id:string>", "")
  .option("--grist-run-table-id <grist-run-table-id:string>", "")
  .option("--grist-collection-table-id <grist-collection-table-id:string>", "")
  .option("--run-name <run-name:string>", "Optional run name to override generated name")
  .option("--input-file <input-file:string>", "input PDF file path", {collect: true})
  .option("--output-file <output-file:string>", "output PNG file path", {collect: true})
  .parse();

const TOOL_NAME = "PDF to PNG";
const { collectionUuid } = options;

console.log("Fetching collections definitions from Grist... ⏳");
const collectionRecords: CollectionRecord[] = await fetchGristRecords(
  options.gristBase,
  options.gristApiKey,
  options.gristDocId,
  options.gristCollectionTableId
);

const existingCollectionId = collectionRecords.find(r => r.fields.UUID === collectionUuid)?.id;
if (!existingCollectionId) {
  console.error(``);
  throw console.error(`No existing collection found in Grist with UUID ${collectionUuid}. Please create the collection in Grist first and re-run the script.`);
}

// Fetch Files table to lookup generated PNG MD5s
console.log("Fetching Files table records from Grist... ⏳");
const fileRecords: RawRecord[] = await fetchGristRecords(
  options.gristBase,
  options.gristApiKey,
  options.gristDocId,
  options.gristFilesTableId
);

// Compute MD5s for input PDF files and collect matching Grist IDs
const inputPdfMd5Set = new Set<string>();
const inputFilePaths = (options.inputFile || []) as string[];

for (const filePath of inputFilePaths) {
  try {
    const md5 = await getMD5FromFile(filePath);
    inputPdfMd5Set.add(md5);
  } catch (e) {
    console.warn(`Could not hash file ${filePath}: ${e}`);
  }
}

const inputPdfGristIds: number[] = (fileRecords || [])
  .filter(r => r.fields && inputPdfMd5Set.has(r.fields.MD5))
  .map(r => r.id);

const runRecordId = await addRunRecordToGrist(options, existingCollectionId, TOOL_NAME, options.runName, inputPdfGristIds);
if (!runRecordId) {
  console.error("Could not log run in Grist. Exiting.");
  Deno.exit(1);
}
console.log(`Run record created in Grist with ID: ${runRecordId}`);

// Prepare output PNG files for recording
const outputFilePaths = (options.outputFile || []) as string[];

console.log(`Recording ${outputFilePaths.length} PNG file(s) to Grist...`);
addFileRecordsToGrist(options, existingCollectionId, runRecordId, "gen", outputFilePaths)
console.log("PNG records pushed ✅");
