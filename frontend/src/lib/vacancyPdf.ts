import { LIMITS } from './limits.js';

/**
 * Job title for a vacancy read from a PDF: the first line if it looks like a title
 * (short, not a link or a sentence), otherwise the file name without ".pdf".
 */
export function guessVacancyTitle(text: string, fileName: string): string {
  const first = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const looksLikeTitle =
    first.length >= 3 &&
    first.length <= 100 &&
    !/^https?:|www\.|@/i.test(first) &&
    !/[.!?]$/.test(first) &&
    first.split(/\s+/).length <= 12;
  const fromFile = fileName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
  return (looksLikeTitle ? first : fromFile).slice(0, LIMITS.VACANCY_TITLE_MAX);
}
