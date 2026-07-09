import { Command } from 'jsr:@cliffy/command@1.0.0';
import { walk } from "jsr:@std/fs@0.224.0";
import { join, basename, extname, dirname, relative } from "jsr:@std/path@0.224.0";
import { GEN_FOLDER_PATH } from './consts.ts';
import { addRunRecordToGrist, addFileRecordsToGrist, getMD5FromFile, getScriptDefinition, SCRIPT_TYPE, ScriptDefinition, logScriptStart, getCorrespondingCollectionId, getCorrespondingRunId, logScriptEnd } from './utils.ts';
import { fetchRecords as fetchGristRecords } from "https://gitlab.huma-num.fr/sherlock/sherlock-deno/-/raw/main/common-grist.ts";

// Use pdf-parse-deno for text extraction
import pdfParse from "npm:pdf-parse-deno@1.1.1";

const { options } = await new Command()
  .name("SHERLOOK Extract PDF text")
  .description("Extract text from single-page PDFs in the /gen folder and log a run in Grist.")
  .version('v1.0.0')
  .option('--repo <repo:string>', "")
  .option("--input-file <input-file:string>", "input PDF file path", { collect: true })
  .option("--collection-uuid <collection-uuid:string>", "")
  .option("--grist-api-key <grist-api-key:string>", "")
  .option("--grist-base <grist-base:string>", "")
  .option("--grist-doc-id <grist-doc-id:string>", "")
  .option("--grist-files-table-id <grist-files-table-id:string>", "")
  .option("--grist-run-table-id <grist-run-table-id:string>", "")
  .option("--grist-collection-table-id <grist-collection-table-id:string>", "")
  .option("--run-name <run-name:string>", "Optional run name to override generated name")
  .option("--put-file-name-in-txt", "Prepend relative file path (from repo) at start of generated txt files")
  .parse();

const { repo, collectionUuid, putFileNameInTxt } = options;

const scriptDefiniton: ScriptDefinition = getScriptDefinition(
  "PDF to TXT",
  SCRIPT_TYPE.determinist,
  options.runName,
  GEN_FOLDER_PATH,
  GEN_FOLDER_PATH
);

logScriptStart(scriptDefiniton);

const collectionRecordId = await getCorrespondingCollectionId(options, collectionUuid);
const existingRunId = await getCorrespondingRunId(options, collectionRecordId, scriptDefiniton.runName);

console.log("Fetching Files table records from Grist... ⏳");
const rawFileRecords: RawRecord[] = await fetchGristRecords(
  options.gristBase,
  options.gristApiKey,
  options.gristDocId,
  options.gristFilesTableId
);

// Discover input PDFs from Grist: select Files where Dir === 'gen' and Pages === 1
const candidateRecords = (rawFileRecords || []).filter(r => {
  if (!r || !r.fields) return false;
  const dir = r.fields.Dir;
  const pages = r.fields.Pages;
  const extension = r.fields.Extension;
  return dir === 'gen' && (pages === 1 || pages === '1') && extension === 'pdf';
});

const candidateMd5Set = new Set<string>(candidateRecords.map(r => r.fields && r.fields.MD5).filter(Boolean));
if (candidateMd5Set.size === 0) {
  console.log("No one-page 'gen' files found in Grist. Exiting.");
  Deno.exit(0);
}

// Walk local gen folder and match files by MD5 to the candidate records
const genPdfPaths: string[] = [];
const matchedGristIdSet = new Set<number>();
for await (const entry of walk(repo + scriptDefiniton.inputFolder, { maxDepth: 1 })) {
  if (!entry.isFile) continue;
  if (extname(entry.path).toLowerCase() !== ".pdf") continue;
  try {
    const md5 = await getMD5FromFile(entry.path);
    if (candidateMd5Set.has(md5)) {
      genPdfPaths.push(entry.path);
      // add all matching record ids for this md5
      for (const rec of candidateRecords) {
        if (rec.fields && rec.fields.MD5 === md5) matchedGristIdSet.add(rec.id);
      }
    }
  } catch (e) {
    console.warn(`Could not hash file ${entry.path}: ${e}`);
  }
}

if (genPdfPaths.length === 0) {
  console.log("No matching local PDF files found for Grist 'gen' one-page records. Exiting.");
  Deno.exit(0);
}

const inputPdfGristIds: number[] = Array.from(matchedGristIdSet);

const runRecordId = await addRunRecordToGrist(options, collectionRecordId, scriptDefiniton.toolName, scriptDefiniton.runName, inputPdfGristIds, null, null, existingRunId);

// Extract text from each PDF using pdf-parse-deno
async function extractTextFromPdf(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const uint8 = new Uint8Array(bytes);
  // pdfParse returns an object with a `text` property
  const data: any = await (pdfParse as any)(uint8);
  return data?.text ?? '';
}

const extractedFiles: string[] = [];
for (const p of genPdfPaths) {
  try {
    const text = await extractTextFromPdf(p);
    const name = basename(p, '.pdf') + '.txt';
    const outPath = join(dirname(p), name);
    if (putFileNameInTxt) {
      const rel = relative(repo, p);
      const outText = `<document source_file="${rel}">\n\n${text}\n\n</document>`;
      await Deno.writeTextFile(outPath, outText);
    } else {
      await Deno.writeTextFile(outPath, text);
    }
    console.log(`Wrote text ${name}`);
    extractedFiles.push(outPath);
  } catch (e) {
    console.error(`Failed to extract text from ${p}:`, e);
  }
}

addFileRecordsToGrist(options, collectionRecordId, runRecordId, "gen", extractedFiles);

logScriptEnd(scriptDefiniton, runRecordId)