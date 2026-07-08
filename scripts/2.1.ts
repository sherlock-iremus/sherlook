import { Command } from 'jsr:@cliffy/command@1.0.0';
import { PDFDocument } from "https://esm.sh/pdf-lib";
import { walk } from "jsr:@std/fs@0.224.0";
import { join, basename, extname } from "jsr:@std/path@0.224.0";
import { RAW_FOLDER_PATH, GEN_FOLDER_PATH } from './consts.ts';
import { addFileRecordsToGrist, addRunRecordToGrist, getCorrespondingCollectionId, getCorrespondingRunId, getIdsByMD5FromGrist, getMD5FromFile, getScriptDefinition, logScriptEnd, logScriptStart, SCRIPT_TYPE, ScriptDefinition } from './utils.ts';

const { options } = await new Command()
  .name("SHERLOOK Split PDFs")
  .description("Découpe les PDF en pages uniques, recense les fichiers générés dans /gen et enregistre un run dans Grist.")
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
  .parse();

  const { repo, collectionUuid } = options;
  
  const scriptDefiniton: ScriptDefinition = getScriptDefinition(
      "PDF Split",
      SCRIPT_TYPE.determinist,
      options.runName,
      RAW_FOLDER_PATH,
      GEN_FOLDER_PATH
  );

logScriptStart(scriptDefiniton);

const collectionRecordId = await getCorrespondingCollectionId(options, collectionUuid);
const existingRunId = await getCorrespondingRunId(options, collectionRecordId, scriptDefiniton.runName);

const rawMd5Set = new Set<string>();
const generatedFiles: any[] = [];

for await (const entry of walk(repo + scriptDefiniton.inputFolder, { maxDepth: 1 })) {
  if (!entry.isFile) continue;
  if (extname(entry.path).toLowerCase() !== ".pdf") continue;

  const inputBytes = await Deno.readFile(entry.path);
  const inputPdf = await PDFDocument.load(inputBytes);
  const pageCount = inputPdf.getPageCount();
  const base = basename(entry.path, ".pdf");
  rawMd5Set.add(await getMD5FromFile(entry.path));

  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(inputPdf, [i]);
    newPdf.addPage(page);
    const pdfBytes = await newPdf.save();
    const outName = `${base}-${String(i + 1).padStart(String(pageCount).length, "0")}.pdf`;
    const outPath = join(repo, scriptDefiniton.outputFolder, outName);
    await Deno.writeFile(outPath, pdfBytes);
    console.log(`Wrote ${outName}`);
    generatedFiles.push(outPath);
  }
}

const rawFilesGristIds: number[] = await getIdsByMD5FromGrist(options, rawMd5Set);

const runRecordId = await addRunRecordToGrist(options, collectionRecordId, scriptDefiniton.toolName, scriptDefiniton.runName, rawFilesGristIds, null, null, existingRunId);
await addFileRecordsToGrist(options, collectionRecordId, runRecordId, "gen", generatedFiles)

logScriptEnd(scriptDefiniton, runRecordId);