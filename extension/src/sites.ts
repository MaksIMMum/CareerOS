// The backend's pure HTML parsers, shared so the extension reads the page exactly like the import does.
import { parseVacancyPage, tidy, type VacancySite } from '../../backend/src/lib/vacancyParse.js';
import { LIMITS } from '../../frontend/src/lib/limits.js';

export type { VacancySite };

export interface PageVacancy {
  title: string;
  company: string;
  url: string;
  text: string;
  site: VacancySite;
}

const SITES: VacancySite[] = ['djinni.co', 'jobs.dou.ua', 'work.ua'];

/** The supported job site for a URL (https only), or null. */
export function siteOf(rawUrl: string | undefined): VacancySite | null {
  if (!rawUrl) return null;
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase();
  return SITES.find((s) => host === s || host.endsWith(`.${s}`)) ?? null;
}

/** Is this the page of one vacancy (not a list or a company page)? */
export function isVacancyUrl(rawUrl: string | undefined): boolean {
  const site = siteOf(rawUrl);
  if (!site) return false;
  const path = new URL(rawUrl!).pathname;
  switch (site) {
    case 'djinni.co':
      return /^\/jobs\/\d+/.test(path);
    case 'jobs.dou.ua':
      return /^\/companies\/[^/]+\/vacancies\/\d+/.test(path);
    case 'work.ua':
      return /^\/(?:(?:ru|en)\/)?jobs\/\d+/.test(path);
  }
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** Vacancy fields clipped to the API limits, so an analysis request never fails validation. */
export function toPageVacancy(
  v: { title: string; company: string; text: string },
  url: string,
  site: VacancySite,
): PageVacancy {
  return {
    title: clip(v.title.trim(), LIMITS.VACANCY_TITLE_MAX),
    company: clip(v.company.trim(), LIMITS.VACANCY_COMPANY_MAX),
    url: url.length <= 500 ? url : '',
    text: clip(v.text.trim(), LIMITS.VACANCY_TEXT_MAX),
    site,
  };
}

/** Reads the vacancy from a page's HTML, or null when the page has none. */
export function readVacancy(page: { url: string; html: string }): PageVacancy | null {
  const site = siteOf(page.url);
  if (!site) return null;
  const parsed = parseVacancyPage(page.html, site);
  return parsed ? toPageVacancy(parsed, page.url, site) : null;
}

/** The text the user selected on the page, as a vacancy (title from the page title). */
export function vacancyFromSelection(page: { url: string; title: string; selection: string }): PageVacancy | null {
  const site = siteOf(page.url);
  const text = tidy(page.selection);
  if (!site || text.length < 40) return null;
  // "Junior Dev в Acme – Djinni" / "... | DOU" → "Junior Dev в Acme"
  const title = page.title.replace(/\s*[–|-]\s*(Djinni|DOU|Work\.ua).*$/i, '').trim() || 'Vacancy';
  return toPageVacancy({ title, company: '', text }, page.url, site);
}
