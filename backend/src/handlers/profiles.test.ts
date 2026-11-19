import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createProfilesHandler } from './profiles.js';
import { FakeDynamo } from '../test/fakeDynamo.js';
import { LlmError, NO_INVENT_RULE, type LlmProvider } from '../lib/llm.js';
import { quotaDay } from '../lib/quota.js';
import { buildProfilePrompt, checkProfile, fitProfile, PROFILE_LIMITS } from '../lib/profile.js';

const SUB = 'user-a';
const CV_ID = '11111111-1111-4111-8111-111111111111';
const CV_TEXT = 'Олена Коваленко\nJunior Backend Developer. КПІ.\nNode.js, TypeScript, PostgreSQL, Git.\nIntern at SoftServe (2025).';

const good = {
  headline: 'Junior Backend Developer | Node.js | TypeScript | PostgreSQL',
  about: 'I am a junior backend developer. During my internship at SoftServe (2025) I built backend services with Node.js and TypeScript. I studied at KPI.',
  skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Git', 'Node.js'],
};

function fakeLlm(...answers: (unknown | Error)[]) {
  const generateJson = vi.fn(async (_prompt: string, schema: any) => {
    const next = answers.shift();
    if (next instanceof Error) throw next;
    return schema.parse(next);
  });
  return { generateJson } as unknown as LlmProvider & { generateJson: typeof generateJson };
}

const ev = (routeKey: string, opts: { body?: unknown; sub?: string; id?: string; lang?: string } = {}) =>
  ({
    routeKey,
    headers: opts.lang ? { 'accept-language': opts.lang } : {},
    requestContext: { http: { method: routeKey.split(' ')[0] }, authorizer: { jwt: { claims: { sub: opts.sub ?? SUB } } } },
    pathParameters: { id: opts.id ?? CV_ID },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }) as unknown as APIGatewayProxyEventV2;

