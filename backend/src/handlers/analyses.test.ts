import { brotliDecompressSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createAnalysesHandler } from './analyses.js';
import { createPublicShareHandler } from './public-share.js';
import { FakeDynamo } from '../test/fakeDynamo.js';
import { LlmError, NO_INVENT_RULE, type LlmProvider } from '../lib/llm.js';
import { quotaDay } from '../lib/quota.js';
import type { AnalysisResult } from '../lib/analysis.js';

const SUB = 'user-a';
const CV_ID = '11111111-1111-4111-8111-111111111111';
const CV_TEXT = 'Junior Backend Developer. Node.js, TypeScript, REST API, Git. Навчальний проєкт CareerOS (2025).';
const VACANCY = { title: 'Junior Node.js Developer', company: 'Acme', text: 'Node.js, TypeScript, Docker, PostgreSQL.' };

const goodResult: AnalysisResult = {
  matchScore: 61.6,
  summary: 'Добре покриття Node.js і TypeScript; бракує Docker і PostgreSQL.',
  matchedSkills: ['Node.js', 'TypeScript'],
  missingSkills: [
    { skill: 'Docker', advice: 'Пройдіть безкоштовний курс і додайте Dockerfile у навчальний проєкт.' },
    { skill: 'PostgreSQL', advice: 'Зробіть невеликий pet-проєкт з PostgreSQL.' },
  ],
  missingKeywords: ['Docker', 'PostgreSQL'],
  weakBullets: [{ original: 'REST API', rewritten: 'Розробив REST API на Node.js', why: 'Конкретніше' }],
  improvedCv: 'Junior Backend Developer: Node.js, TypeScript. Розробив REST API у навчальному проєкті CareerOS (2025). Git.',
};

function fakeLlm(...answers: (unknown | Error)[]) {
  const generateJson = vi.fn(async (_prompt: string, schema: any) => {
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return schema.parse(next);
  });
  return { generateJson } as unknown as LlmProvider & { generateJson: typeof generateJson };
}

