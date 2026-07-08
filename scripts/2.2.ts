import { Command } from 'jsr:@cliffy/command@1.0.0';
import { addFileRecordsToGrist, addRunRecordToGrist, getCorrespondingCollectionId, getCorrespondingRunId, getIdsByMD5FromGrist, getMD5FromFile, getScriptDefinition, logScriptEnd, logScriptStart, SCRIPT_TYPE, ScriptDefinition } from './utils.ts';
import { GEN_FOLDER_PATH } from './consts.ts';

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

  const { repo, collectionUuid } = options;
  
  const scriptDefiniton: ScriptDefinition = getScriptDefinition(
      "PDF to PNG",
      SCRIPT_TYPE.determinist,
      options.runName,
      GEN_FOLDER_PATH,
      GEN_FOLDER_PATH
  );

logScriptStart(scriptDefiniton);

const collectionRecordId = await getCorrespondingCollectionId(options, collectionUuid);
const existingRunId = await getCorrespondingRunId(options, collectionRecordId, scriptDefiniton.runName);

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

const inputPdfGristIds: number[] = await getIdsByMD5FromGrist(options, inputPdfMd5Set);

const runRecordId = await addRunRecordToGrist(options, collectionRecordId, scriptDefiniton.toolName, scriptDefiniton.runName, inputPdfGristIds, null, null, existingRunId);

// Prepare output PNG files for recording
const outputFilePaths = (options.outputFile || []) as string[];

console.log(`Recording ${outputFilePaths.length} PNG file(s) to Grist...`);
addFileRecordsToGrist(options, collectionRecordId, runRecordId, "gen", outputFilePaths)

logScriptEnd(scriptDefiniton, runRecordId);