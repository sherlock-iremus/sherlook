import { Command } from "jsr:@cliffy/command@1.0.0";
import { basename, join } from "jsr:@std/path@0.224.0";
import {
  addFileRecordsToGrist,
  addRunRecordToGrist,
  getCorrespondingCollectionId,
  getCorrespondingRunId,
  getFilesMatchingRegex,
  getGristIdsByMatchedFiles,
  getScriptDefinition,
  logScriptEnd,
  logScriptStart,
  SCRIPT_TYPE,
  ScriptDefinition,
} from "./utils.ts";
import { GEN_FOLDER_PATH } from "./consts.ts";

const { options } = await new Command()
  .name("SHERLOOK 2.4.2")
  .option("--repo <repo:string>", "")
  .option("--collection-uuid <collection-uuid:string>", "")
  .option("--input-regex <input-regex:string>", "")
  .option("--run-name <run-name:string>", "Run name (required)")
  .option("--grist-api-key <grist-api-key:string>", "")
  .option("--grist-base <grist-base:string>", "")
  .option("--grist-doc-id <grist-doc-id:string>", "")
  .option("--grist-files-table-id <grist-files-table-id:string>", "")
  .option("--grist-run-table-id <grist-run-table-id:string>", "")
  .option("--grist-collection-table-id <grist-collection-table-id:string>", "")
  .option("--chandra-cmd <chandra-cmd:string>", "Path to python binary (default: python3)")
  .parse();

if (!options.runName) {
  console.error("Missing required --run-name");
  Deno.exit(1);
}

const {
  repo,
  collectionUuid,
  inputRegex,
  chandraCmd,
} = options;

const scriptDefiniton: ScriptDefinition = getScriptDefinition(
  "Chandra OCR",
  SCRIPT_TYPE.indeterministic,
  options.runName ?? "",
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

const matches = await getFilesMatchingRegex(repo ?? "", inputRegex ?? "");
const inputGristIds = await getGristIdsByMatchedFiles(options, matches);

// prepare output dir
if (scriptDefiniton.outputFolder) {
  await Deno.mkdir(scriptDefiniton.outputFolder, { recursive: true });
}

const savedFiles: string[] = [];

for (const filePath of matches) {
  console.log(`Processing ${filePath} ...`);
  const baseName = basename(filePath).replace(/\.[^.]+$/, "");
  const outDir = scriptDefiniton.outputFolder ?? "./";
  const outSpecificFileDir = join(outDir, `${baseName}`);

  // Build chandra command: python3 -m uv run chandra <file.pdf> <output_file> --method hf --include-headers-footers
  const cmd = [
    chandraCmd,
    "-m",
    "uv",
    "run",
    "chandra",
    filePath,
    outSpecificFileDir,
    "--method",
    "hf",
    "--include-headers-footers",
  ];

  try {
    console.log(`Running: ${cmd.join(" ")}`);
    const p = Deno.run({ cmd, stdout: "inherit", stderr: "inherit" });
    const status = await p.status();
    p.close();
    if (!status.success) {
      console.error(`Chandra failed for ${filePath} (exit ${status.code})`);
      continue;
    }
    savedFiles.push(outFile);
  } catch (e) {
    console.error("Failed to run chandra for", filePath, e);
  }
}

const runRecordId = await addRunRecordToGrist(
  options,
  collectionRecordId,
  scriptDefiniton.toolName,
  scriptDefiniton.runName,
  inputGristIds,
  null,
  JSON.stringify({ inputRegex }),
  existingRunId,
);

if (savedFiles.length) {
  await addFileRecordsToGrist(
    options,
    collectionRecordId,
    runRecordId,
    "gen",
    savedFiles,
  );
}

logScriptEnd(scriptDefiniton, runRecordId);
