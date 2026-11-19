import { describe, it, expect } from 'vitest';
import { cvFileName } from './download.js';

describe('cvFileName', () => {
  it('keeps a normal name and adds .pdf', () => {
    expect(cvFileName('Backend CV')).toBe('Backend CV.pdf');
  });

  it('keeps Cyrillic', () => {
    expect(cvFileName('Загальне CV')).toBe('Загальне CV.pdf');
  });

  it('replaces characters that are invalid in file names', () => {
    expect(cvFileName('a/b\\c:d*e?"f<g>h|i')).toBe('a b c d e f g h i.pdf');
  });

  it('strips leading dots and collapses whitespace', () => {
    expect(cvFileName('  ..hidden   name  ')).toBe('hidden name.pdf');
  });

  it('falls back to "CV" when nothing usable is left', () => {
    expect(cvFileName(' / ')).toBe('CV.pdf');
  });

  it('limits the length', () => {
    expect(cvFileName('x'.repeat(300))).toBe(`${'x'.repeat(100)}.pdf`);
  });
});
