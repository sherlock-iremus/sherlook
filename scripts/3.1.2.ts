import { Command } from 'jsr:@cliffy/command@1.0.0';
import { join, basename } from 'jsr:@std/path@0.224.0';
import { stringify } from "@std/csv";
import { fetchRecords as fetchGristRecords } from "https://raw.githubusercontent.com/sherlock-iremus/sherlock-deno/refs/heads/main/common-grist.ts";
import { addFileRecordsToGrist, addRunRecordToGrist, getRunName } from './utils.ts';

const { options } = await new Command()
  .name('SHERLOOK 3.1')
  .description('Iterate files matching input regex under repo and print matches')
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
  .option('--albert-collection-id <albert-collection-id:string>', '')
  .parse();

const { repo, prompt, albertCollectionId } = options;
const { albertBase, albertApiKey } = options;
const tool = "Albert Extract Structure";

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
          content:
          /* csv */
          /*
            `Tu retournes exclusivement le contenu CSV brut.
            N'ajoute jamais de balises Markdown, de triple backquotes, de préfixe "csv", d'explication ou de commentaire.
            La première ligne doit être l'en-tête CSV.
            - Toutes les valeurs doivent être entourées de guillemets doubles.
            - Les guillemets présents dans les données doivent être échappés en les doublant (" -> "").
            Rajoute une colonne supplémentaire nommée source_file (dans le texte: "source file: <nom du fichier>") qui correspond au fichier dans lequel se trouve information que tu as relevée.
            Si tu ne trouves pas d'information pour cette colonne, ne renseigne surtout rien.`
          */ 
          /* json */ `
           Tu extrais les informations du document et tu retournes UNIQUEMENT un tableau JSON valide.

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
* Ajoute la clé suivante :
* 
Pour chaque élément extrait, utilise le source_file du document dans lequel l'information apparaît.
Ne déduis jamais le source_file à partir d'un autre document.

Si tu ne trouves pas d'information pour cette clé, ne renseigne surtout rien.

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
          content: prompt
        }
      ],
      tools: [
        {
          type: "search",
          collection_ids: [albertCollectionId],
          method: "hybrid",
          limit: 100
        }
      ],
      tool_choice: "auto"
    })
  }
);

const data = await res.json();

const outDir = join(repo, '/dat', getRunName(options.runName, tool));
try { await Deno.mkdir(outDir, { recursive: true }); } catch (_) { }
const response = data.choices[0].message.content;
await Deno.writeTextFile(join(outDir, 'structure.txt'), response);
await Deno.writeTextFile(join(outDir, 'structure.json'), JSON.stringify(JSON.parse(response), null, 2));
await Deno.writeTextFile(join(outDir, 'structure.csv'), stringify(JSON.parse(response), { header: true, columns: Object.keys(JSON.parse(response)[0] || {}) }));
console.log(`Saved Albert extract structure response to ${outDir}/structure.txt, structure.json, and structure.csv`);


// Create a Grist run record linking input files (those matched in Grist) and then record the output file
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
  albertCollectionId: albertCollectionId,
}));

if (!runRecordId) {
  console.error('Could not create run record in Grist');
  Deno.exit(1);
}

addFileRecordsToGrist(options, existingCollectionId, runRecordId, "dat", ['structure.txt', 'structure.json', 'structure.csv'].map(f => join(outDir, f)));
