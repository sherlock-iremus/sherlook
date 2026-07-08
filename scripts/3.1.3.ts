import { Command } from 'jsr:@cliffy/command@1.0.0';
import { walk } from 'jsr:@std/fs@0.224.0';
import { join, relative } from 'jsr:@std/path@0.224.0';
import { stringify } from "@std/csv";
import { fetchRecords as fetchGristRecords } from "https://raw.githubusercontent.com/sherlock-iremus/sherlock-deno/refs/heads/main/common-grist.ts";
import { addFileRecordsToGrist, addRunRecordToGrist, getRunName } from './utils.ts';

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

const { repo, prompt, inputRegex } = options;
const { albertBase, albertApiKey } = options;
const tool = "Albert Extract Structure From Files";

// Parse regex
let re: RegExp | null = null;
if (inputRegex) {
    try {
        re = new RegExp(inputRegex);
    } catch (e) {
        console.error('Invalid input-regex:', e.message || e);
        Deno.exit(1);
    }
}

// Find and read matching files
console.log(`Searching for files matching regex: ${inputRegex}`);
const aggregated: Array<{ source_file: string; content: string }> = [];

for await (const entry of walk(repo)) {
    if (!entry.isFile) continue;
    const p = entry.path;
    const relPath = relative(repo, p);

    if (re && re.test(p)) {
        try {
            const content = await Deno.readTextFile(p);
            aggregated.push({
                source_file: relPath,
                content: content
            });
            console.log(`  Found: ${relPath}`);
        } catch (e) {
            console.warn(`  Could not read ${relPath}: ${e}`);
        }
    }
}

if (aggregated.length === 0) {
    console.error(`No files found matching regex: ${inputRegex}`);
    Deno.exit(1);
}

console.log(`Aggregated ${aggregated.length} files. Querying Albert in batches of 10...`);

// Batch files in groups of 10
function* batchArray<T>(array: T[], size: number) {
    for (let i = 0; i < array.length; i += size) {
        yield array.slice(i, i + size);
    }
}

// Process each batch and collect results
const allResults: Array<unknown> = [];
for (const batch of batchArray(aggregated, 10)) {
    console.log(`  Processing batch with ${batch.length} files...`);
    
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

    const data = await res.json();

    if (!data.choices || data.choices.length === 0) {
        console.error(`Albert API error: ${JSON.stringify(data)}`);
        Deno.exit(1);
    }

    const batchResponse = data.choices[0].message.content;
    const batchResults = JSON.parse(batchResponse);
    allResults.push(...(Array.isArray(batchResults) ? batchResults : [batchResults]));
}

console.log(`Received ${allResults.length} total results from all batches.`);

const outDir = join(repo, '/dat', getRunName(options.runName, tool));
try { await Deno.mkdir(outDir, { recursive: true }); } catch (_) { }
await Deno.writeTextFile(join(outDir, 'structure.txt'), JSON.stringify(allResults, null, 2));
await Deno.writeTextFile(join(outDir, 'structure.json'), JSON.stringify(allResults, null, 2));
await Deno.writeTextFile(join(outDir, 'structure.csv'), stringify(allResults, { header: true, columns: Object.keys(allResults[0] || {}) }));
console.log(`Saved Albert extract structure response to ${outDir}/structure.txt, structure.json, and structure.csv`);

// Create a Grist run record
const collectionRecords: CollectionRecord[] = await fetchGristRecords(
    options.gristBase,
    options.gristApiKey,
    options.gristDocId,
    options.gristCollectionTableId
);
const existingCollectionId = collectionRecords.find(r => r.fields.UUID === options.collectionUuid)?.id;
if (!existingCollectionId) {
    console.error('Could not find collection in Grist with provided UUID');
    Deno.exit(1);
}

const runRecordId = await addRunRecordToGrist(options, existingCollectionId, tool, options.runName, [], null, JSON.stringify({
    prompt: prompt,
    inputRegex: inputRegex,
    matchedFileCount: aggregated.length,
}));

if (!runRecordId) {
    console.error('Could not create run record in Grist');
    Deno.exit(1);
}

addFileRecordsToGrist(options, existingCollectionId, runRecordId, "dat", ['structure.txt', 'structure.json', 'structure.csv'].map(f => join(outDir, f)));
