import { LIMITS } from './limits.js';

interface TextItemLike {
  str?: string;
  hasEOL?: boolean;
}

/** Joins pdf.js text items of one page, keeping the line breaks pdf.js reports. */
export function textItemsToString(items: TextItemLike[]): string {
  let out = '';
  for (const item of items) {
    if (typeof item.str !== 'string') continue; // marked-content items carry no text
    out += item.str;
    if (item.hasEOL) out += '\n';
  }
  return out;
}

/** Collapses the spacing noise PDF extraction produces, without merging paragraphs. */
export function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class PdfExtractError extends Error {
  constructor(public readonly code: 'too_large' | 'not_pdf' | 'no_text' | 'unreadable') {
    super(code);
    this.name = 'PdfExtractError';
  }
}

/**
 * Extracts text from a PDF entirely in the browser (the file is never uploaded).
 * pdf.js is loaded on demand so it doesn't weigh down the first page load. The legacy build
 * is used so older phone browsers work too.
 */
export async function extractPdfText(file: File): Promise<{ text: string; pages: number }> {
  if (file.size > LIMITS.PDF_MAX_BYTES) throw new PdfExtractError('too_large');
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new PdfExtractError('not_pdf');
  }

  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
      .promise;
  } catch {
    throw new PdfExtractError('unreadable');
  }

  try {
    const pages = Math.min(doc.numPages, LIMITS.PDF_MAX_PAGES);
    const parts: string[] = [];
    for (let n = 1; n <= pages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      parts.push(textItemsToString(content.items as TextItemLike[]));
      page.cleanup();
    }
    const text = normalizeExtractedText(parts.join('\n\n'));
    // Scanned CVs are images: pdf.js finds no text layer.
    if (!text) throw new PdfExtractError('no_text');
    return { text, pages: doc.numPages };
  } finally {
    void doc.destroy();
  }
}
