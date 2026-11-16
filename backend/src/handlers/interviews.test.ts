import { brotliDecompressSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createInterviewsHandler } from './interviews.js';
import { FakeDynamo } from '../test/fakeDynamo.js';
import { LlmError, NO_INVENT_RULE, type LlmProvider } from '../lib/llm.js';
import { DAILY_LIMITS, quotaDay } from '../lib/quota.js';
import { summarizeInterview, checkBetterAnswer } from '../lib/interview.js';

const SUB = 'user-a';
const CV_ID = '11111111-1111-4111-8111-111111111111';
const VAC_ID = '22222222-2222-4222-8222-222222222222';
const CV_TEXT = 'Junior Backend Developer. Node.js, TypeScript, REST API, Git. Навчальний проєкт CareerOS (2025).';

const QUESTIONS = {
  questions: [
    { type: 'HR', topic: 'мотивація', question: 'Чому вас цікавить ця вакансія в Acme?' },
    { type: 'TECHNICAL', topic: 'Node.js', question: 'Як влаштований event loop у Node.js?' },
    { type: 'BEHAVIOURAL', topic: 'командна робота', question: 'Розкажіть про конфлікт у команді.' },
    { type: 'TECHNICAL', topic: 'REST API', question: 'Як ви проєктували REST API в CareerOS?' },
    { type: 'BEHAVIOURAL', topic: 'дедлайни', question: 'Розкажіть, як ви не встигали з дедлайном.' },
    { type: 'TECHNICAL', topic: 'Docker', question: 'Як би ви підійшли до вивчення Docker?' },
  ],
};