function ev(routeKey: string, opts: { body?: unknown; id?: string; sub?: string; lang?: string } = {}) {
  const [method] = routeKey.split(' ');
  return {
    routeKey,
    headers: opts.lang ? { 'accept-language': opts.lang } : {},
    requestContext: { http: { method }, authorizer: { jwt: { claims: { sub: opts.sub ?? SUB } } } },
    pathParameters: opts.id ? { id: opts.id } : undefined,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as APIGatewayProxyEventV2;
}

const call = async (h: (e: APIGatewayProxyEventV2) => Promise<any>, e: APIGatewayProxyEventV2) => {
  const r = await h(e);
  return { status: r.statusCode as number, body: r.body ? JSON.parse(r.body) : undefined };
};

let db: FakeDynamo;
beforeEach(() => {
  db = new FakeDynamo();
  db.items.set(`USER#${SUB}|CV#${CV_ID}`, {
    PK: `USER#${SUB}`, SK: `CV#${CV_ID}`, id: CV_ID, name: 'Backend CV', text: CV_TEXT,
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const quotaUsed = (kind: 'analyses' | 'shares' | 'coverLetters') => db.get(`USER#${SUB}`, `QUOTA#${quotaDay()}`)?.[kind] ?? 0;
const itemsWithSk = (prefix: string) => [...db.items.values()].filter((i) => String(i.SK).startsWith(prefix));

describe('POST /analyses', () => {
  it('analyses a CV against a pasted vacancy, stores it, saves the vacancy and logs an event', async () => {
    const llm = fakeLlm(goodResult);
    const h = createAnalysesHandler({ client: db, tableName: 't', llm });
    const res = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY, lang: 'uk' } }));

    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({
      cvName: 'Backend CV', vacancyTitle: 'Junior Node.js Developer', company: 'Acme', matchScore: 62, flaggedCount: 0,
    });
    expect(res.body.item.result.improvedCv).toBe(goodResult.improvedCv);
    expect(res.body.item.flagged).toEqual({ skills: [], numbers: [] });

    expect(itemsWithSk('ANALYSIS#')).toHaveLength(1);
    const detail = itemsWithSk('ANALYSISDETAIL#')[0]!;
    const unpacked = JSON.parse(brotliDecompressSync(Buffer.from(detail.data)).toString());
    expect(unpacked.cvText).toBe(CV_TEXT);
    expect(itemsWithSk('VACANCY#')).toHaveLength(1);
    expect(res.body.item.vacancyId).toBe(itemsWithSk('VACANCY#')[0]!.id);
    expect(itemsWithSk('').filter((i) => String(i.PK).startsWith('EVENT#')).map((e) => e.type)).toEqual(['ANALYSIS']);
    expect(quotaUsed('analyses')).toBe(1);
  });

  it('sends the strict no-invent rules, the CV, the vacancy and the UI language in the prompt', async () => {
    const llm = fakeLlm(goodResult);
    await call(createAnalysesHandler({ client: db, tableName: 't', llm }), ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY }, lang: 'en-GB' }));
    const prompt = llm.generateJson.mock.calls[0]![0];
    expect(prompt).toContain(NO_INVENT_RULE);
    expect(prompt).toMatch(/NEVER add skills, tools, technologies, employers/);
    expect(prompt).toContain('in English');
    expect(prompt).toContain(CV_TEXT);
    expect(prompt).toContain(VACANCY.text);
  });

  it('flags skills and numbers the model invented', async () => {
    const llm = fakeLlm({ ...goodResult, improvedCv: `${goodResult.improvedCv} Досвід з Docker, 3 роки.` });
    const res = await call(createAnalysesHandler({ client: db, tableName: 't', llm }), ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    expect(res.body.item.flagged).toEqual({ skills: ['Docker'], numbers: ['3'] });
    expect(res.body.item.flaggedCount).toBe(2);
  });

  it('uses a saved vacancy by id without creating another one', async () => {
    const vid = '22222222-2222-4222-8222-222222222222';
    db.items.set(`USER#${SUB}|VACANCY#${vid}`, { PK: `USER#${SUB}`, SK: `VACANCY#${vid}`, id: vid, ...VACANCY, url: '' });
    const res = await call(createAnalysesHandler({ client: db, tableName: 't', llm: fakeLlm(goodResult) }), ev('POST /analyses', { body: { cvId: CV_ID, vacancyId: vid } }));
    expect(res.body.item.vacancyId).toBe(vid);
    expect(itemsWithSk('VACANCY#')).toHaveLength(1);
  });

  it('refunds the quota and saves nothing when the AI fails', async () => {
    const llm = fakeLlm(new LlmError('http', 'Gemini HTTP 503', 503));
    const res = await call(createAnalysesHandler({ client: db, tableName: 't', llm }), ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    expect(res).toEqual({ status: 502, body: { error: 'ai_unavailable' } });
    expect(quotaUsed('analyses')).toBe(0);
    expect(itemsWithSk('ANALYSIS')).toHaveLength(0);
    expect(itemsWithSk('VACANCY#')).toHaveLength(0);
  });

  it('maps an AI timeout to 504', async () => {
    const llm = fakeLlm(new LlmError('timeout', 'slow'));
    const res = await call(createAnalysesHandler({ client: db, tableName: 't', llm }), ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    expect(res.status).toBe(504);
  });

  it('returns a friendly translated 429 after 10 analyses, without calling the AI', async () => {
    db.items.set(`USER#${SUB}|QUOTA#${quotaDay()}`, { PK: `USER#${SUB}`, SK: `QUOTA#${quotaDay()}`, analyses: 10 });
    const llm = fakeLlm(goodResult);
    const res = await call(createAnalysesHandler({ client: db, tableName: 't', llm }), ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY }, lang: 'uk' }));
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ error: 'quota_exceeded', kind: 'analysis', limit: 10 });
    expect(res.body.message).toContain('10 аналізів');
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it("cannot analyse another user's CV (404, no AI call, no quota used)", async () => {
    const llm = fakeLlm(goodResult);
    const res = await call(createAnalysesHandler({ client: db, tableName: 't', llm }), ev('POST /analyses', { sub: 'user-b', body: { cvId: CV_ID, vacancy: VACANCY } }));
    expect(res.status).toBe(404);
    expect(llm.generateJson).not.toHaveBeenCalled();
    expect(db.get('USER#user-b', `QUOTA#${quotaDay()}`)).toBeUndefined();
  });

  it('requires exactly one of vacancyId or vacancy', async () => {
    const h = createAnalysesHandler({ client: db, tableName: 't', llm: fakeLlm() });
    expect((await call(h, ev('POST /analyses', { body: { cvId: CV_ID } }))).status).toBe(400);
    expect((await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancyId: CV_ID, vacancy: VACANCY } }))).status).toBe(400);
  });
});

describe('GET /analyses and /analyses/{id}', () => {
  it('lists summaries newest first and returns the full result by id', async () => {
    const h = createAnalysesHandler({ client: db, tableName: 't', llm: fakeLlm(goodResult, { ...goodResult, matchScore: 80 }) });
    const first = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    await new Promise((r) => setTimeout(r, 2));
    const second = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: { ...VACANCY, title: 'Second' } } }));

    const list = await call(h, ev('GET /analyses'));
    expect(list.body.items.map((i: any) => i.id)).toEqual([second.body.item.id, first.body.item.id]);
    expect(list.body.items[0]).not.toHaveProperty('result');

    const one = await call(h, ev('GET /analyses/{id}', { id: first.body.item.id }));
    expect(one.body.item.result.summary).toBe(goodResult.summary);
    expect(one.body.item.vacancy).toEqual({ title: VACANCY.title, company: VACANCY.company, text: VACANCY.text });
    expect(first.body.item.vacancy.text).toBe(VACANCY.text);
    expect((await call(h, ev('GET /analyses/{id}', { id: first.body.item.id, sub: 'user-b' }))).status).toBe(404);
  });
});

