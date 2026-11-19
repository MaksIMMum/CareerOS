import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildCvPdf, sanitizeCvText, wrapLine } from './cvPdf.js';

const font = (file: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`../assets/fonts/${file}`, import.meta.url))));
const fonts = { regular: font('NotoSans-Regular.ttf'), bold: font('NotoSans-Bold.ttf') };
const charWidth = (s: string) => Array.from(s).length; // 1 unit per character

async function readPdf(bytes: Uint8Array) {
  const pdf = await getDocument({ data: bytes, useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
  }
  return { numPages: pdf.numPages, text: pages.join('\n'), title: ((await pdf.getMetadata()).info as { Title?: string }).Title };
}

describe('wrapLine', () => {
  it('keeps short lines as they are', () => {
    expect(wrapLine('Node.js developer', 40, charWidth)).toEqual(['Node.js developer']);
  });

  it('wraps on word boundaries', () => {
    expect(wrapLine('one two three four', 9, charWidth)).toEqual(['one two', 'three', 'four']);
  });

  it('breaks words that are longer than a line', () => {
    expect(wrapLine('https://example.com/x', 8, charWidth)).toEqual(['https://', 'example.', 'com/x']);
  });

  it('keeps leading indentation and empty lines', () => {
    expect(wrapLine('  • item', 20, charWidth)).toEqual(['  • item']);
    expect(wrapLine('   ', 20, charWidth)).toEqual(['']);
  });
});

describe('sanitizeCvText', () => {
  it('normalizes line endings, tabs and control characters', () => {
    expect(sanitizeCvText('a\r\nb\tc\u0007﻿d')).toBe('a\nb    cd');
  });
});

describe('buildCvPdf', () => {
  it('produces a PDF with the name and Cyrillic text intact', async () => {
    const bytes = await buildCvPdf(
      { name: 'Backend CV', text: 'Віталій Волоський\nДосвід роботи\n• Node.js, TypeScript — REST API 🚀' },
      fonts,
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const { numPages, text, title } = await readPdf(bytes);
    expect(numPages).toBe(1);
    expect(title).toBe('Backend CV');
    expect(text).toContain('Backend CV');
    expect(text).toContain('Віталій Волоський');
    expect(text).toContain('Node.js, TypeScript');
  });

  it('spreads long CVs over several pages with page numbers', async () => {
    const text = Array.from({ length: 120 }, (_, i) => `Рядок ${i + 1}`).join('\n');
    const { numPages, text: out } = await readPdf(await buildCvPdf({ name: 'Довге CV', text }, fonts));
    expect(numPages).toBeGreaterThan(1);
    expect(out).toContain('Рядок 120');
    expect(out).toContain(`1 / ${numPages}`);
  });
});
