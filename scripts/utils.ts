const {
    createHash,
} = await import('node:crypto');
import pdfParse from 'npm:pdf-parse@1.1.1';
import path from 'node:path';
import { fetchRecords as fetchGristRecords, addRecords, writeValueById, patchRecord as putRecords } from "https://gitlab.huma-num.fr/sherlock/sherlock-deno/-/raw/main/common-grist.ts";

export const getMD5FromFile = async (file: string) => {
    const fileBuf = await Deno.readFile(file);
    return createHash("md5").update(fileBuf).digest("hex");
}

export const getNumberOfPages = async (file: string, fileName: string, ext: string) => {
    let pages = null;
    if (ext && ext.toLowerCase() === 'pdf') {
        try {
            const data = await pdfParse(file);
            pages = data.numpages || data.numpages === 0 ? data.numpages : (data.info && data.info.Pages) || null;
        } catch (e) {
            console.warn(`Could not parse PDF: ${fileName} (${e})`);
        }
    }
    return pages;
}

export const getDefaultRunName = (tool: string) => {
    return `${tool}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

export const getRunName = (cliRunName: string | undefined, tool: string) => {
    return cliRunName ? tool + '-' + cliRunName : getDefaultRunName(tool);
}

export const getMimeTypeByPath = (path: string): string => {
    switch (path.split('.').pop()?.toLowerCase()) {
        case "pdf":
            return "application/pdf";
        case "txt":
            return "text/plain";
        case "md":
            return "text/markdown";
        case "csv":
            return "text/csv";
        case "json":
            return "application/json";
        default:
            return "application/octet-stream";
    }
}

export const addRunRecordToGrist = async (options: any, collectionId: string, tool: string, runName: string, inputFileIds: number[], output_log: any, input_args: any, existingRunId: number | null) => {
    const runUuid = crypto.randomUUID();

    const runRecord: any = {
        collection: collectionId,
        name: runName,
        UUID: runUuid,
        tool: tool,
        input_files: inputFileIds.length ? ["L", ...inputFileIds] : null,
        timestamp: new Date().toISOString(),
        output_log: output_log || null,
        input_args: input_args || null,
    };

    try {
        console.log("Logging run in Grist... ⏳");
        if (existingRunId) {
            await putRecords(
                options.gristBase,
                options.gristApiKey,
                options.gristDocId,
                options.gristRunTableId,
                { records: [{ fields: runRecord, require: { collection: collectionId, name: runName } }] }
            );
            console.log(`Run record edited in Grist with ID: ${existingRunId}`);
            return existingRunId;
        } else {
            const runRecordId = (await addRecords(
                options.gristBase,
                options.gristApiKey,
                options.gristDocId,
                options.gristRunTableId,
                { records: [{ fields: runRecord }] }
            ))[0].id;
            console.log(`Run record created in Grist with ID: ${runRecordId}`);
            return runRecordId;
        }
    } catch (err) {
        console.warn("Could not log run in Grist:", err);
    }
    Deno.exit(1);
}

export const addFileRecordsToGrist = async (options: any, collectionId: string, runRecordId: number, dir: string, files: string[]) => {
    console.log("Fetching existing records from Grist... ⏳");
    const rawRecords: RawRecord[] = await fetchGristRecords(
        options.gristBase,
        options.gristApiKey,
        options.gristDocId,
        options.gristFilesTableId
    );

    const md5ToRecord = new Map<string, RawRecord>();
    for (const record of rawRecords || []) {
        const recordMd5 = record.fields && record.fields.MD5;
        if (recordMd5 && record.id) {
            md5ToRecord.set(recordMd5, record);
        }
    }

    const records = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = path.basename(file);
        const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
        const basename = fileName.replace(/\.[^.]+$/, '');
        const md5 = await getMD5FromFile(file);
        if (md5ToRecord.has(md5)) {
            const existingRecord = md5ToRecord.get(md5);
            console.log(`MD5 already present in Grist for ${fileName}: ${md5}.`);
            if (runRecordId !== existingRecord.fields.Generated_by) {
                console.log(`Updating existing record ${existingRecord.id} source Run.`);
                await writeValueById(
                    options.gristBase,
                    options.gristApiKey,
                    options.gristDocId,
                    options.gristFilesTableId,
                    existingRecord.id,
                    "Generated_by",
                    runRecordId
                );
                console.warn("TODO: remove irrelevant previous run record : " + existingRecord.fields.Generated_by);
            }
            continue;
        }

        const pages = await getNumberOfPages(file, fileName, ext);
        records.push({
            Collection: collectionId,
            Dir: dir,
            Generated_by: runRecordId,
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
        { records: records.map(r => ({ fields: r })) }
    );
}

export const getCorrespondingCollectionId = async (options: any, collectionUuid: string) => {

    console.log("Fetching collections definitions from Grist... ⏳");
    const collectionRecords: CollectionRecord[] = await fetchGristRecords(
        options.gristBase,
        options.gristApiKey,
        options.gristDocId,
        options.gristCollectionTableId
    );

    const existingCollectionId = collectionRecords.find(r => r.fields.UUID === collectionUuid)?.id;
    if (!existingCollectionId) {
        throw console.error(`No existing collection found in Grist with UUID ${collectionUuid}. Please create the collection in Grist first and re-run the script.`);
    }
    return existingCollectionId;
}

export const getCorrespondingRunId = async (options: any, collectionId: string, runName: string) => {
    console.log("Fetching collections definitions from Grist... ⏳");
    const runRecords: RunRecord[] = await fetchGristRecords(
        options.gristBase,
        options.gristApiKey,
        options.gristDocId,
        options.gristRunTableId
    );

    const existingRunId = runRecords.find(r => r.fields.name === runName && r.fields.collection === collectionId)?.id;
    return existingRunId;
}

export const logScriptEnd = (scriptDefinition: ScriptDefinition, runRecordId: number) => {
    console.log(`Run ${scriptDefinition.runName} created in Grist with ID: ${runRecordId}`);
}

export const logScriptStart = (scriptDefinition: ScriptDefinition) => {
    console.log(`Starting script ${scriptDefinition.toolName}...`);
}

export interface ScriptDefinition {
    toolName: string;
    type: SCRIPT_TYPE;
    runName: string;
    inputFolder: string;
    outputFolder?: string;
}

export enum SCRIPT_TYPE {
    determinist,
    indeterministic
}

export const getScriptDefinition = (toolName: string, type: SCRIPT_TYPE, cliRunName: string, inputFolder: string, outputFolder?: string): ScriptDefinition => {
    const scriptDefiniton: ScriptDefinition = {
        toolName: toolName,
        type: type,
        runName: getRunName(cliRunName, toolName),
        inputFolder: inputFolder,
        outputFolder: outputFolder
    };
    return scriptDefiniton;
}   

export const getIdsByMD5FromGrist = async (options: any, md5Set: Set<string>): Promise<number[]> => {
  
    console.log("Fetching Files table records from Grist... ⏳");
    const fileRecords: RawRecord[] = await fetchGristRecords(
      options.gristBase,
      options.gristApiKey,
      options.gristDocId,
      options.gristFilesTableId
    );
    return (fileRecords || [])
      .filter(r => r.fields && md5Set.has(r.fields.MD5))
      .map(r => r.id);
    
}