import { HttpError } from './http.js';
import { LIMITS } from './validation.js';

/**
 * Import a vacancy from a job-site link: fetch the page and pull out title, company and text.
 *
 * Only these sites are fetched (no arbitrary URLs → no SSRF), over https, following redirects
 * only to the same list. Djinni (and any page with schema.org JSON-LD) is read from the
 * JobPosting data; DOU from its HTML. Work.ua is allowed but often answers with a bot
 * challenge — then the user gets a clear "paste the text instead" error.
 */

export const IMPORT_SITES = ['djinni.co', 'jobs.dou.ua', 'work.ua'] as const;
export type ImportSite = (typeof IMPORT_SITES)[number];

export interface ImportedVacancy {
  title: string;
  company: string;
  url: string;
  text: string;
  site: ImportSite;
}

const MAX_PAGE_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const USER_AGENT = 'Mozilla/5.0 (compatible; CareerOS-VacancyImport/1.0)';

/** The supported site for a URL, or null. Accepts www. and other subdomains of the listed hosts. */
export function siteOf(rawUrl: string): ImportSite | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  return IMPORT_SITES.find((s) => host === s || host.endsWith(`.${s}`)) ?? null;
}

// ------------------------------------------------------------------ HTML → text

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', laquo: '«',
  raquo: '»', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', bull: '•', middot: '·',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Readable plain text from an HTML fragment: paragraphs, line breaks and "• " list items. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '') // <li> already starts a new line
    .replace(/<\/(p|div|ul|ol|h[1-6]|tr|section|blockquote)>/gi, '\n')
    .replace(/<(p|div|ul|ol|h[1-6]|tr|section|blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return tidy(decodeEntities(text));
}

/** Trims every line, removes repeated spaces and keeps at most one blank line in a row. */
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const firstMatch = (html: string, re: RegExp) => {
  const m = re.exec(html);
  return m?.[1] !== undefined ? tidy(decodeEntities(m[1].replace(/<[^>]+>/g, ''))) : '';
};

// ------------------------------------------------------------------ Parsers

interface Parsed {
  title: string;
  company: string;
  text: string;
}

/** schema.org JobPosting from <script type="application/ld+json"> blocks (Djinni, Work.ua, …). */
export function parseJsonLd(html: string): Parsed | null {
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]!.trim());
    } catch {
      continue;
    }
    const nodes: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray((data as { '@graph'?: unknown[] })?.['@graph'])
        ? (data as { '@graph': unknown[] })['@graph']
        : [data];
    for (const n of nodes) {
      const node = n as Record<string, unknown>;
      const type = node?.['@type'];
      if (type !== 'JobPosting' && !(Array.isArray(type) && type.includes('JobPosting'))) continue;
      const org = node.hiringOrganization as { name?: unknown } | string | undefined;
      const company = typeof org === 'string' ? org : typeof org?.name === 'string' ? org.name : '';
      const description = typeof node.description === 'string' ? node.description : '';
      // Descriptions are HTML on some sites and plain text on others; htmlToText handles both.
      const text = /<[a-z][\s\S]*>/i.test(description) ? htmlToText(description) : tidy(decodeEntities(description));
      const title = typeof node.title === 'string' ? tidy(decodeEntities(node.title)) : '';
      if (title && text) return { title, company: tidy(decodeEntities(company)), text };
    }
  }
  return null;
}

/** jobs.dou.ua vacancy page: <h1 class="g-h2">, company link in .l-n, text in .vacancy-section. */
export function parseDou(html: string): Parsed | null {
  const title = firstMatch(html, /<h1[^>]*class="[^"]*\bg-h2\b[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  const company = firstMatch(html, /<div[^>]*class="[^"]*\bl-n\b[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/i);
  const section = /<div[^>]*class="[^"]*\bvacancy-section\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  const text = section ? htmlToText(section[1]!) : '';
  return title && text ? { title, company, text } : null;
}

export function parseVacancyPage(html: string, site: ImportSite): Parsed | null {
  return parseJsonLd(html) ?? (site === 'jobs.dou.ua' ? parseDou(html) : null);
}

// ------------------------------------------------------------------ Fetching

export type Fetcher = typeof fetch;

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PAGE_BYTES) {
      await reader.cancel();
      throw new HttpError(422, 'import_failed', 'Page is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Fetches an allowed page, following redirects only within the allowed sites. */
async function fetchPage(url: string, fetcher: Fetcher): Promise<{ html: string; finalUrl: string; site: ImportSite }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const site = siteOf(current);
    if (!site) throw new HttpError(400, 'import_unsupported_site');
    let res: Response;
    try {
      res = await fetcher(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html', 'Accept-Language': 'uk,en;q=0.8' },
      });
    } catch (err) {
      console.error('vacancy import: fetch failed', { url: current, err: (err as Error).name });
      throw new HttpError(502, 'import_failed');
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new HttpError(502, 'import_failed');
      current = new URL(location, current).toString();
      continue;
    }
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      throw new HttpError(422, 'import_blocked'); // bot challenge / rate limit on the site
    }
    if (res.status === 404 || res.status === 410) throw new HttpError(422, 'import_not_found');
    if (!res.ok) throw new HttpError(502, 'import_failed');
    return { html: await readLimited(res), finalUrl: current, site };
  }
  throw new HttpError(502, 'import_failed');
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

export async function importVacancy(url: string, fetcher: Fetcher = fetch): Promise<ImportedVacancy> {
  if (!siteOf(url)) throw new HttpError(400, 'import_unsupported_site');
  const { html, finalUrl, site } = await fetchPage(url, fetcher);
  const parsed = parseVacancyPage(html, site);
  if (!parsed) throw new HttpError(422, 'import_no_vacancy');
  return {
    title: clip(parsed.title, LIMITS.VACANCY_TITLE_MAX),
    company: clip(parsed.company, LIMITS.VACANCY_COMPANY_MAX),
    url: finalUrl.length <= LIMITS.VACANCY_URL_MAX ? finalUrl : url.slice(0, LIMITS.VACANCY_URL_MAX),
    text: clip(parsed.text, LIMITS.VACANCY_TEXT_MAX),
    site,
  };
}
