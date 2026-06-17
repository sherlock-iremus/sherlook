import { Command } from "jsr:@cliffy/command@1.0.0";
import fs from "node:fs";
import { walk } from "jsr:@std/fs@0.224.0";
import path from 'node:path';

import { fetchRecords as fetchGristRecords, addRecords } from "https://raw.githubusercontent.com/sherlock-iremus/sherlock-deno/refs/heads/main/common-grist.ts";
import { RAW_FOLDER_PATH } from "./consts.ts";
import { getMD5FromFile, getNumberOfPages } from "./utils.ts";

const { options } = await new Command()
    .name("SHERLOOK Grist Collection Declaration")
    .description("Déclare le contenu d'une collection dans Grist à partir des fichiers PDF bruts.")
    .version("v1.0.0")
    .option("--grist-api-key <grist-api-key:string>", "")
    .option("--grist-base <grist-base:string>", "")
    .option("--grist-doc-id <grist-doc-id:string>", "")
    .option("--grist-files-table-id <grist-files-table-id:string>", "")
    .option("--grist-collection-table-id <grist-collection-table-id:string>", "")
    .option("--collection-uuid <collection-uuid:string>", "")
    .option("--repo <raw-dir:string>", "Chemin du repository de la collection")
    .parse();

const { repo, collectionUuid } = options;
const files = [];
for await (const entry of walk(repo + RAW_FOLDER_PATH, { maxDepth: 1 })) {
    if (entry.isFile) files.push(entry.path);
}

console.log(`Found ${files.length} files in collection raw folder.`);
console.log("Fetching existing records from Grist... ⏳");
const rawRecords: RawRecord[] = await fetchGristRecords(
    options.gristBase,
    options.gristApiKey,
    options.gristDocId,
    options.gristFilesTableId
);

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

const existingMd5s = new Set((rawRecords || []).map(r => r.fields && r.fields.MD5));

const records = [];
for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = path.basename(file);
    const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
    const basename = fileName.replace(/\.[^.]+$/, '');
    const md5 = await getMD5FromFile(file);
    if (existingMd5s.has(md5)) {
        console.warn(`MD5 already present in Grist: ${fileName} (${md5})`);
        continue;
    }
    
    const pages = await getNumberOfPages(file, fileName, ext);
    records.push({
        Collection: existingCollectionId,
        Dir: "raw",
        Name: basename,
        Extension: ext || null,
        MD5: md5,
        Pages: pages,
    });
}
console.log("File analysis complete ✅");
console.log("Pushing records to Grist... ⏳");

records.length && await addRecords(
    options.gristBase,
    options.gristApiKey,
    options.gristDocId,
    options.gristFilesTableId,
    {records: records.map(r => ({ fields: r }))}
);
console.log("Records pushed ✅");
