import { describe, expect, it } from 'vitest';
import { NO_INVENT_RULE } from './llm.js';
import {
  buildAnalysisPrompt,
  buildCoverLetterPrompt,
  checkCoverLetter,
  dropPersonalTraits,
  isPersonalTrait,
  PERSONAL_TRAITS_RULE,
  transliterate,
  type AnalysisResult,
} from './analysis.js';

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

describe('personal traits are not skills', () => {
  it('recognises age, gender, marital status, appearance and health requirements', () => {
    for (const t of ['Вік від 21 року', 'від 18 років', 'Возраст 20-30 лет', 'Age 21+', '21+ years old', 'Чоловіча стать', 'Gender: female', 'Сімейний стан', 'Пол: мужской', 'Male only', 'Приємна зовнішність', 'Good health', 'Здоров’я']) {
      expect(isPersonalTrait(t), t).toBe(true);
    }
  });

  it('keeps real skills and experience requirements', () => {
    for (const t of ['Від 1 року досвіду', '1+ year of experience', 'Досвід від 2 років', 'Англійська мова', 'Manage', 'Image processing', 'Healthcare domain', 'React', 'Polish language', 'Пол-стек']) {
      expect(isPersonalTrait(t), t).toBe(false);
    }
  });

  it('drops them from the result, keeping everything else', () => {
    const r = dropPersonalTraits({
      ...result,
      matchedSkills: ['Node.js', 'Вік від 21 року'],
      missingSkills: [{ skill: 'Вік від 21 року', advice: 'Додай вік у CV' }, { skill: 'Англійська мова', advice: 'B1' }],
      missingKeywords: ['Age 21+', 'Docker'],
    });
    expect(r.matchedSkills).toEqual(['Node.js']);
    expect(r.missingSkills.map((m) => m.skill)).toEqual(['Англійська мова']);
    expect(r.missingKeywords).toEqual(['Docker']);
  });

  it('is part of the analysis prompt', () => {
    expect(buildAnalysisPrompt(CV, { title: 'Dev', text: 'Вік від 21 року' }, 'uk')).toContain(PERSONAL_TRAITS_RULE);
  });
});

describe('cover letter greeting', () => {
  it('asks for a correct Ukrainian greeting and forbids "Вітаю команді"', () => {
    const p = buildCoverLetterPrompt(CV, { title: 'Dev', company: 'Acme', text: 'x' }, [], 'uk');
    expect(p).toContain('"Добрий день, командо <Company>!"');
    expect(p).toContain('Never "Вітаю команді"');
    expect(buildCoverLetterPrompt(CV, { title: 'Dev', text: 'x' }, [], 'en')).toContain('"Dear <Company> team,"');
  });
});
