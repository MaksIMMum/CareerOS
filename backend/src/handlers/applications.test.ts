import { beforeEach, describe, expect, it } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createApplicationsHandler, resolveHadInterview } from './applications.js';
import { FakeDynamo } from '../test/fakeDynamo.js';

const SUB = 'user-a';
const CV_A = '11111111-1111-4111-8111-111111111111';
const CV_B = '22222222-2222-4222-8222-222222222222';
const VAC = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-11-16T10:00:00.000Z');

function ev(routeKey: string, opts: { body?: unknown; id?: string; sub?: string } = {}) {
  const [method] = routeKey.split(' ');
  return {
    routeKey,
    headers: {},
    requestContext: { http: { method }, authorizer: { jwt: { claims: { sub: opts.sub ?? SUB } } } },
    pathParameters: opts.id ? { id: opts.id } : undefined,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  } as unknown as APIGatewayProxyEventV2;
}

let db: FakeDynamo;
let h: ReturnType<typeof createApplicationsHandler>;
const call = async (e: APIGatewayProxyEventV2) => {
  const r = (await h(e)) as { statusCode: number; body: string };
  return { status: r.statusCode, body: r.body ? JSON.parse(r.body) : undefined };
};
const events = (type: string) =>
  [...db.items.values()].filter((i) => String(i.PK).startsWith('EVENT#') && i.type === type);
const add = (body: Record<string, unknown> = {}) =>
  call(ev('POST /applications', { body: { cvId: CV_A, title: 'Junior Node.js Developer', company: 'Acme', ...body } }));

beforeEach(() => {
  db = new FakeDynamo();
  for (const [id, name] of [[CV_A, 'Backend CV'], [CV_B, 'General CV']]) {
    db.items.set(`USER#${SUB}|CV#${id}`, { PK: `USER#${SUB}`, SK: `CV#${id}`, id, name, text: 'Node.js' });
  }
  db.items.set(`USER#${SUB}|VACANCY#${VAC}`, { PK: `USER#${SUB}`, SK: `VACANCY#${VAC}`, id: VAC, title: 'Junior', text: 'x' });
  h = createApplicationsHandler({ client: db, tableName: 't', now: () => NOW });
});

describe('POST /applications', () => {
  it('creates an APPLIED card with a CV name snapshot and logs APPLICATION_ADDED', async () => {
    const res = await add({ vacancyId: VAC, notes: '  via Djinni ' });
    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({
      cvId: CV_A, cvName: 'Backend CV', vacancyId: VAC, company: 'Acme', title: 'Junior Node.js Developer',
      appliedAt: '2026-11-16', status: 'APPLIED', statusChangedAt: NOW.toISOString(), hadInterview: false,
      notes: 'via Djinni',
    });
    const stored = db.get(`USER#${SUB}`, `APP#${res.body.item.id}`);
    expect(stored).toBeDefined();
    const [e] = events('APPLICATION_ADDED');
    expect(e?.payload).toEqual({ applicationId: res.body.item.id, cvId: CV_A, vacancyId: VAC, status: 'APPLIED' });
    expect(e?.GSI1PK).toBe(`USER#${SUB}`);
  });

  it('dates the APPLIED status from a backdated appliedAt, so follow-ups work', async () => {
    const res = await add({ appliedAt: '2026-11-01' });
    expect(res.body.item.statusChangedAt).toBe('2026-11-01T00:00:00.000Z');
  });

  it('marks INTERVIEW/OFFER cards as having had an interview', async () => {
    expect((await add({ status: 'INTERVIEW' })).body.item.hadInterview).toBe(true);
    expect((await add({ status: 'APPLIED', hadInterview: true })).body.item.hadInterview).toBe(false);
    expect((await add({ status: 'REJECTED', hadInterview: true })).body.item.hadInterview).toBe(true);
  });

  it("rejects a CV that is not the caller's", async () => {
    const res = await call(ev('POST /applications', { sub: 'user-b', body: { cvId: CV_A, title: 'x' } }));
    expect(res.status).toBe(404);
    expect(events('APPLICATION_ADDED')).toHaveLength(0);
  });

  it('drops a link to a vacancy that no longer exists instead of failing', async () => {
    const res = await add({ vacancyId: '44444444-4444-4444-8444-444444444444' });
    expect(res.status).toBe(201);
    expect(res.body.item.vacancyId).toBeNull();
  });

  it('validates status, dates and lengths', async () => {
    expect((await add({ status: 'GHOSTED' })).status).toBe(400);
    expect((await add({ appliedAt: '16.11.2026' })).status).toBe(400);
    expect((await add({ title: '   ' })).status).toBe(400);
    expect((await add({ notes: 'x'.repeat(1001) })).status).toBe(400);
  });
});

