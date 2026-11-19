import { HttpError } from './http.js';
import { LIMITS } from './validation.js';
import { parseVacancyPage } from './vacancyParse.js';

export { decodeEntities, htmlToText, parseDou, parseJsonLd, parseVacancyPage, parseWorkUa, tidy } from './vacancyParse.js';

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
