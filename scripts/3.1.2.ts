import { Command } from "jsr:@cliffy/command@1.0.0";
import { join } from "jsr:@std/path@0.224.0";
import { stringify } from "@std/csv";
import {
  addFileRecordsToGrist,
  addRunRecordToGrist,
  getCorrespondingCollectionId,
  getCorrespondingRunId,
  getRunName,
  getScriptDefinition,
  logScriptEnd,
  logScriptStart,
  SCRIPT_TYPE,
  ScriptDefinition,
} from "./utils.ts";
import { DAT_FOLDER_PATH, GEN_FOLDER_PATH } from "./consts.ts";

const { options } = await new Command()
  .name("SHERLOOK 3.1")
  .description(
    "Iterate files matching input regex under repo and print matches",
  )
  .option("--repo <repo:string>", "")
  .option("--collection-uuid <collection-uuid:string>", "")
  .option("--grist-api-key <grist-api-key:string>", "")
  .option("--grist-base <grist-base:string>", "")
  .option("--grist-doc-id <grist-doc-id:string>", "")
  .option("--grist-files-table-id <grist-files-table-id:string>", "")
  .option("--grist-run-table-id <grist-run-table-id:string>", "")
  .option("--grist-collection-table-id <grist-collection-table-id:string>", "")
  .option("--run-name <run-name:string>", "Run name (required)")
  .option("--prompt <prompt:string>", "")
  .option("--albert-base <albert-base:string>", "")
  .option("--albert-api-key <albert-api-key:string>", "")
  .option("--albert-collection-id <albert-collection-id:string>", "")
  .parse();

if (!options.runName) {
  console.error("Missing required --run-name");
  Deno.exit(1);
}

const {
  repo,
  prompt,
  albertCollectionId,
  albertBase,
  albertApiKey,
  collectionUuid,
} = options;
const scriptDefiniton: ScriptDefinition = getScriptDefinition(
  "Albert Extract Structure With Collection Search Tool",
  SCRIPT_TYPE.indeterministic,
  options.runName,
  GEN_FOLDER_PATH,
  DAT_FOLDER_PATH,
);

logScriptStart(scriptDefiniton);
const collectionRecordId = await getCorrespondingCollectionId(
  options,
  collectionUuid,
);
const existingRunId = await getCorrespondingRunId(
  options,
  collectionRecordId,
  scriptDefiniton.runName,
);

const res = await fetch(
  `${albertBase}v1/chat/completions`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${albertApiKey}`,
      "Content-Type": "application/json",
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
`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      tools: [
        {
          type: "search",
          collection_ids: [albertCollectionId],
          method: "hybrid",
          limit: 3,
        },
      ],
      tool_choice: "auto",
    }),
  },
);

const data = await res.json();
console.log(data);
const outDir = join(repo, scriptDefiniton.outputFolder);
try {
  await Deno.mkdir(outDir, { recursive: true });
} catch (_) {}
const response = data.choices[0].message.content;
await Deno.writeTextFile(join(outDir, "structure.txt"), response);
await Deno.writeTextFile(
  join(outDir, "structure.json"),
  JSON.stringify(JSON.parse(response), null, 2),
);
await Deno.writeTextFile(
  join(outDir, "structure.csv"),
  stringify(JSON.parse(response), {
    header: true,
    columns: Object.keys(JSON.parse(response)[0] || {}),
  }),
);
console.log(
  `Saved Albert extract structure response to ${outDir}/structure.txt, structure.json, and structure.csv`,
);

const runRecordId = await addRunRecordToGrist(
  options,
  collectionRecordId,
  scriptDefiniton.toolName,
  scriptDefiniton.runName,
  [],
  null,
  JSON.stringify({
    prompt: prompt,
    albertCollectionId: albertCollectionId,
  }),
  existingRunId,
);

addFileRecordsToGrist(
  options,
  collectionRecordId,
  runRecordId,
  "dat",
  ["structure.txt", "structure.json", "structure.csv"].map((f) =>
    join(outDir, f)
  ),
);
logScriptEnd(scriptDefiniton, runRecordId);
