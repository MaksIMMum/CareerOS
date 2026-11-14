import { describe, expect, it } from 'vitest';
import { cvInputSchema, LIMITS, vacancyInputSchema } from './validation.js';

describe('cvInputSchema', () => {
  it('accepts a named CV and trims whitespace', () => {
    expect(cvInputSchema.parse({ name: '  Backend CV ', text: ' Node.js dev ' })).toEqual({
      name: 'Backend CV',
      text: 'Node.js dev',
    });
  });

  it('allows exactly 15,000 characters of text and rejects 15,001', () => {
    expect(cvInputSchema.safeParse({ name: 'x', text: 'a'.repeat(LIMITS.CV_TEXT_MAX) }).success).toBe(true);
    expect(cvInputSchema.safeParse({ name: 'x', text: 'a'.repeat(LIMITS.CV_TEXT_MAX + 1) }).success).toBe(false);
  });

  it('counts Cyrillic characters, not bytes', () => {
    expect(cvInputSchema.safeParse({ name: 'Резюме', text: 'ї'.repeat(15_000) }).success).toBe(true);
  });

  it('rejects empty or whitespace-only names and text, and wrong types', () => {
    expect(cvInputSchema.safeParse({ name: '   ', text: 'x' }).success).toBe(false);
    expect(cvInputSchema.safeParse({ name: 'x', text: '\n\t ' }).success).toBe(false);
    expect(cvInputSchema.safeParse({ name: 'x', text: 42 }).success).toBe(false);
    expect(cvInputSchema.safeParse({ name: 'a'.repeat(81), text: 'x' }).success).toBe(false);
  });

  it('drops unknown fields such as a forged PK or id', () => {
    const parsed = cvInputSchema.parse({ name: 'x', text: 'y', PK: 'USER#victim', id: 'z' });
    expect(parsed).toEqual({ name: 'x', text: 'y' });
  });
});

describe('vacancyInputSchema', () => {
  const base = { title: 'Junior Backend Developer', text: 'We need Node.js' };

  it('defaults company and url to empty strings', () => {
    expect(vacancyInputSchema.parse(base)).toEqual({ ...base, company: '', url: '' });
  });

  it('accepts http(s) URLs and rejects other schemes or junk', () => {
    expect(vacancyInputSchema.safeParse({ ...base, url: 'https://jobs.dou.ua/vacancies/1/' }).success).toBe(true);
    expect(vacancyInputSchema.safeParse({ ...base, url: 'javascript:alert(1)' }).success).toBe(false);
    expect(vacancyInputSchema.safeParse({ ...base, url: 'ftp://example.com' }).success).toBe(false);
    expect(vacancyInputSchema.safeParse({ ...base, url: 'not a url' }).success).toBe(false);
  });

  it('limits vacancy text to 10,000 characters', () => {
    expect(vacancyInputSchema.safeParse({ ...base, text: 'a'.repeat(10_000) }).success).toBe(true);
    expect(vacancyInputSchema.safeParse({ ...base, text: 'a'.repeat(10_001) }).success).toBe(false);
  });
});
