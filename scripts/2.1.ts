import { Command } from 'jsr:@cliffy/command@1.0.0';
import { PDFDocument } from "https://esm.sh/pdf-lib";

const { options } = await new Command()
  .name('SHERLOOK 👾')
  .description('🌴')
  .version('v1.0.0')
  .option('--repo <repo:string>')
  .parse();

console.log(options);

// const inputBytes = await Deno.readFile("test.pdf");
// const inputPdf = await PDFDocument.load(inputBytes);

// const pageCount = inputPdf.getPageCount();

// for (let i = 0; i < pageCount; i++) {
//   const newPdf = await PDFDocument.create();

//   const [page] = await newPdf.copyPages(inputPdf, [i]);
//   newPdf.addPage(page);

//   const pdfBytes = await newPdf.save();
//   await Deno.writeFile(`page-${i + 1}.pdf`, pdfBytes);
// }