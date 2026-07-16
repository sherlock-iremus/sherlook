import { Command } from "jsr:@cliffy/command@1.0.0";
import path from "node:path";
import {
  addFileRecordsToGrist,
  addRunRecordToGrist,
  getCorrespondingCollectionId,
  getCorrespondingRunId,
  getFilesMatchingRegex,
  getIdsByMD5FromGrist,
  getMD5FromFile,
  getScriptDefinition,
  logScriptEnd,
  logScriptStart,
  SCRIPT_TYPE,
  ScriptDefinition,
} from "./utils.ts";
import { GEN_FOLDER_PATH } from "./consts.ts";
import { join } from "jsr:@std/path@0.224.0";

const { options } = await new Command()
  .name("SHERLOOK Convert PDFs to Images")
  .description(
    "Crée des registres Grist pour les images PNG générées à partir des PDF.",
  )
  .version("v1.0.0")
  .option("--repo <repo:string>", "")
  .option("--collection-uuid <collection-uuid:string>", "")
  .option("--grist-api-key <grist-api-key:string>", "")
  .option("--grist-base <grist-base:string>", "")
  .option("--grist-doc-id <grist-doc-id:string>", "")
  .option("--grist-files-table-id <grist-files-table-id:string>", "")
  .option("--grist-run-table-id <grist-run-table-id:string>", "")
  .option("--grist-collection-table-id <grist-collection-table-id:string>", "")
  .option("--run-name <run-name:string>", "Run name (required)")
  .option("--input-regex <input-regex:string>", "Input regex to select PDF files")
  .option("--input-file <input-file:string>", "input PDF file path", {
    collect: true,
  })
  .option("--output-file <output-file:string>", "output PNG file path", {
    collect: true,
  })
  .parse();

if (!options.runName) {
  console.error("Missing required --run-name");
  Deno.exit(1);
}

const { collectionUuid } = options;

const scriptDefiniton: ScriptDefinition = getScriptDefinition(
  "PDF to PNG",
  SCRIPT_TYPE.determinist,
  options.runName,
  GEN_FOLDER_PATH,
  GEN_FOLDER_PATH,
);

logScriptStart(scriptDefiniton);

const collectionRecordId = await getCorrespondingCollectionId(
  options,
  collectionUuid,
);
const existingRunId = await getCorrespondingRunId(
  options,
  collectionRecordId,
  scriptDefiniton.runName,
);

const repo = options.repo as string;
const inputRegex = options.inputRegex as string | undefined;

const inputFilePaths = inputRegex
  ? await getFilesMatchingRegex(repo, inputRegex)
  : (options.inputFile || []) as string[];

if (inputFilePaths.length === 0) {
  console.error("No PDF files selected for conversion.");
  Deno.exit(1);
}

const outputDir = join(repo, scriptDefiniton.outputFolder || "");
await Deno.mkdir(outputDir, {
  recursive: true,
});

const outputFilePaths: string[] = [];

for (let i = 0; i < inputFilePaths.length; i++) {
  const inputPath = inputFilePaths[i];
  const ext = path.extname(inputPath).toLowerCase();
  if (ext !== ".pdf") {
    console.warn(`Skipping non-PDF file ${inputPath}`);
    continue;
  }

  const outputPath = join(outputDir, path.basename(inputPath, ".pdf") + ".png");
  console.log(`Converting ${inputPath} -> ${outputPath}`);
  const outputBase = outputPath.replace(/\.png$/i, "");
  const process = Deno.run({
    cmd: ["pdftoppm", "-png", "-singlefile", inputPath, outputBase],
    stdout: "null",
    stderr: "piped",
  });
  const status = await process.status();
  const stderr = new TextDecoder().decode(await process.stderrOutput());
  process.close();
  if (!status.success) {
    console.error(`Conversion failed for ${inputPath}:`, stderr);
    Deno.exit(1);
  }
  outputFilePaths.push(outputPath);
}

// Compute MD5s for input PDF files and collect matching Grist IDs
const inputPdfMd5Set = new Set<string>();
for (const filePath of inputFilePaths) {
  try {
    const md5 = await getMD5FromFile(filePath);
    inputPdfMd5Set.add(md5);
  } catch (e) {
    console.warn(`Could not hash file ${filePath}: ${e}`);
  }
}

const inputPdfGristIds: number[] = await getIdsByMD5FromGrist(
  options,
  inputPdfMd5Set,
);

const runRecordId = await addRunRecordToGrist(
  options,
  collectionRecordId,
  scriptDefiniton.toolName,
  scriptDefiniton.runName,
  inputPdfGristIds,
  null,
  null,
  existingRunId,
);

console.log(`Recording ${outputFilePaths.length} PNG file(s) to Grist...`);
await addFileRecordsToGrist(
  options,
  collectionRecordId,
  runRecordId,
  "gen",
  outputFilePaths,
);

logScriptEnd(scriptDefiniton, runRecordId);