let db: FakeDynamo;
beforeEach(() => {
  db = new FakeDynamo();
  db.items.set(`USER#${SUB}|CV#${CV_ID}`, {
    PK: `USER#${SUB}`, SK: `CV#${CV_ID}`, id: CV_ID, name: 'Backend CV', text: CV_TEXT,
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
  });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
const call = async (h: ReturnType<typeof createProfilesHandler>, e: APIGatewayProxyEventV2) => {
  const r = (await h(e)) as any;
  return { status: r.statusCode as number, body: r.body ? JSON.parse(r.body) : undefined };
};
const used = () => db.get(`USER#${SUB}`, `QUOTA#${quotaDay()}`)?.profiles ?? 0;

describe('profile prompt and helpers', () => {
  it('carries the no-invent rule, the platform guide, the language and the CV', () => {
    const p = buildProfilePrompt(CV_TEXT, 'djinni', 'uk');
    expect(p).toContain(NO_INVENT_RULE);
    expect(p).toContain('Djinni.co candidate profile');
    expect(p).toContain(`max ${PROFILE_LIMITS.djinni.headline} characters`);
    expect(p).toContain('in Ukrainian');
    expect(p).toContain(`<cv>\n${CV_TEXT}\n</cv>`);
    expect(buildProfilePrompt(CV_TEXT, 'linkedin', 'en')).toContain('LinkedIn profile');
  });

  it('fits text to the platform limits and removes duplicate skills', () => {
    const long = fitProfile({ headline: 'Junior '.repeat(40), about: 'word '.repeat(1000), skills: Array.from({ length: 30 }, (_, i) => `S${i}`) }, 'djinni');
    expect(long.headline.length).toBeLessThanOrEqual(PROFILE_LIMITS.djinni.headline);
    expect(long.headline.endsWith('…')).toBe(true);
    expect(long.about.length).toBeLessThanOrEqual(PROFILE_LIMITS.djinni.about);
    expect(long.skills).toHaveLength(PROFILE_LIMITS.djinni.skills);
    expect(fitProfile(good, 'linkedin').skills).toEqual(['Node.js', 'TypeScript', 'PostgreSQL', 'Git']);
  });

  it('flags skills and numbers that are not in the CV (transliterated names are fine)', () => {
    expect(checkProfile(CV_TEXT, fitProfile(good, 'linkedin'))).toEqual({ skills: [], numbers: [] });
    expect(checkProfile(CV_TEXT, { ...good, about: `${good.about} 3 years of Docker.`, skills: ['Node.js', 'Kubernetes'] })).toEqual({
      skills: ['Docker', 'Kubernetes'],
      numbers: ['3'],
    });
  });
});

describe('POST/GET /cvs/{id}/profile', () => {
  it('writes, stores and returns the profile text per platform', async () => {
    const llm = fakeLlm(good, { ...good, headline: 'Junior Node.js Developer' });
    const h = createProfilesHandler({ client: db, tableName: 't', llm });

    const li = await call(h, ev('POST /cvs/{id}/profile', { body: { platform: 'linkedin', lang: 'en' } }));
    expect(li.status).toBe(201);
    expect(li.body.profile).toMatchObject({
      platform: 'linkedin', lang: 'en', headline: good.headline, skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Git'],
      flagged: { skills: [], numbers: [] }, cvUpdatedAt: '2026-11-02T00:00:00Z',
    });
    expect(llm.generateJson.mock.calls[0]![0]).toContain('LinkedIn profile');

    await call(h, ev('POST /cvs/{id}/profile', { body: { platform: 'djinni' }, lang: 'uk' }));
    const list = await call(h, ev('GET /cvs/{id}/profile'));
    expect(Object.keys(list.body.items).sort()).toEqual(['djinni', 'linkedin']);
    expect(list.body.items.djinni).toMatchObject({ headline: 'Junior Node.js Developer', lang: 'uk' });
    expect(list.body.items.djinni).not.toHaveProperty('PK');
    expect(used()).toBe(2);
    expect([...db.items.values()].filter((i) => String(i.PK).startsWith('EVENT#')).map((e) => e.type)).toEqual(['PROFILE_TEXT', 'PROFILE_TEXT']);
  });

  it('refunds the quota when the AI fails', async () => {
    const h = createProfilesHandler({ client: db, tableName: 't', llm: fakeLlm(new LlmError('timeout', 'slow')) });
    const res = await call(h, ev('POST /cvs/{id}/profile', { body: { platform: 'djinni' } }));
    expect(res.status).toBe(504);
    expect(used()).toBe(0);
  });

  it('enforces the daily limit', async () => {
    db.items.set(`USER#${SUB}|QUOTA#${quotaDay()}`, { PK: `USER#${SUB}`, SK: `QUOTA#${quotaDay()}`, profiles: 10 });
    const llm = fakeLlm(good);
    const res = await call(createProfilesHandler({ client: db, tableName: 't', llm }), ev('POST /cvs/{id}/profile', { body: { platform: 'djinni' } }));
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ error: 'quota_exceeded', kind: 'profile', limit: 10 });
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it("cannot read or write another user's CV profile", async () => {
    const llm = fakeLlm(good);
    const h = createProfilesHandler({ client: db, tableName: 't', llm });
    expect((await call(h, ev('POST /cvs/{id}/profile', { body: { platform: 'djinni' }, sub: 'user-b' }))).status).toBe(404);
    expect((await call(h, ev('GET /cvs/{id}/profile', { sub: 'user-b' }))).status).toBe(404);
    expect(llm.generateJson).not.toHaveBeenCalled();
  });

  it('validates the platform', async () => {
    const h = createProfilesHandler({ client: db, tableName: 't', llm: fakeLlm() });
    expect((await call(h, ev('POST /cvs/{id}/profile', { body: { platform: 'facebook' } }))).status).toBe(400);
  });
});
