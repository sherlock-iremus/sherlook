import { Command } from "jsr:@cliffy/command@1.0.0";
import { walk } from "jsr:@std/fs@0.224.0";

import { RAW_FOLDER_PATH } from "./consts.ts";
import { addFileRecordsToGrist, addRunRecordToGrist, getCorrespondingCollectionId, getCorrespondingRunId, getScriptDefinition, logScriptEnd, logScriptStart, SCRIPT_TYPE, ScriptDefinition } from "./utils.ts";

const { options } = await new Command()
    .name("SHERLOOK Grist Collection Declaration")
    .description("Déclare le contenu d'une collection dans Grist à partir des fichiers PDF bruts.")
    .version("v1.0.0")
    .option("--grist-api-key <grist-api-key:string>", "")
    .option("--grist-base <grist-base:string>", "")
    .option("--grist-doc-id <grist-doc-id:string>", "")
    .option("--grist-files-table-id <grist-files-table-id:string>", "")
    .option("--grist-run-table-id <grist-run-table-id:string>", "")
    .option("--grist-collection-table-id <grist-collection-table-id:string>", "")
    .option("--run-name <run-name:string>", "Optional run name to override generated name")
    .option("--collection-uuid <collection-uuid:string>", "")
    .option("--repo <raw-dir:string>", "Chemin du repository de la collection")
    .parse();

const { repo, collectionUuid } = options;

const scriptDefiniton: ScriptDefinition = getScriptDefinition(
    "Scan repo /raw",
    SCRIPT_TYPE.determinist,
    options.runName,
    RAW_FOLDER_PATH
);

logScriptStart(scriptDefiniton);
const collectionRecordId = await getCorrespondingCollectionId(options, collectionUuid);
const existingRunId = await getCorrespondingRunId(options, collectionRecordId, scriptDefiniton.runName);

const files = [];
for await (const entry of walk(repo + scriptDefiniton.inputFolder, { maxDepth: 1 })) {
    if (entry.isFile) files.push(entry.path);
}

const runRecordId = await addRunRecordToGrist(options, collectionRecordId, scriptDefiniton.toolName, scriptDefiniton.runName, [], null, null, existingRunId);

await addFileRecordsToGrist(options, collectionRecordId, runRecordId, "raw", files)
logScriptEnd(scriptDefiniton, runRecordId);
