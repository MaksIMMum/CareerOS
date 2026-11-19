import { describe, it, expect } from 'vitest';
import { pdfFileName } from './download.js';

describe('pdfFileName', () => {
  it('keeps a normal name and adds .pdf', () => {
    expect(pdfFileName('Backend CV')).toBe('Backend CV.pdf');
  });

  it('keeps Cyrillic', () => {
    expect(pdfFileName('Загальне CV')).toBe('Загальне CV.pdf');
  });

  it('replaces characters that are invalid in file names', () => {
    expect(pdfFileName('a/b\\c:d*e?"f<g>h|i')).toBe('a b c d e f g h i.pdf');
  });

  it('strips leading dots and collapses whitespace', () => {
    expect(pdfFileName('  ..hidden   name  ')).toBe('hidden name.pdf');
  });

  it('falls back to "CV" when nothing usable is left', () => {
    expect(pdfFileName(' / ')).toBe('CV.pdf');
  });

  it('limits the length', () => {
    expect(pdfFileName('x'.repeat(300))).toBe(`${'x'.repeat(100)}.pdf`);
  });

  it('uses the given fallback name', () => {
    expect(pdfFileName('', 'Cover letter')).toBe('Cover letter.pdf');
  });
});
