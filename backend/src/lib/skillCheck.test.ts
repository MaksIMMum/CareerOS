import { describe, expect, it } from 'vitest';
import { containsTerm, findUnsupportedTerms } from './skillCheck.js';

const CV = `Віталій, Junior Backend Developer.
Досвід: навчальний проєкт CareerOS на Node.js і TypeScript (2025), REST API з DynamoDB.
Навички: Git, SQL, JS. Англійська B1.`;

describe('containsTerm', () => {
  it('matches whole terms case-insensitively, incl. symbols and Cyrillic', () => {
    expect(containsTerm('I know C# and .NET', 'c#')).toBe(true);
    expect(containsTerm('I know C++', 'c')).toBe(false);
    expect(containsTerm('Java developer', 'javascript')).toBe(false);
    expect(containsTerm('JavaScript developer', 'java')).toBe(false);
    expect(containsTerm('Англійська B1', 'англійська')).toBe(true);
    expect(containsTerm('Node.js, TypeScript', 'node.js')).toBe(true);
  });
});

describe('findUnsupportedTerms', () => {
  it('passes a faithful rewrite (reordered, rephrased, aliases)', () => {
    const rewrite = `Junior Backend Developer: TypeScript, JavaScript, Node.js.
Розробив REST API з DynamoDB у навчальному проєкті CareerOS (2025). Git, SQL. English B1.`;
    expect(findUnsupportedTerms(CV, rewrite)).toEqual({ skills: [], numbers: [] });
  });

  it('flags tools from the vacancy that the CV never mentions', () => {
    const rewrite = `${CV}\nДосвід з Docker, Kubernetes та PostgreSQL.`;
    expect(findUnsupportedTerms(CV, rewrite, ['Docker', 'PostgreSQL']).skills.sort()).toEqual([
      'Docker',
      'Kubernetes',
      'PostgreSQL',
    ]);
  });

  it('flags tech-looking tokens even when they are not in the dictionary', () => {
    const rewrite = `${CV}\nBuilt services with NestJS, GraphQL and Prisma2 on GCP.`;
    const { skills } = findUnsupportedTerms(CV, rewrite);
    expect(skills).toEqual(expect.arrayContaining(['NestJS', 'GraphQL', 'Prisma2', 'GCP']));
  });

  it('flags invented numbers and dates but not those from the CV', () => {
    const rewrite = `${CV}\nПрискорив API на 40% у 2023 році, 3+ роки досвіду.`;
    expect(findUnsupportedTerms(CV, rewrite).numbers.sort()).toEqual(['2023', '3+', '40%']);
  });

  it('does not flag a term the user added to the CV themselves', () => {
    const edited = `${CV}\nТакож: Docker (курс).`;
    expect(findUnsupportedTerms(edited, `${edited}\nDocker`).skills).toEqual([]);
  });

  it('ignores ordinary words at the end of a sentence (regression: "quality.", "technologies.")', () => {
    const cv = 'Fixed bugs and improved code. Built frontend and backend features. Node.js.';
    const rewrite = 'Fixed bugs and improved code quality.\nBuilt features using frontend and backend technologies.\nNode.js.';
    expect(findUnsupportedTerms(cv, rewrite).skills).toEqual([]);
  });

  it('still detects dotted, slashed and symbol tech names', () => {
    const { skills } = findUnsupportedTerms('Junior dev.', 'Junior dev: Express.js, CI/CD, ASP.NET, C#, C++.');
    expect(skills).toEqual(expect.arrayContaining(['Express.js', 'CI/CD', 'ASP.NET', 'C#', 'C++']));
  });
});
