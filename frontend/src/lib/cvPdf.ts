import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/**
 * Builds a simple, readable A4 PDF from a saved CV (name + plain text).
 * Kept free of browser APIs so it can be unit-tested in Node; fonts are passed in
 * because the standard 14 PDF fonts have no Cyrillic glyphs.
 */

export interface CvPdfFonts {
  regular: Uint8Array | ArrayBuffer;
  bold: Uint8Array | ArrayBuffer;
}

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN = 56;
const TITLE_SIZE = 18;
const BODY_SIZE = 11;
const BODY_LEADING = 15.5;
const FOOTER_SIZE = 9;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.45, 0.45, 0.5);

/** Tabs → spaces, CRLF → LF, other control characters (which have no glyphs) removed. */
export function sanitizeCvText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f​﻿]/g, '');
}

/**
 * Word-wraps one paragraph to `maxWidth` using `measure` (text → width).
 * Words longer than a full line (URLs, etc.) are broken by characters.
 */
export function wrapLine(line: string, maxWidth: number, measure: (s: string) => number): string[] {
  if (line.trim() === '') return [''];
  const indent = line.match(/^ */)?.[0] ?? '';
  const words = line.slice(indent.length).split(/ +/).filter(Boolean);
  const out: string[] = [];
  let current = indent;

  const pushLongWord = (word: string) => {
    let chunk = '';
    for (const ch of Array.from(word)) {
      if (chunk && measure(chunk + ch) > maxWidth) {
        out.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const candidate = current.trim() === '' ? current + word : `${current} ${word}`;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
    } else if (current.trim() === '') {
      current = pushLongWord(current + word);
    } else {
      out.push(current);
      current = measure(word) <= maxWidth ? word : pushLongWord(word);
    }
  }
  out.push(current);
  return out;
}

export async function buildCvPdf(cv: { name: string; text: string }, fonts: CvPdfFonts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fonts.regular, { subset: true });
  const bold = await doc.embedFont(fonts.bold, { subset: true });

  const name = sanitizeCvText(cv.name).replace(/\n/g, ' ').trim() || 'CV';
  doc.setTitle(name);
  doc.setCreator('CareerOS');
  doc.setProducer('CareerOS');

  const contentWidth = PAGE.width - 2 * MARGIN;
  const measure = (font: PDFFont, size: number) => (s: string) => font.widthOfTextAtSize(s, size);

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const newPage = () => {
    page = doc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };

  // Title
  for (const line of wrapLine(name, contentWidth, measure(bold, TITLE_SIZE))) {
    y -= TITLE_SIZE;
    page.drawText(line, { x: MARGIN, y, size: TITLE_SIZE, font: bold, color: INK });
    y -= 6;
  }
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE.width - MARGIN, y },
    thickness: 0.75,
    color: MUTED,
  });
  y -= 14;

  // Body
  const bottom = MARGIN + FOOTER_SIZE + 12;
  for (const paragraph of sanitizeCvText(cv.text).trim().split('\n')) {
    for (const line of wrapLine(paragraph.trimEnd(), contentWidth, measure(regular, BODY_SIZE))) {
      if (y - BODY_LEADING < bottom) newPage();
      y -= BODY_LEADING;
      if (line) page.drawText(line, { x: MARGIN, y, size: BODY_SIZE, font: regular, color: INK });
    }
  }

  // Page numbers, only when there is more than one page
  const pages = doc.getPages();
  if (pages.length > 1) {
    pages.forEach((p, i) => {
      const label = `${i + 1} / ${pages.length}`;
      const w = regular.widthOfTextAtSize(label, FOOTER_SIZE);
      p.drawText(label, { x: (PAGE.width - w) / 2, y: MARGIN - 20, size: FOOTER_SIZE, font: regular, color: MUTED });
    });
  }

  return doc.save();
}
