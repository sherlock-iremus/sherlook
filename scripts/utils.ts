const {
  createHash,
} = await import('node:crypto');
import pdfParse from 'npm:pdf-parse@1.1.1';

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