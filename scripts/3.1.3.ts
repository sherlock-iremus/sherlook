import { Command } from 'jsr:@cliffy/command@1.0.0';
import { join, relative } from 'jsr:@std/path@0.224.0';
import { stringify } from "@std/csv";
import { addFileRecordsToGrist, addRunRecordToGrist, fetchWithRetry, getCorrespondingCollectionId, getCorrespondingRunId, getFilesMatchingRegex, getGristIdsByMatchedFiles, getRunName, getScriptDefinition, logScriptEnd, logScriptStart, SCRIPT_TYPE, ScriptDefinition } from './utils.ts';
import { DAT_FOLDER_PATH, GEN_FOLDER_PATH } from './consts.ts';

const { options } = await new Command()
    .name('SHERLOOK 3.1.3')
    .description('Aggregate files matching regex and extract structure via Albert')
    .option('--repo <repo:string>', '')
    .option('--collection-uuid <collection-uuid:string>', '')
    .option('--grist-api-key <grist-api-key:string>', '')
    .option('--grist-base <grist-base:string>', '')
    .option('--grist-doc-id <grist-doc-id:string>', '')
    .option('--grist-files-table-id <grist-files-table-id:string>', '')
    .option('--grist-run-table-id <grist-run-table-id:string>', '')
    .option('--grist-collection-table-id <grist-collection-table-id:string>', '')
    .option('--run-name <run-name:string>', '')
    .option('--input-regex <input-regex:string>', '')
    .option('--prompt <prompt:string>', '')
    .option('--albert-base <albert-base:string>', '')
    .option('--albert-api-key <albert-api-key:string>', '')
    .parse();

const { repo, prompt, albertBase, albertApiKey, collectionUuid, inputRegex } = options;
const scriptDefiniton: ScriptDefinition = getScriptDefinition(
    "Albert Extract Structure With Attached Files",
    SCRIPT_TYPE.indeterministic,
    options.runName,
    GEN_FOLDER_PATH,
    DAT_FOLDER_PATH
);

logScriptStart(scriptDefiniton);
const collectionRecordId = await getCorrespondingCollectionId(options, collectionUuid);
const existingRunId = await getCorrespondingRunId(options, collectionRecordId, scriptDefiniton.runName);

const matches = await getFilesMatchingRegex(repo, inputRegex);
const inputGristIds = await getGristIdsByMatchedFiles(options, matches);

const aggregated: Array<{ source_file: string; content: string }> = [];

// Build aggregated array from the precomputed `matches` list
for (const p of matches) {
    const relPath = relative(repo, p);
    try {
        const content = await Deno.readTextFile(p);
        aggregated.push({
            source_file: relPath,
            content,
        });
        console.log(`  Found: ${relPath}`);
    } catch (e) {
        console.warn(`  Could not read ${relPath}: ${e}`);
    }
}

function* batchArray<T>(array: T[], size: number) {
    for (let i = 0; i < array.length; i += size) {
        yield array.slice(i, i + size);
    }
}

const allResults: Array<unknown> = [];
//for (const batch of batchArray(aggregated, 2)) { 
for (const batch of batchArray(aggregated.slice(0, 20), 2)) { // Temporary hardcoded batch for testing
//for (const batch of [[aggregated[0]]]) { // Temporary hardcoded batch for testing
    console.log(`  Processing batch with ${batch.length} files...`);
    const res = await fetchWithRetry(
        `${albertBase}v1/chat/completions`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${albertApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
                /*response_format: {
                    type: "json_object"
                },*/
                messages: [
                    {
                        role: "system",
                        content: `
           Tu reçois un JSON avec deux clefs :
           - "files" les fichiers à analyser, avec la source et le contenu du document
           - "instruction" les clés à extraire du contenu du document. 
           
           Tu retournes UNIQUEMENT un tableau JSON valide.

Règles obligatoires :

* La réponse doit être un JSON valide parsable par un parser JSON standard.
* Ne retourne aucun texte avant ou après le JSON.
* Ne retourne jamais de Markdown.
* Ne retourne jamais de triple backquotes.
* Ne retourne jamais de préfixe "json".
* Ne retourne jamais d'explication, de commentaire ou de note.
* La racine du document doit être un tableau JSON.
* Chaque élément du tableau doit être un objet JSON.
* La première ligne de ta réponse doit donc être un '[' et la dernière ligne doit être un ']'.
* Ajoute la clé source_file qui correspond au fichier dans lequel tu as trouvé les informations.

Pour chaque élément extrait dans la key "content", utilise le "source_file" associé.
Ne déduis jamais le source_file à partir d'un autre document.

Contraintes :

* Conserve les valeurs exactement telles qu'elles apparaissent dans le document.
* Ne modifie pas les unités.
* Ne reformule pas les descriptions.
* Ne traduis aucun texte.
* Si une valeur est absente, utilise null.
* Respecte l'encodage UTF-8.
* Les chaînes doivent être correctement échappées selon la spécification JSON.
`
                    },
                    {
                        role: "user",
                        content: JSON.stringify({
                            files: batch,
                            instruction: prompt,
                        })
                    }
                ]
            })
        }
    );

    if (!res.ok) {
        const responseText = await res.text();
        console.error(`❌ Albert API error (status ${res.status} ${res.statusText}):`);
        console.error(`   Response: ${responseText.slice(0, 500)}`);
        Deno.exit(1);
    }

    let data: any;
    try {
        data = await res.json();
    } catch (e) {
        const responseText = await res.text();
        console.error(`❌ Failed to parse Albert response as JSON:`);
        console.error(`   Error: ${e}`);
        console.error(`   Response (first 500 chars): ${responseText.slice(0, 500)}`);
        console.error(`   Content-Type: ${res.headers.get('content-type')}`);
        Deno.exit(1);
    }

    if (!data.choices || data.choices.length === 0) {
        console.error(`❌ Albert API error (no choices in response):`);
        console.error(`   ${JSON.stringify(data).slice(0, 500)}`);
        Deno.exit(1);
    }


    const batchResponse = data.choices[0].message.content;
    const batchResults = JSON.parse(batchResponse);
    allResults.push(...(Array.isArray(batchResults) ? batchResults : [batchResults]));
}

console.log(`Received ${allResults.length} total results from all batches.`);

const outDir = join(repo, scriptDefiniton.outputFolder);
try { await Deno.mkdir(outDir, { recursive: true }); } catch (_) { }
await Deno.writeTextFile(join(outDir, 'structure.txt'), JSON.stringify(allResults, null, 2));
await Deno.writeTextFile(join(outDir, 'structure.json'), JSON.stringify(allResults, null, 2));
await Deno.writeTextFile(join(outDir, 'structure.csv'), stringify(allResults, { header: true, columns: Object.keys(allResults[0] || {}) }));
console.log(`Saved Albert extract structure response to ${outDir}/structure.txt, structure.json, and structure.csv`);

const runRecordId = await addRunRecordToGrist(options, collectionRecordId, scriptDefiniton.toolName, scriptDefiniton.runName, inputGristIds, null, JSON.stringify({
    prompt: prompt,
    inputRegex: inputRegex,
    matchedFileCount: aggregated.length,
}), existingRunId);

addFileRecordsToGrist(options, collectionRecordId, runRecordId, "dat", ['structure.txt', 'structure.json', 'structure.csv'].map(f => join(outDir, f)));
logScriptEnd(scriptDefiniton, runRecordId);