import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createVacancyImportHandler } from './vacancyImport.js';
import { FakeDynamo } from '../test/fakeDynamo.js';
import { quotaDay } from '../lib/quota.js';
import type { Fetcher } from '../lib/vacancyImport.js';

const SUB = 'user-a';
const URL_OK = 'https://djinni.co/jobs/1-junior/';
const PAGE = `<script type="application/ld+json">${JSON.stringify({
  '@type': 'JobPosting',
  title: 'Junior Node.js Developer',
  hiringOrganization: { name: 'Acme' },
  description: 'Node.js, SQL',
})}</script>`;

const ev = (body: unknown, lang = 'uk') =>
  ({
    routeKey: 'POST /vacancies/import',
    headers: { 'accept-language': lang },
    requestContext: { http: { method: 'POST' }, authorizer: { jwt: { claims: { sub: SUB } } } },
    body: JSON.stringify(body),
  }) as unknown as APIGatewayProxyEventV2;

const fetcher = vi.fn(async (url: string | URL | Request) =>
  String(url) === URL_OK ? new Response(PAGE, { status: 200 }) : new Response('', { status: 403 }),
) as unknown as Fetcher;

let db: FakeDynamo;
beforeEach(() => {
  db = new FakeDynamo();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
const imports = () => db.get(`USER#${SUB}`, `QUOTA#${quotaDay()}`)?.imports ?? 0;
const call = async (body: unknown, lang?: string) => {
  const r = (await createVacancyImportHandler({ client: db, tableName: 't', fetcher })(ev(body, lang))) as any;
  return { status: r.statusCode as number, body: JSON.parse(r.body) };
};

describe('POST /vacancies/import', () => {
  it('returns the vacancy fields and counts one import', async () => {
    const res = await call({ url: URL_OK });
    expect(res.status).toBe(200);
    expect(res.body.vacancy).toEqual({ title: 'Junior Node.js Developer', company: 'Acme', url: URL_OK, text: 'Node.js, SQL', site: 'djinni.co' });
    expect(imports()).toBe(1);
    expect([...db.items.values()].some((i) => String(i.SK).startsWith('VACANCY#'))).toBe(false); // nothing saved
  });

  it('does not use up the limit when the site blocks the import', async () => {
    const res = await call({ url: 'https://www.work.ua/jobs/1/' });
    expect(res).toEqual({ status: 422, body: { error: 'import_blocked' } });
    expect(imports()).toBe(0);
  });

  it('rejects unsupported links and bad bodies', async () => {
    expect((await call({ url: 'https://example.com/' })).body.error).toBe('import_unsupported_site');
    expect((await call({})).status).toBe(400);
  });

  it('enforces the daily limit with a translated message', async () => {
    db.items.set(`USER#${SUB}|QUOTA#${quotaDay()}`, { PK: `USER#${SUB}`, SK: `QUOTA#${quotaDay()}`, imports: 30 });
    const res = await call({ url: URL_OK }, 'en');
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ error: 'quota_exceeded', kind: 'vacancyImport', limit: 30 });
    expect(res.body.message).toContain('30 vacancies');
  });
});
