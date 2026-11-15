/**
 * Post-check for CLAUDE.md rule 4: never silently trust the model. Finds terms in the rewritten
 * CV (skills/tools/technologies and numbers) that do not occur anywhere in the original CV text
 * — which already contains the user's own edits, since CV versions are user-edited.
 */

// Common junior-IT skills. Not exhaustive: tech-looking tokens are detected by shape as well.
const KNOWN_SKILLS = [
  'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift', 'go', 'golang', 'rust', 'c', 'c++', 'c#',
  'php', 'ruby', 'scala', 'dart', 'r', 'matlab', 'sql', 'nosql', 'html', 'css', 'sass', 'less', 'bash',
  'node.js', 'express', 'nestjs', 'next.js', 'nuxt', 'react', 'react native', 'redux', 'angular', 'vue',
  'svelte', 'jquery', 'tailwind', 'bootstrap', 'webpack', 'vite', 'django', 'flask', 'fastapi', 'spring',
  'spring boot', 'hibernate', '.net', 'asp.net', 'laravel', 'symfony', 'rails', 'flutter', 'android', 'ios',
  'postgresql', 'mysql', 'mongodb', 'redis', 'sqlite', 'oracle', 'elasticsearch', 'dynamodb', 'firebase',
  'graphql', 'rest', 'grpc', 'websocket', 'kafka', 'rabbitmq', 'docker', 'kubernetes', 'terraform',
  'ansible', 'jenkins', 'github actions', 'gitlab ci', 'ci/cd', 'aws', 'azure', 'gcp', 'lambda', 'linux',
  'nginx', 'git', 'jira', 'figma', 'jest', 'vitest', 'mocha', 'cypress', 'playwright', 'selenium', 'junit',
  'pytest', 'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch', 'power bi', 'tableau', 'excel',
  'qa', 'manual testing', 'automation testing', 'postman', 'swagger', 'oop', 'solid', 'tdd', 'microservices',
  'agile', 'scrum', 'kanban', 'machine learning', 'data analysis', 'devops', 'english', 'ukrainian',
];

// Spellings that mean the same thing (so "JS" in the CV covers "JavaScript" in the rewrite).
const ALIASES: string[][] = [
  ['javascript', 'js', 'ecmascript'],
  ['typescript', 'ts'],
  ['node.js', 'nodejs', 'node js', 'node'],
  ['postgresql', 'postgres', 'psql'],
  ['react', 'react.js', 'reactjs'],
  ['vue', 'vue.js', 'vuejs'],
  ['next.js', 'nextjs'],
  ['golang', 'go'],
  ['kubernetes', 'k8s'],
  ['aws', 'amazon web services'],
  ['gcp', 'google cloud'],
  ['ci/cd', 'cicd', 'ci-cd'],
  ['mongodb', 'mongo'],
  ['english', 'англійська', 'англійської', 'английский'],
  ['ukrainian', 'українська', 'української'],
  ['rest', 'restful', 'rest api'],
  ['.net', 'dotnet'],
  ['machine learning', 'ml'],
];

const aliasesOf = (term: string): string[] => {
  const t = term.toLowerCase();
  return ALIASES.find((group) => group.includes(t)) ?? [t];
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const termRe = (term: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term.trim())}(?![\\p{L}\\p{N}+#])`, 'iu');

/** Whole-term, case-insensitive match that works for Cyrillic and for terms like C#, C++, .NET. */
export function containsTerm(text: string, term: string): boolean {
  return term.trim() !== '' && termRe(term).test(text);
}

const supported = (original: string, term: string) => aliasesOf(term).some((a) => containsTerm(original, a));

// Tokens that look like technologies: Node.js, CI/CD, ASP.NET, C#, C++, PostgreSQL, GraphQL, AWS,
// K8s, ES6. A dot/slash only counts with letters on both sides, so "quality." at the end of a
// sentence is not mistaken for a dotted name.
const TECH_TOKEN_RE =
  /\b[A-Za-z][A-Za-z0-9]*(?:[./][A-Za-z0-9]+)+|\b[A-Za-z]+(?:#|\+\+)|\b[A-Z][a-z]+[A-Z][A-Za-z]*\b|\b[A-Z]{2,}[a-z]*[0-9]*\b|\b[A-Za-z]+[0-9]+\b/g;
// Numbers and years: 2021, 30%, 5+, 1.5
const NUMBER_RE = /(?<![\p{L}\p{N}.])\d+(?:[.,]\d+)?(?:%|\+)?(?![\p{L}\p{N}])/gu;

export interface UnsupportedTerms {
  skills: string[];
  numbers: string[];
}

/**
 * @param original  the CV version the user chose (includes their own edits)
 * @param rewritten the model's improved CV + rewritten bullets
 * @param extraCandidates terms worth checking explicitly, e.g. the vacancy's skills/keywords
 *        (the most likely thing for a model to "helpfully" insert)
 */
export function findUnsupportedTerms(
  original: string,
  rewritten: string,
  extraCandidates: string[] = [],
): UnsupportedTerms {
  const skills = new Map<string, string>(); // lowercased -> display form

  const consider = (term: string) => {
    const t = term.trim().replace(/[.,;:]+$/, '');
    if (t.length < 1 || t.length > 40) return;
    const key = t.toLowerCase();
    if (skills.has(key)) return;
    const hit = termRe(t).exec(rewritten);
    // Display the term exactly as it is written in the rewrite (e.g. "Docker", not "docker").
    if (hit && !supported(original, t)) skills.set(key, hit[0]);
  };

  for (const term of [...KNOWN_SKILLS, ...extraCandidates]) consider(term);
  for (const m of rewritten.matchAll(TECH_TOKEN_RE)) consider(m[0]);

  // Drop entries that are just an alias of something already flagged (e.g. "Node" next to "Node.js").
  const flagged = [...skills.values()].filter(
    (t, _, all) => !all.some((o) => o !== t && o.toLowerCase().includes(t.toLowerCase()) && aliasesOf(o).includes(t.toLowerCase())),
  );

  const originalNumbers = new Set([...original.matchAll(NUMBER_RE)].map((m) => m[0].replace(',', '.')));
  const numbers = [
    ...new Set(
      [...rewritten.matchAll(NUMBER_RE)]
        .map((m) => m[0])
        .filter((n) => !originalNumbers.has(n.replace(',', '.'))),
    ),
  ];

  return { skills: flagged, numbers };
}
