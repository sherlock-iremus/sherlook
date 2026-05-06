import { Command } from 'jsr:@cliffy/command@1.0.0';
import { PDFDocument } from "https://esm.sh/pdf-lib";
import { walk } from "jsr:@std/fs@0.224.0";
import { join, basename, extname } from "jsr:@std/path@0.224.0";
import { RAW_FOLDER_PATH, GEN_FOLDER_PATH } from './consts.ts';

const { options } = await new Command()
  .name('SHERLOOK 👾')
  .description('🌴')
  .version('v1.0.0')
  .option('--repo <repo:string>')
  .parse();

console.log(options);

const repoPath = options.repo;
for await (const entry of walk(repoPath + RAW_FOLDER_PATH, { maxDepth: 1 })) {
  if (!entry.isFile) continue;
  if (extname(entry.path).toLowerCase() !== ".pdf") continue;

  const inputBytes = await Deno.readFile(entry.path);
  const inputPdf = await PDFDocument.load(inputBytes);
  const pageCount = inputPdf.getPageCount();
  const base = basename(entry.path, ".pdf");

  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [page] = await newPdf.copyPages(inputPdf, [i]);
    newPdf.addPage(page);
    const pdfBytes = await newPdf.save();
    const outName = `${base}-${String(i + 1).padStart(String(pageCount).length, "0")}.pdf`;
    await Deno.writeFile(join(repoPath, GEN_FOLDER_PATH, outName), pdfBytes);
    console.log(`Wrote ${outName}`);
  }
}