const feedback = (score: number, betterAnswer = 'У проєкті [ваш проєкт] я використовував Node.js і TypeScript.') => ({
  score,
  feedback: 'Добре, але додайте конкретний приклад.',
  betterAnswer,
});

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
  db.items.set(`USER#${SUB}|VACANCY#${VAC_ID}`, {
    PK: `USER#${SUB}`, SK: `VACANCY#${VAC_ID}`, id: VAC_ID, title: 'Junior Node.js Developer', company: 'Acme',
    url: '', text: 'Node.js, TypeScript, Docker.', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const interviewsUsed = () => db.get(`USER#${SUB}`, `QUOTA#${quotaDay()}`)?.interviews ?? 0;
const events = (type: string) => [...db.items.values()].filter((i) => String(i.PK).startsWith('EVENT#') && i.type === type);

async function start(llm: LlmProvider) {
  const h = createInterviewsHandler({ client: db, tableName: 't', llm });
  const res = await call(h, ev('POST /interviews', { body: { cvId: CV_ID, vacancyId: VAC_ID, lang: 'uk' } }));
  return { h, res, id: res.body?.item?.id as string };
}

describe('POST /interviews', () => {
  it('generates questions from the CV and vacancy, stores them, takes one quota unit and logs a start', async () => {
    const llm = fakeLlm(QUESTIONS);
    const { res, id } = await start(llm);

    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({
      cvName: 'Backend CV', vacancyId: VAC_ID, vacancyTitle: 'Junior Node.js Developer', company: 'Acme',
      status: 'IN_PROGRESS', questionCount: 6, answeredCount: 0, answers: [],
    });
    expect(res.body.item.questions).toHaveLength(6);
    expect(res.body.item.cvText).toBeUndefined(); // the CV snapshot never goes back to the client

    const prompt = llm.generateJson.mock.calls[0]![0];
    expect(prompt).toContain(NO_INVENT_RULE);
    expect(prompt).toContain(CV_TEXT);
    expect(prompt).toContain('Node.js, TypeScript, Docker.');
    expect(prompt).toContain('Ukrainian');

    expect(db.get(`USER#${SUB}`, `INTERVIEW#${id}`)).toBeDefined();
    const detail = db.get(`USER#${SUB}`, `INTERVIEWDETAIL#${id}`)!;
    expect(JSON.parse(brotliDecompressSync(detail.data).toString()).cvText).toBe(CV_TEXT);
    expect(interviewsUsed()).toBe(1);
    expect(events('INTERVIEW_STARTED')).toHaveLength(1);
  });

  it('rejects a question set that does not mix HR, technical and behavioural questions', async () => {
    const onlyTech = { questions: QUESTIONS.questions.map((q) => ({ ...q, type: 'TECHNICAL' })) };
    const { res } = await start(fakeLlm(onlyTech));
    expect(res.status).toBe(500); // zod error in the fake; the real provider retries then fails
  });

  it('refunds the quota when the AI fails', async () => {
    const { res } = await start(fakeLlm(new LlmError('timeout', 'slow')));
    expect(res.status).toBe(504);
    expect(res.body.error).toBe('ai_timeout');
    expect(interviewsUsed()).toBe(0);
  });

  it('returns 429 once the daily interview quota is used up', async () => {
    db.items.set(`USER#${SUB}|QUOTA#${quotaDay()}`, {
      PK: `USER#${SUB}`, SK: `QUOTA#${quotaDay()}`, interviews: DAILY_LIMITS.interview,
    });
    const llm = fakeLlm(QUESTIONS);
    const { res } = await start(llm);
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ error: 'quota_exceeded', kind: 'interview' });
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it("404s for another user's CV or vacancy", async () => {
    const h = createInterviewsHandler({ client: db, tableName: 't', llm: fakeLlm(QUESTIONS) });
    const res = await call(h, ev('POST /interviews', { sub: 'user-b', body: { cvId: CV_ID, vacancyId: VAC_ID } }));
    expect(res.status).toBe(404);
  });
});

describe('POST /interviews/{id}/answers', () => {
  it('scores each answer, finishes after the last one, logs INTERVIEW_DONE and does not use more quota', async () => {
    const scores = [8, 4, 9, 7, 3, 6];
    const llm = fakeLlm(QUESTIONS, ...scores.map((s) => feedback(s)));
    const { h, id } = await start(llm);

    let last: any;
    for (let i = 0; i < scores.length; i++) {
      last = await call(h, ev('POST /interviews/{id}/answers', { id, body: { index: i, answer: `Відповідь ${i}`, seconds: 40 } }));
      expect(last.status).toBe(201);
    }
    const item = last.body.item;
    expect(item.status).toBe('DONE');
    expect(item.answeredCount).toBe(6);
    expect(item.answers[0]).toMatchObject({ answer: 'Відповідь 0', seconds: 40, score: 8 });
    expect(item.overallScore).toBe(6.2);
    expect(item.outcome.strongest).toEqual(['командна робота', 'мотивація', 'REST API']);
    expect(item.outcome.weakest).toEqual(['дедлайни', 'Node.js', 'Docker']);

    // The evaluation prompt carries the rule, the question and the answer.
    const prompt = llm.generateJson.mock.calls[1]![0];
    expect(prompt).toContain(NO_INVENT_RULE);
    expect(prompt).toContain('Чому вас цікавить');
    expect(prompt).toContain('Відповідь 0');
    expect(prompt).toContain('[ваш проєкт]');

    expect(interviewsUsed()).toBe(1);
    const done = events('INTERVIEW_DONE');
    expect(done).toHaveLength(1);
    expect(done[0]!.payload).toMatchObject({ interviewId: id, vacancyId: VAC_ID, overallScore: 6.2 });

    const list = await call(h, ev('GET /interviews'));
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ id, status: 'DONE', overallScore: 6.2 });

    const again = await call(h, ev('POST /interviews/{id}/answers', { id, body: { index: 6, answer: 'ще' } }));
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('interview_finished');
  });

  it('accepts answers only in order (stale tab / double submit gets 409)', async () => {
    const llm = fakeLlm(QUESTIONS, feedback(7));
    const { h, id } = await start(llm);
    const skip = await call(h, ev('POST /interviews/{id}/answers', { id, body: { index: 1, answer: 'x' } }));
    expect(skip.status).toBe(409);
    expect(skip.body).toMatchObject({ error: 'wrong_question', details: { expected: 0 } });
    expect(llm.generateJson).toHaveBeenCalledTimes(1); // no AI call wasted
  });

  it('flags skills in the example answer that are neither in the CV nor in the user answer', async () => {
    const llm = fakeLlm(QUESTIONS, feedback(6, 'Я налаштовував Kubernetes у [ваш проєкт] і писав на Node.js.'));
    const { h, id } = await start(llm);
    const res = await call(h, ev('POST /interviews/{id}/answers', { id, body: { index: 0, answer: 'Мені подобається бекенд' } }));
    expect(res.body.item.answers[0].flagged.skills).toEqual(['Kubernetes']);
  });

  it('keeps the answer unsaved when the AI fails, so the user can retry', async () => {
    const llm = fakeLlm(QUESTIONS, new LlmError('http', 'down', 503), feedback(7));
    const { h, id } = await start(llm);
    const fail = await call(h, ev('POST /interviews/{id}/answers', { id, body: { index: 0, answer: 'a' } }));
    expect(fail.status).toBe(502);
    const retry = await call(h, ev('POST /interviews/{id}/answers', { id, body: { index: 0, answer: 'a' } }));
    expect(retry.status).toBe(201);
    expect(retry.body.item.answeredCount).toBe(1);
  });

  it("404s for another user's interview", async () => {
    const { h, id } = await start(fakeLlm(QUESTIONS));
    const res = await call(h, ev('GET /interviews/{id}', { id, sub: 'user-b' }));
    expect(res.status).toBe(404);
  });
});

describe('summarizeInterview / checkBetterAnswer', () => {
  it('averages per type and handles no strong answers', () => {
    const out = summarizeInterview([
      { type: 'HR', topic: 'a', score: 5 },
      { type: 'TECHNICAL', topic: 'b', score: 4 },
      { type: 'TECHNICAL', topic: 'c', score: 5 },
    ]);
    expect(out.overallScore).toBe(4.7);
    expect(out.byType).toEqual({ HR: 5, TECHNICAL: 4.5 });
    expect(out.strongest).toEqual([]);
    expect(out.weakest[0]).toBe('b');
  });

  it('does not flag placeholders or facts the user stated', () => {
    const r = checkBetterAnswer('Python, Git', 'I used Docker at university', 'I used Docker and Python in [Kubernetes project].');
    expect(r.skills).toEqual([]);
  });
});