describe('sharing', () => {
  it('re-scores before/after once, creates a public card without CV text, and reuses it', async () => {
    const llm = fakeLlm(goodResult, { before: 58, after: 77.4 });
    const h = createAnalysesHandler({ client: db, tableName: 't', llm });
    const { body } = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));

    const shared = await call(h, ev('POST /analyses/{id}/share', { id: body.item.id }));
    expect(shared.status).toBe(201);
    expect(shared.body.scores).toEqual({ before: 58, after: 77 });
    expect(shared.body.shareId).toMatch(/^[A-Za-z0-9_-]{12}$/);
    const rescorePrompt = llm.generateJson.mock.calls[1]![0];
    expect(rescorePrompt).toContain(CV_TEXT);
    expect(rescorePrompt).toContain(goodResult.improvedCv);
    expect(quotaUsed('shares')).toBe(1);

    const again = await call(h, ev('POST /analyses/{id}/share', { id: body.item.id }));
    expect(again.body).toEqual({ shareId: shared.body.shareId, scores: { before: 58, after: 77 } });
    expect(llm.generateJson).toHaveBeenCalledTimes(2);

    const pub = createPublicShareHandler(db, 't');
    const card = await call(pub, { pathParameters: { shareId: shared.body.shareId } } as any);
    expect(card.status).toBe(200);
    expect(Object.keys(card.body).sort()).toEqual(['createdAt', 'jobTitle', 'scoreAfter', 'scoreBefore']);
    expect(card.body).toMatchObject({ jobTitle: 'Junior Node.js Developer', scoreBefore: 58, scoreAfter: 77 });
    expect(JSON.stringify(card.body)).not.toContain('Node.js, TypeScript, REST');

    expect((await call(pub, { pathParameters: { shareId: 'nope' } } as any)).status).toBe(404);
    expect((await call(pub, { pathParameters: { shareId: 'AAAAAAAAAAAA' } } as any)).status).toBe(404);
  });

  it("cannot share another user's analysis", async () => {
    const h = createAnalysesHandler({ client: db, tableName: 't', llm: fakeLlm(goodResult) });
    const { body } = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    expect((await call(h, ev('POST /analyses/{id}/share', { id: body.item.id, sub: 'user-b' }))).status).toBe(404);
  });
});

