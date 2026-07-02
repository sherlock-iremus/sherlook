import { Command } from 'jsr:@cliffy/command@1.0.0';
import { join, basename } from 'jsr:@std/path@0.224.0';
import { getRunName } from './utils.ts';

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
            `Tu extrais des informations des documents et tu retournes UNIQUEMENT un CSV avec les colonnes spécifiées, pas de texte juste un CSV. Rajoute une colonne supplémentaire nommée source et contient l'identifiant du chunk du document. Si tu ne trouves pas d'information pour cette colonne, essaie de trouver quoique ce soit qui soit relevant pour toi`
        },
        {
          role: "user",
          content: "tu trouves quoi sur ces documents ?"//prompt
        }
      ],
      tools: [
        {
          type: "search",
          collection_ids: [albertCollectionId],
          method: "hybrid",
          limit: 2
        }
      ],
      tool_choice: "auto"
    })
  }
);

const data = await res.json();

console.log(data);
const outDir = join(repo, '/dat', getRunName(options.runName, tool));
try { await Deno.mkdir(outDir, { recursive: true }); } catch (_) { }
const outPath = join(outDir, 'albert-extract-structure-response.csv');
await Deno.writeTextFile(outPath, data.choices[0].message.content);
console.log(`Saved Albert extract structure response to ${outPath}`);
