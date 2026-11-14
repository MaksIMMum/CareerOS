import { z } from 'zod';

/** Shared limits; the frontend mirrors these in src/lib/limits.ts. */
export const LIMITS = {
  CV_NAME_MAX: 80,
  CV_TEXT_MAX: 15_000,
  VACANCY_TITLE_MAX: 150,
  VACANCY_COMPANY_MAX: 120,
  VACANCY_URL_MAX: 500,
  VACANCY_TEXT_MAX: 10_000,
  MAX_CVS_PER_USER: 20,
  MAX_VACANCIES_PER_USER: 50,
} as const;

const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const cvInputSchema = z.object({
  name: requiredText(LIMITS.CV_NAME_MAX),
  text: requiredText(LIMITS.CV_TEXT_MAX),
});
export type CvInput = z.infer<typeof cvInputSchema>;

export const vacancyInputSchema = z.object({
  title: requiredText(LIMITS.VACANCY_TITLE_MAX),
  company: z.string().trim().max(LIMITS.VACANCY_COMPANY_MAX).default(''),
  url: z
    .union([
      z.literal(''),
      z.url({ protocol: /^https?$/, hostname: z.regexes.domain }).max(LIMITS.VACANCY_URL_MAX),
    ])
    .default(''),
  text: requiredText(LIMITS.VACANCY_TEXT_MAX),
});
export type VacancyInput = z.infer<typeof vacancyInputSchema>;
