import { describe, expect, it } from 'vitest';
import { NO_INVENT_RULE } from './llm.js';
import { buildCoverLetterPrompt, checkCoverLetter, transliterate, type AnalysisResult } from './analysis.js';

const CV = 'Олена Коваленко\nKyiv\nКПІ, Інженерія ПЗ, 2022–2026\nNode.js, TypeScript, PostgreSQL';
const result: AnalysisResult = {
  matchScore: 60,
  summary: 's',
  matchedSkills: ['Node.js', 'TypeScript'],
  missingSkills: [{ skill: 'Docker', advice: 'a' }],
  missingKeywords: ['Kubernetes'],
  weakBullets: [],
  improvedCv: CV,
};

describe('transliterate', () => {
  it('romanises Ukrainian and keeps everything else', () => {
    expect(transliterate('КПІ, Київ, Щастя, Node.js')).toBe('KPI, Kyiv, Shchastia, Node.js');
  });
});

describe('checkCoverLetter', () => {
  it('accepts names from the CV written in Latin letters (letter in another language)', () => {
    const letter = 'I study Software Engineering at KPI and use Node.js and TypeScript.';
    expect(checkCoverLetter(CV, letter, result)).toEqual({ skills: [], numbers: [] });
  });

  it('flags vacancy skills and numbers that the CV does not have', () => {
    const letter = 'I have 3 years of experience with Docker and Kubernetes.';
    expect(checkCoverLetter(CV, letter, result)).toEqual({ skills: ['Docker', 'Kubernetes'], numbers: ['3'] });
  });
});

describe('buildCoverLetterPrompt', () => {
  it('carries the no-invent rule, the language, the company and the data blocks', () => {
    const p = buildCoverLetterPrompt(CV, { title: 'Junior Dev', company: 'Acme', text: 'Docker' }, ['Node.js'], 'uk');
    expect(p).toContain(NO_INVENT_RULE);
    expect(p).toContain('Write in Ukrainian');
    expect(p).toContain('"Acme"');
    expect(p).toContain('the CV already covers: Node.js');
    expect(p).toContain(`<cv>\n${CV}\n</cv>`);
    expect(p).toMatch(/Never use placeholders/);
  });
});
