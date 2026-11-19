import { describe, expect, it, vi } from 'vitest';
import {
  decodeEntities,
  htmlToText,
  importVacancy,
  parseDou,
  parseJsonLd,
  siteOf,
  type Fetcher,
} from './vacancyImport.js';

const DJINNI_PAGE = `<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Djinni"}</script>
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Junior Node.js Developer',
  hiringOrganization: { '@type': 'Organization', name: 'Acme &amp; Co' },
  description: 'Хто ми?\nКоманда продукту.\n\n\n\nВимоги:\n- Node.js\n- SQL',
})}</script></head><body>…</body></html>`;

const DOU_PAGE = `<div class="l-n"><a href="https://jobs.dou.ua/companies/acme/">Acme</a>
<a class="all-v" href="#">Всі вакансії компанії</a></div>
<h1 class="g-h2">Junior QA Engineer</h1>
<div class="b-typo vacancy-section"><p>We test things.&nbsp;A lot.</p>
<p><strong>Requirements:</strong></p><ul><li>Postman;</li><li>SQL &mdash; basics.</li></ul>
<script>track()</script></div><div class="likely">share</div>`;

function fakeFetch(routes: Record<string, { status: number; body?: string; location?: string }>) {
  return vi.fn(async (url: string | URL | Request) => {
    const r = routes[String(url)];
    if (!r) throw new TypeError('fetch failed');
    return new Response(r.body ?? '', {
      status: r.status,
      headers: r.location ? { location: r.location } : {},
    });
  }) as unknown as Fetcher & ReturnType<typeof vi.fn>;
}

describe('siteOf', () => {
  it('accepts only https links on the supported job sites', () => {
    expect(siteOf('https://djinni.co/jobs/1-x/')).toBe('djinni.co');
    expect(siteOf('https://jobs.dou.ua/companies/a/vacancies/1/')).toBe('jobs.dou.ua');
    expect(siteOf('https://www.work.ua/jobs/1/')).toBe('work.ua');
    expect(siteOf('http://djinni.co/jobs/1/')).toBeNull();
    expect(siteOf('https://djinni.co.evil.com/')).toBeNull();
    expect(siteOf('https://evildjinni.co/')).toBeNull();
    expect(siteOf('https://dou.ua/forums/')).toBeNull(); // only the jobs subdomain
    expect(siteOf('https://user:pw@djinni.co/')).toBeNull();
    expect(siteOf('https://djinni.co:8443/')).toBeNull();
    expect(siteOf('not a url')).toBeNull();
  });
});

describe('HTML helpers', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('A &amp; B &#8212; &#x41; &laquo;x&raquo; &bogus;')).toBe('A & B — A «x» &bogus;');
  });

  it('turns HTML into readable text with list bullets', () => {
    expect(htmlToText('<p>Hi&nbsp;there</p><ul><li>One</li><li>Two</li></ul><script>x()</script><p>End</p>')).toBe(
      'Hi there\n\n• One\n• Two\n\nEnd',
    );
  });
});

describe('parsers', () => {
  it('reads a JobPosting from JSON-LD (Djinni) and tidies blank lines', () => {
    expect(parseJsonLd(DJINNI_PAGE)).toEqual({
      title: 'Junior Node.js Developer',
      company: 'Acme & Co',
      text: 'Хто ми?\nКоманда продукту.\n\nВимоги:\n- Node.js\n- SQL',
    });
  });

  it('reads a DOU vacancy page from its HTML', () => {
    expect(parseDou(DOU_PAGE)).toEqual({
      title: 'Junior QA Engineer',
      company: 'Acme',
      text: 'We test things. A lot.\n\nRequirements:\n\n• Postman;\n• SQL — basics.',
    });
  });

  it('returns null when the page has no vacancy', () => {
    expect(parseJsonLd('<html><title>Djinni</title></html>')).toBeNull();
    expect(parseDou('<h1 class="g-h2">Title only</h1>')).toBeNull();
  });
});

describe('importVacancy', () => {
  it('fetches an allowed page and returns the vacancy', async () => {
    const url = 'https://djinni.co/jobs/1-junior/';
    const fetcher = fakeFetch({ [url]: { status: 200, body: DJINNI_PAGE } });
    expect(await importVacancy(url, fetcher)).toMatchObject({
      title: 'Junior Node.js Developer',
      company: 'Acme & Co',
      url,
      site: 'djinni.co',
    });
    const init = (fetcher.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.redirect).toBe('manual');
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('CareerOS');
  });

  it('follows redirects only within the supported sites', async () => {
    const ok = fakeFetch({
      'https://djinni.co/jobs/1/': { status: 301, location: '/jobs/1-junior/' },
      'https://djinni.co/jobs/1-junior/': { status: 200, body: DJINNI_PAGE },
    });
    expect((await importVacancy('https://djinni.co/jobs/1/', ok)).url).toBe('https://djinni.co/jobs/1-junior/');

    const evil = fakeFetch({ 'https://djinni.co/jobs/2/': { status: 302, location: 'http://169.254.169.254/latest/' } });
    await expect(importVacancy('https://djinni.co/jobs/2/', evil)).rejects.toMatchObject({ code: 'import_unsupported_site' });
    expect(evil).toHaveBeenCalledTimes(1);
  });

  it('never fetches unsupported links', async () => {
    const fetcher = fakeFetch({});
    await expect(importVacancy('https://example.com/job', fetcher)).rejects.toMatchObject({ statusCode: 400, code: 'import_unsupported_site' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('maps blocked, missing and unreadable pages to clear errors', async () => {
    const u = 'https://www.work.ua/jobs/1/';
    await expect(importVacancy(u, fakeFetch({ [u]: { status: 403 } }))).rejects.toMatchObject({ code: 'import_blocked' });
    await expect(importVacancy(u, fakeFetch({ [u]: { status: 404 } }))).rejects.toMatchObject({ code: 'import_not_found' });
    await expect(importVacancy(u, fakeFetch({ [u]: { status: 200, body: '<html></html>' } }))).rejects.toMatchObject({ code: 'import_no_vacancy' });
    await expect(importVacancy(u, fakeFetch({}))).rejects.toMatchObject({ code: 'import_failed' });
  });

  it('clips very long fields to the vacancy limits', async () => {
    const page = DJINNI_PAGE.replace('Junior Node.js Developer', 'J'.repeat(400));
    const u = 'https://djinni.co/jobs/3/';
    const v = await importVacancy(u, fakeFetch({ [u]: { status: 200, body: page } }));
    expect(v.title).toHaveLength(150);
    expect(v.title.endsWith('…')).toBe(true);
  });
});
