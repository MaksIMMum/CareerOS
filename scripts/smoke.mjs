#!/usr/bin/env node
/**
 * Smoke test of a deployed CareerOS: `npm run smoke`.
 *
 * URLs come from SITE_URL / API_URL, or else from infra/cdk-outputs.json (written by `npm run deploy`).
 * Read-only: it creates nothing and needs no login. Exit code 1 if any check fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function deployedUrls() {
  let site = process.env.SITE_URL;
  let api = process.env.API_URL;
  if (!site || !api) {
    const file = path.join(root, 'infra', 'cdk-outputs.json');
    if (!fs.existsSync(file)) {
      console.error('No SITE_URL/API_URL and no infra/cdk-outputs.json. Deploy first or set both variables.');
      process.exit(2);
    }
    const out = JSON.parse(fs.readFileSync(file, 'utf8')).CareerOsStack ?? {};
    site ??= out.CloudFrontUrl;
    api ??= out.ApiUrl;
  }
  return { site: site.replace(/\/$/, ''), api: api.replace(/\/$/, '') };
}

const { site, api } = deployedUrls();
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`  ✗ ${name}: ${err.message}`);
  }
}

const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const get = (url, init) => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), ...init });

console.log(`Smoke test\n  site: ${site}\n  api:  ${api}\n`);

await check('site and API are served over HTTPS', async () => {
  expect(site.startsWith('https://'), `site is not https: ${site}`);
  expect(api.startsWith('https://'), `api is not https: ${api}`);
});

await check('GET /health returns 200 {"ok":true}', async () => {
  const res = await get(`${api}/health`);
  expect(res.status === 200, `status ${res.status}`);
  const body = await res.json();
  expect(body.ok === true, `body ${JSON.stringify(body)}`);
});

await check('site returns 200 with the app shell', async () => {
  const res = await get(`${site}/`);
  expect(res.status === 200, `status ${res.status}`);
  expect((res.headers.get('content-type') ?? '').includes('text/html'), 'not HTML');
  expect((await res.text()).includes('id="root"'), 'no #root element');
});

await check('deep link /app/tracker is served by the SPA (200)', async () => {
  const res = await get(`${site}/app/tracker`);
  expect(res.status === 200, `status ${res.status}`);
});

await check('plain http:// redirects to https://', async () => {
  const res = await get(`${site.replace('https://', 'http://')}/`);
  expect([301, 302, 307, 308].includes(res.status), `status ${res.status}`);
  expect((res.headers.get('location') ?? '').startsWith('https://'), 'no https location');
});

await check('protected API route without a token is rejected (401)', async () => {
  const res = await get(`${api}/cvs`);
  expect(res.status === 401, `status ${res.status}`);
});

await check('admin metrics without a token are rejected (401)', async () => {
  const res = await get(`${api}/admin/metrics`);
  expect(res.status === 401, `status ${res.status}`);
});

await check('unknown public share link returns 404', async () => {
  const res = await get(`${api}/public/shares/AAAAAAAAAAAA`);
  expect(res.status === 404, `status ${res.status}`);
});

const preflight = (origin) =>
  get(`${api}/cvs`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'authorization' },
  });

await check('CORS allows the site origin', async () => {
  const res = await preflight(site);
  expect(res.headers.get('access-control-allow-origin') === site, `allow-origin=${res.headers.get('access-control-allow-origin')}`);
});

await check('CORS does not allow other origins', async () => {
  const res = await preflight('https://evil.example.com');
  const allowed = res.headers.get('access-control-allow-origin');
  expect(!allowed || allowed !== 'https://evil.example.com', `allow-origin=${allowed}`);
});

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
