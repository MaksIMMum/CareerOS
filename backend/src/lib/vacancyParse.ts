/**
 * Pure parsers that turn a job-site vacancy page (HTML) into { title, company, text }.
 * No imports and no Node APIs: shared by the backend import (fetched pages) and the
 * Chrome extension (the page the user is looking at).
 */

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

export interface Parsed {
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

/** www.work.ua vacancy page: <h1 id="h1-name">, text in #job-description (used when it has no JSON-LD). */
export function parseWorkUa(html: string): Parsed | null {
  const title = firstMatch(html, /<h1[^>]*id="h1-name"[^>]*>([\s\S]*?)<\/h1>/i) || firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const section = /<div[^>]*id="job-description"[^>]*>([\s\S]*?)<\/div>/i.exec(html);
  const text = section ? htmlToText(section[1]!) : '';
  const company = firstMatch(html, /<a[^>]*href="\/jobs\/by-company\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  return title && text ? { title, company, text } : null;
}

export type VacancySite = 'djinni.co' | 'jobs.dou.ua' | 'work.ua';

export function parseVacancyPage(html: string, site: VacancySite): Parsed | null {
  return (
    parseJsonLd(html) ??
    (site === 'jobs.dou.ua' ? parseDou(html) : site === 'work.ua' ? parseWorkUa(html) : null)
  );
}

