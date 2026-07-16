import { Command } from "jsr:@cliffy/command@1.0.0";
import { basename, join } from "jsr:@std/path@0.224.0";
import { encodeBase64 } from "jsr:@std/encoding@0.224.0/base64";
import { GEN_FOLDER_PATH } from "./consts.ts";
import {
  addFileRecordsToGrist,
  addRunRecordToGrist,
  fetchWithRetry,
  getCorrespondingCollectionId,
  getCorrespondingRunId,
  getFilesMatchingRegex,
  getScriptDefinition,
  logScriptEnd,
  logScriptStart,
  SCRIPT_TYPE,
  ScriptDefinition,
} from "./utils.ts";

const { options } = await new Command()
  .name("SHERLOOK 2.4.1")
  .option("--repo <repo:string>", "")
  .option("--collection-uuid <collection-uuid:string>", "")
  .option("--input-regex <input-regex:string>", "")
  .option("--run-name <run-name:string>", "Run name (required)")
  .option("--albert-base <albert-base:string>", "")
  .option("--albert-api-key <albert-api-key:string>", "")
  .option("--datalab-api-key <datalab-api-key:string>", "")
  .option("--datalab-base <datalab-base:string>", "")
  .option(
    "--put-file-name-in-txt <put-file-name-in-txt:boolean>",
    "If true, prepend source filename to extracted text",
  )
  .option("--grist-api-key <grist-api-key:string>", "")
  .option("--grist-base <grist-base:string>", "")
  .option("--grist-doc-id <grist-doc-id:string>", "")
  .option("--grist-files-table-id <grist-files-table-id:string>", "")
  .option("--grist-run-table-id <grist-run-table-id:string>", "")
  .option("--grist-collection-table-id <grist-collection-table-id:string>", "")
  .parse();

if (!options.runName) {
  console.error("Missing required --run-name");
  Deno.exit(1);
}

const {
  repo,
  collectionUuid,
  inputRegex,
  albertBase,
  albertApiKey,
  putFileNameInTxt,
  datalabApiKey,
  datalabBase,
} = options;

const scriptDefiniton: ScriptDefinition = getScriptDefinition(
  "Albert OCR",
  SCRIPT_TYPE.indeterministic,
  options.runName ?? "",
  GEN_FOLDER_PATH,
  GEN_FOLDER_PATH,
);
const matchedFiles = await getFilesMatchingRegex(repo ?? "", inputRegex ?? "");

const baseUrl = albertBase || "https://albert.api.etalab.gouv.fr";

for (const filePath of matchedFiles) {
  console.log(`Processing ${filePath} ...`);
  const bytes = await Deno.readFile(filePath);
  const b64 = encodeBase64(bytes);

  /*const body: any = {
    model: "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
    document: {
      type: "document_url",
      document_name: basename(filePath),
      document_url: `data:application/pdf;base64,${b64}`,
    },
    include_image_base64: false,
  };

  const res = await fetchWithRetry(`${baseUrl}/v1/ocr`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${albertApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, 3);

  if (!res.ok) {
    console.error("Albert API error:", res.status, await res.text());
    continue;
  }

  const albertResp = await res.json();
  console.log("Albert OCR response:", albertResp); */

  const form = new FormData();

  form.append(
    "file",
    new Blob([bytes], { type: "application/pdf" }),
    "KO_Eph_1950-14.pdf",
  );
  form.append("langs", "fr");

  const response = await fetch(`${datalabBase}v1/ocr`, {
    method: "POST",
    headers: {
      "X-API-Key": datalabApiKey,
    },
    body: form,
  });

  const json = await response.json();

  console.log(json);
  const requestId = json.request_id;

  while (true) {
    const r = await fetch(
      `${datalabBase}v1/ocr/${requestId}`,
      {
        headers: {
          "X-API-Key": datalabApiKey,
        },
      },
    );

    const status = await r.json();

    console.log(status.status);

    if (status.status === "complete") {
      console.log(status);
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  /*
  const baseName = basename(filePath).replace(/\.[^.]+$/, "");
  const jsonOut = join(outDir, `${baseName}.albert.ocr.json`);
  await Deno.writeTextFile(jsonOut, JSON.stringify(albertResp, null, 2));
  savedFiles.push(jsonOut);

  let extracted = null as string | null;
  if (typeof albertResp.text === "string") extracted = albertResp.text;
  else if (
    albertResp.document && typeof albertResp.document.text === "string"
  ) extracted = albertResp.document.text;
  else if (Array.isArray(albertResp.pages)) {
    extracted = albertResp.pages.map((p: any) => p.text || p.markdown || "")
      .join("\n\n");
  }

  if (extracted !== null) {
    if (putFileNameInTxt) extracted = `${basename(filePath)}\n\n${extracted}`;
    const txtOut = join(outDir, `${baseName}.txt`);
    await Deno.writeTextFile(txtOut, extracted);
    savedFiles.push(txtOut);
  }
    */
}
/*
const runRecordId = await addRunRecordToGrist(
  options,
  collectionRecordId,
  scriptDefiniton.toolName,
  scriptDefiniton.runName,
  [],
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
*/