describe('cover letters', () => {
  const LETTER =
    'Шановна команда Acme!\n\nХочу податися на позицію Junior Node.js Developer. Маю досвід з Node.js і TypeScript у навчальному проєкті CareerOS.\n\nЗ повагою.';

  it('writes a letter from the saved CV with the no-invent rules, stores it and returns it with the analysis', async () => {
    const llm = fakeLlm(goodResult, { letter: `  ${LETTER}  ` });
    const h = createAnalysesHandler({ client: db, tableName: 't', llm });
    const { body } = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));

    const res = await call(h, ev('POST /analyses/{id}/cover-letter', { id: body.item.id, body: { lang: 'en' } }));
    expect(res.status).toBe(201);
    expect(res.body.coverLetter).toMatchObject({ letter: LETTER, lang: 'en', flagged: { skills: [], numbers: [] } });

    const prompt = llm.generateJson.mock.calls[1]![0];
    expect(prompt).toContain(NO_INVENT_RULE);
    expect(prompt).toMatch(/Do NOT mention vacancy requirements the CV does not cover/);
    expect(prompt).toContain('Write in English');
    expect(prompt).toContain(CV_TEXT);
    expect(prompt).toContain(VACANCY.text);
    expect(quotaUsed('coverLetters')).toBe(1);
    expect(itemsWithSk('').filter((i) => String(i.PK).startsWith('EVENT#')).map((e) => e.type)).toContain('COVER_LETTER');

    const one = await call(h, ev('GET /analyses/{id}', { id: body.item.id }));
    expect(one.body.item.coverLetter.letter).toBe(LETTER);
    expect(one.body.item).not.toHaveProperty('missingSkills');
  });

  it('flags skills from the vacancy that the letter claims but the CV does not have', async () => {
    const llm = fakeLlm(goodResult, { letter: `${LETTER} Також працюю з Docker вже 2 роки.` });
    const h = createAnalysesHandler({ client: db, tableName: 't', llm });
    const { body } = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    const res = await call(h, ev('POST /analyses/{id}/cover-letter', { id: body.item.id }));
    expect(res.body.coverLetter.flagged).toEqual({ skills: ['Docker'], numbers: ['2'] });
  });

  it('regenerating replaces the stored letter', async () => {
    const llm = fakeLlm(goodResult, { letter: LETTER }, { letter: `${LETTER} Друга версія.` });
    const h = createAnalysesHandler({ client: db, tableName: 't', llm });
    const { body } = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    await call(h, ev('POST /analyses/{id}/cover-letter', { id: body.item.id }));
    await call(h, ev('POST /analyses/{id}/cover-letter', { id: body.item.id }));
    expect(itemsWithSk('COVERLETTER#')).toHaveLength(1);
    expect(itemsWithSk('COVERLETTER#')[0]!.letter).toContain('Друга версія');
  });

  it('refunds the quota when the AI fails, and enforces the daily limit', async () => {
    const llm = fakeLlm(goodResult, new LlmError('http', 'Gemini HTTP 503', 503), { letter: LETTER });
    const h = createAnalysesHandler({ client: db, tableName: 't', llm });
    const { body } = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    expect((await call(h, ev('POST /analyses/{id}/cover-letter', { id: body.item.id }))).status).toBe(502);
    expect(quotaUsed('coverLetters')).toBe(0);
    expect(itemsWithSk('COVERLETTER#')).toHaveLength(0);

    db.get(`USER#${SUB}`, `QUOTA#${quotaDay()}`)!.coverLetters = 10;
    const limited = await call(h, ev('POST /analyses/{id}/cover-letter', { id: body.item.id, lang: 'en' }));
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ error: 'quota_exceeded', kind: 'coverLetter', limit: 10 });
  });

  it("cannot write a letter for another user's analysis (404, no quota used)", async () => {
    const llm = fakeLlm(goodResult, { letter: LETTER });
    const h = createAnalysesHandler({ client: db, tableName: 't', llm });
    const { body } = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    const res = await call(h, ev('POST /analyses/{id}/cover-letter', { id: body.item.id, sub: 'user-b' }));
    expect(res.status).toBe(404);
    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect(db.get('USER#user-b', `QUOTA#${quotaDay()}`)).toBeUndefined();
  });
});

describe('GET /insights/skills', () => {
  it('counts missing skills across analyses and marks the ones a CV now has', async () => {
    const llm = fakeLlm(
      goodResult,
      { ...goodResult, missingSkills: [{ skill: 'Docker', advice: 'Курс.' }, { skill: 'Kubernetes', advice: 'Курс.' }] },
    );
    const h = createAnalysesHandler({ client: db, tableName: 't', llm });
    await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    await new Promise((r) => setTimeout(r, 2));
    await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: { ...VACANCY, title: 'DevOps intern' } } }));
    db.get(`USER#${SUB}`, `CV#${CV_ID}`)!.text = `${CV_TEXT} Docker.`;

    const res = await call(h, ev('GET /insights/skills'));
    expect(res.status).toBe(200);
    expect(res.body.analyses).toBe(2);
    expect(res.body.skills.map((s: any) => [s.skill, s.count, s.inCvs])).toEqual([
      ['Docker', 2, ['Backend CV']],
      ['Kubernetes', 1, []],
      ['PostgreSQL', 1, []],
    ]);
    expect(res.body.skills[0].vacancies.map((v: any) => v.title)).toEqual(['DevOps intern', 'Junior Node.js Developer']);
  });

  it('fills in missing skills of older analyses once from the detail item', async () => {
    const h = createAnalysesHandler({ client: db, tableName: 't', llm: fakeLlm(goodResult) });
    const { body } = await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    delete db.get(`USER#${SUB}`, `ANALYSIS#${body.item.id}`)!.missingSkills; // as saved before this feature

    const res = await call(h, ev('GET /insights/skills'));
    expect(res.body.skills.map((s: any) => s.skill)).toEqual(['Docker', 'PostgreSQL']);
    expect(db.get(`USER#${SUB}`, `ANALYSIS#${body.item.id}`)!.missingSkills).toEqual(['Docker', 'PostgreSQL']);
  });

  it('is empty for a new user and only sees the caller\'s data', async () => {
    const h = createAnalysesHandler({ client: db, tableName: 't', llm: fakeLlm(goodResult) });
    await call(h, ev('POST /analyses', { body: { cvId: CV_ID, vacancy: VACANCY } }));
    const res = await call(h, ev('GET /insights/skills', { sub: 'user-b' }));
    expect(res.body).toEqual({ analyses: 0, skills: [] });
  });
});