describe('PATCH /applications/{id}', () => {
  it('changes status, stamps statusChangedAt and logs STATUS_CHANGED', async () => {
    const id = (await add({ appliedAt: '2026-11-01' })).body.item.id;
    const res = await call(ev('PATCH /applications/{id}', { id, body: { status: 'INTERVIEW' } }));
    expect(res.status).toBe(200);
    expect(res.body.item).toMatchObject({ status: 'INTERVIEW', statusChangedAt: NOW.toISOString(), hadInterview: true });
    expect(events('STATUS_CHANGED').map((e) => e.payload)).toEqual([
      { applicationId: id, cvId: CV_A, from: 'APPLIED', to: 'INTERVIEW' },
    ]);
  });

  it('keeps "had an interview" when an interviewed application is rejected', async () => {
    const id = (await add()).body.item.id;
    await call(ev('PATCH /applications/{id}', { id, body: { status: 'INTERVIEW' } }));
    const res = await call(ev('PATCH /applications/{id}', { id, body: { status: 'REJECTED' } }));
    expect(res.body.item).toMatchObject({ status: 'REJECTED', hadInterview: true });

    const direct = (await add()).body.item.id;
    const res2 = await call(ev('PATCH /applications/{id}', { id: direct, body: { status: 'REJECTED' } }));
    expect(res2.body.item.hadInterview).toBe(false);
  });

  it('does not log an event or touch statusChangedAt when only notes change', async () => {
    const created = (await add({ appliedAt: '2026-11-01' })).body.item;
    const res = await call(ev('PATCH /applications/{id}', { id: created.id, body: { notes: 'called HR', status: 'APPLIED' } }));
    expect(res.body.item).toMatchObject({ notes: 'called HR', statusChangedAt: '2026-11-01T00:00:00.000Z' });
    expect(events('STATUS_CHANGED')).toHaveLength(0);
  });

  it('refreshes the CV name snapshot when the CV version changes', async () => {
    const id = (await add()).body.item.id;
    const res = await call(ev('PATCH /applications/{id}', { id, body: { cvId: CV_B } }));
    expect(res.body.item).toMatchObject({ cvId: CV_B, cvName: 'General CV' });
  });

  it('rejects an empty patch and unknown ids', async () => {
    const id = (await add()).body.item.id;
    expect((await call(ev('PATCH /applications/{id}', { id, body: {} }))).status).toBe(400);
    expect((await call(ev('PATCH /applications/{id}', { id, sub: 'user-b', body: { notes: 'x' } }))).status).toBe(404);
  });
});

describe('GET / DELETE /applications', () => {
  it('lists only the caller’s applications and deletes them', async () => {
    const id = (await add()).body.item.id;
    await add({ cvId: CV_B });
    expect((await call(ev('GET /applications'))).body.items).toHaveLength(2);
    expect((await call(ev('GET /applications', { sub: 'user-b' }))).body.items).toHaveLength(0);
    expect((await call(ev('GET /applications/{id}', { id }))).body.item.id).toBe(id);
    expect((await call(ev('DELETE /applications/{id}', { id }))).status).toBe(204);
    expect((await call(ev('DELETE /applications/{id}', { id }))).status).toBe(404);
    expect((await call(ev('GET /applications'))).body.items).toHaveLength(1);
  });
});

describe('resolveHadInterview', () => {
  it('follows the status, and only REJECTED keeps the requested value', () => {
    expect(resolveHadInterview('OFFER', false)).toBe(true);
    expect(resolveHadInterview('APPLIED', true)).toBe(false);
    expect(resolveHadInterview('REJECTED', true)).toBe(true);
    expect(resolveHadInterview('REJECTED', false)).toBe(false);
  });
});
