import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { buildCvPdf, labelRuns, parseCv, sanitizeCvText, wrapLine, wrapRuns } from './cvPdf.js';

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

  it('returns one empty line for blank input', () => {
    expect(wrapLine('   ', 20, charWidth)).toEqual(['']);
  });
});

describe('wrapRuns', () => {
  it('keeps styles per word and merges neighbouring runs', () => {
    const lines = wrapRuns([{ text: 'Мови:', bold: true }, { text: 'TypeScript, Python' }], 18, charWidth);
    expect(lines).toEqual([
      [{ text: 'Мови:', bold: true }, { text: ' TypeScript,', bold: false }],
      [{ text: 'Python', bold: false }],
    ]);
  });
});

describe('labelRuns', () => {
  it('bolds a short "Label:" prefix', () => {
    expect(labelRuns('Мови: TypeScript, Python')).toEqual([{ text: 'Мови:', bold: true }, { text: 'TypeScript, Python' }]);
  });

  it('leaves URLs, times and long sentences alone', () => {
    expect(labelRuns('https://github.com/x')).toEqual([{ text: 'https://github.com/x' }]);
    expect(labelRuns('Meeting at 10: 30 today')).toEqual([{ text: 'Meeting at 10: 30 today' }]);
    expect(labelRuns('I worked on many different things: APIs')).toHaveLength(1);
  });
});

describe('parseCv', () => {
  const kinds = (text: string) => parseCv(text).map((b) => b.kind);

  it('recognises name, contacts, headings, bullets and paragraphs', () => {
    const blocks = parseCv(
      'Олена Коваленко\nJunior Backend Developer\nКиїв · olena@example.com\n\nДосвід роботи\nIntern — SoftServe\n• Розробила API\n- Тести (Jest)\n\nНАВИЧКИ\nМови: TypeScript',
    );
    expect(blocks).toEqual([
      { kind: 'name', text: 'Олена Коваленко' },
      { kind: 'contact', text: 'Junior Backend Developer' },
      { kind: 'contact', text: 'Київ · olena@example.com' },
      { kind: 'heading', text: 'Досвід роботи' },
      { kind: 'para', runs: [{ text: 'Intern — SoftServe' }] },
      { kind: 'bullet', marker: '•', runs: [{ text: 'Розробила API' }] },
      { kind: 'bullet', marker: '•', runs: [{ text: 'Тести (Jest)' }] },
      { kind: 'heading', text: 'НАВИЧКИ' },
      { kind: 'para', runs: [{ text: 'Мови:', bold: true }, { text: 'TypeScript' }] },
    ]);
  });

  it('treats an ALL-CAPS or markdown first line as the name', () => {
    expect(parseCv('JOHN SMITH\nSUMMARY\nText')[0]).toEqual({ kind: 'name', text: 'JOHN SMITH' });
    expect(parseCv('# John Smith\n## Skills\nGit')[0]).toEqual({ kind: 'name', text: 'John Smith' });
    expect(kinds('# John Smith\n## Skills\nGit')).toEqual(['name', 'heading', 'para']);
  });

  it('does not take a section title or a sentence for the name', () => {
    expect(kinds('Experience\nQA intern')).toEqual(['heading', 'para']);
    expect(parseCv('I am a junior developer with experience in Node.js and AWS.')[0]!.kind).toBe('para');
  });

  it('keeps numbered lists and strips markdown bold', () => {
    expect(parseCv('Text\n1. **First** step\n2) Second')).toMatchObject([
      { kind: 'name' },
      { kind: 'bullet', marker: '1.', runs: [{ text: 'First step' }] },
      { kind: 'bullet', marker: '2)', runs: [{ text: 'Second' }] },
    ]);
  });

  it('does not treat skill lists in caps or hyphenated words as headings or bullets', () => {
    expect(kinds('Name\n\nSkills\nAWS, SQL, REST\n-not a bullet')).toEqual(['name', 'heading', 'para', 'para']);
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
    expect(text).toContain('Віталій Волоський');
    expect(text).toContain('ДОСВІД РОБОТИ');
    expect(text).toContain('Node.js, TypeScript');
  });

  it('spreads long CVs over several pages with page numbers', async () => {
    const text = Array.from({ length: 120 }, (_, i) => `Рядок ${i + 1}`).join('\n');
    const { numPages, text: out } = await readPdf(await buildCvPdf({ name: 'Довге CV', text }, fonts));
    expect(numPages).toBeGreaterThan(1);
    expect(out).toContain('Рядок 120');
    expect(out).toContain(`1 / ${numPages}`);
  });

  it('uses the version name as the header when the CV has no name line', async () => {
    const { text } = await readPdf(await buildCvPdf({ name: 'General CV', text: 'Skills:\nGit, Docker' }, fonts));
    expect(text).toContain('General CV');
    expect(text).toContain('SKILLS');
  });
});
