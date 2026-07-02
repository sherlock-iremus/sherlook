import { Command } from "jsr:@cliffy/command@1.0.0";
import { walk } from "jsr:@std/fs@0.224.0";

import { fetchRecords as fetchGristRecords } from "https://raw.githubusercontent.com/sherlock-iremus/sherlock-deno/refs/heads/main/common-grist.ts";
import { RAW_FOLDER_PATH } from "./consts.ts";
import { addFileRecordsToGrist, addRunRecordToGrist } from "./utils.ts";

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

const TOOL_NAME = "Scan repo /raw";

const { repo, collectionUuid } = options;
const files = [];
for await (const entry of walk(repo + RAW_FOLDER_PATH, { maxDepth: 1 })) {
    if (entry.isFile) files.push(entry.path);
}

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

const runRecordId = await addRunRecordToGrist(options, existingCollectionId, TOOL_NAME, options.runName, []);
if (!runRecordId) {
    console.error("Could not log run in Grist. Exiting.");
    Deno.exit(1);
}
console.log(`Run record created in Grist with ID: ${runRecordId}`);
addFileRecordsToGrist(options, existingCollectionId, runRecordId, "raw", files)
console.log("Files records pushed ✅");
