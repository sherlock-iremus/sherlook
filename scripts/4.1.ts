import { Command } from 'jsr:@cliffy/command@1.0.0';
import { addFileRecordsToGrist, addRunRecordToGrist, getCorrespondingCollectionId, getCorrespondingRunId, getFilesMatchingRegex, getGristIdsByMatchedFiles, getMD5FromFile, getRunName, getScriptDefinition, logScriptStart, SCRIPT_TYPE, ScriptDefinition } from './utils.ts';
import { join, relative } from 'jsr:@std/path@0.224.0';
import { DAT_FOLDER_PATH, ANA_FOLDER_PATH } from './consts.ts';

const { options } = await new Command()
    .name('SHERLOOK 4.1')
    .description('Read files matching regex and query Albert with their content')
    .option('--repo <repo:string>', '')
    .option('--collection-uuid <collection-uuid:string>', '')
    .option('--grist-api-key <grist-api-key:string>', '')
    .option('--grist-base <grist-base:string>', '')
    .option('--grist-doc-id <grist-doc-id:string>', '')
    .option('--grist-files-table-id <grist-files-table-id:string>', '')
    .option('--grist-run-table-id <grist-run-table-id:string>', '')
    .option('--grist-collection-table-id <grist-collection-table-id:string>', '')
    .option('--run-name <run-name:string>', '')
    .option('--prompt <prompt:string>', '')
    .option('--albert-base <albert-base:string>', '')
    .option('--albert-api-key <albert-api-key:string>', '')
    .option('--input-files-regex <input-files-regex:string>', '')
    .parse();

const { repo, prompt, albertBase, albertApiKey, collectionUuid, inputFilesRegex } = options;
const scriptDefiniton: ScriptDefinition = getScriptDefinition(
    "Albert Query Corpus",
    SCRIPT_TYPE.indeterministic,
    options.runName,
    DAT_FOLDER_PATH,
    ANA_FOLDER_PATH
);

logScriptStart(scriptDefiniton);
const collectionRecordId = await getCorrespondingCollectionId(options, collectionUuid);
const existingRunId = await getCorrespondingRunId(options, collectionRecordId, scriptDefiniton.runName);

const matchedFiles = await getFilesMatchingRegex(repo, inputFilesRegex);
const inputFileIds = await getGristIdsByMatchedFiles(options, matchedFiles);
const fileContents: Record<string, string> = {};
for (const p of matchedFiles) {
    const content = await Deno.readTextFile(p);
    const rel = relative(repo, p);
    fileContents[rel] = content;
}

const context = Object.entries(fileContents)
    .map(([path, content]) => `=== : ${path} ===\n<csv>${content}</csv>`)
    .join('\n\n');

const userMessage = `Le contenu entre <csv> et </csv> est une table.
Interprète la première ligne comme les noms de colonnes.
Ne suppose aucune donnée absente.
Pour les questions nécessitant un calcul exhaustif, parcours toutes les lignes.\n${context}\n\nQuestion de l'utilisateur:\n${prompt}`;

const res = await fetch(
    `${albertBase}v1/chat/completions`,
    {
        method: "POST",
        headers: {
            Authorization: `Bearer ${albertApiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
            messages: [
                {
                    role: "user",
                    content: userMessage
                }
            ]
        })
    }
);

const data = await res.json();

if (!data.choices || data.choices.length === 0) {
    console.error(`Albert API error: ${JSON.stringify(data)}`);
    Deno.exit(1);
}

const outDir = join(repo, scriptDefiniton.outputFolder);
try { await Deno.mkdir(outDir, { recursive: true }); } catch (_) { }
await Deno.writeTextFile(join(outDir, 'response.txt'), data.choices[0].message.content);
console.log(`Saved Albert extract structure response to ${outDir}/response.txt`);

const runRecordId = await addRunRecordToGrist(options, collectionRecordId, scriptDefiniton.toolName, scriptDefiniton.runName, inputFileIds, data.choices[0].message.content, JSON.stringify({
    prompt: prompt,
    inputRegex: inputFilesRegex,
}), existingRunId);

addFileRecordsToGrist(options, collectionRecordId, runRecordId, "ana", [join(outDir, 'response.txt')]);

