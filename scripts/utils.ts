const {
    createHash,
} = await import('node:crypto');
import pdfParse from 'npm:pdf-parse@1.1.1';
import path from 'node:path';
import { fetchRecords as fetchGristRecords, addRecords } from "https://raw.githubusercontent.com/sherlock-iremus/sherlock-deno/refs/heads/main/common-grist.ts";

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

export const addRunRecordToGrist = async (options: any, collectionId: string, tool: string, cliRunName: string, inputFileIds: number[], output_log: string) => {
    const runUuid = crypto.randomUUID();
    const runName = getRunName(cliRunName, tool);

    const runRecord: any = {
        collection: collectionId,
        name: runName,
        UUID: runUuid,
        tool: tool,
        input_files: inputFileIds.length ? ["L", ...inputFileIds] : null,
        timestamp: new Date().toISOString(),
        output_log: output_log || null,
    };

    try {
        console.log("Logging run in Grist... ⏳");
        const runRecordId = (await addRecords(
            options.gristBase,
            options.gristApiKey,
            options.gristDocId,
            options.gristRunTableId,
            { records: [{ fields: runRecord }] }
        ))[0].id;
        console.log("Run logged ✅");
        return runRecordId;
    } catch (err) {
        console.warn("Could not log run in Grist:", err);
        return undefined;
    }
}

export const addFileRecordsToGrist = async (options: any, collectionId: string, runRecordId: number, dir: string, files: string[]) => {
    console.log("Fetching existing records from Grist... ⏳");
    const rawRecords: RawRecord[] = await fetchGristRecords(
        options.gristBase,
        options.gristApiKey,
        options.gristDocId,
        options.gristFilesTableId
    );

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