import { describe, expect, it } from 'vitest';
import { normalizeExtractedText, textItemsToString } from './pdf.js';

describe('textItemsToString', () => {
  it('joins items and keeps pdf.js line breaks', () => {
    const items = [
      { str: 'Vitalii', hasEOL: false },
      { str: ' Voloskyi', hasEOL: true },
      { str: 'Junior Backend Developer', hasEOL: true },
      {} /* marked content */,
      { str: 'Node.js, TypeScript', hasEOL: false },
    ];
    expect(textItemsToString(items)).toBe('Vitalii Voloskyi\nJunior Backend Developer\nNode.js, TypeScript');
  });
});

describe('normalizeExtractedText', () => {
  it('collapses repeated spaces, tabs and blank lines but keeps paragraphs', () => {
    const raw = '  Досвід  \t роботи \r\n\r\n\r\n\r\n• Node.js  API  \n';
    expect(normalizeExtractedText(raw)).toBe('Досвід роботи\n\n• Node.js API');
  });

  it('returns an empty string for whitespace-only (scanned) PDFs', () => {
    expect(normalizeExtractedText(' \n \n\t')).toBe('');
  });
});
