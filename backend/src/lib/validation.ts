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
  APP_NOTES_MAX: 1_000,
  MAX_APPLICATIONS_PER_USER: 200,
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

// ------------------------------------------------------------------ Applications (tracker)

export const APP_STATUSES = ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] as const;
export type AppStatus = (typeof APP_STATUSES)[number];

/** A calendar date, `YYYY-MM-DD` (the day the CV was sent). */
const isoDate = z.iso.date();

const appFields = {
  vacancyId: z.uuid().nullable(),
  /** Which CV version was sent — the key of the "which CV works" summary. */
  cvId: z.uuid(),
  company: z.string().trim().max(LIMITS.VACANCY_COMPANY_MAX),
  title: requiredText(LIMITS.VACANCY_TITLE_MAX),
  appliedAt: isoDate,
  status: z.enum(APP_STATUSES),
  notes: z.string().trim().max(LIMITS.APP_NOTES_MAX),
  /**
   * Was there an interview before the current status? Set automatically when the status becomes
   * INTERVIEW/OFFER (and cleared on APPLIED); the user can set it for a rejection after an interview.
   */
  hadInterview: z.boolean(),
};

export const applicationCreateSchema = z.object({
  ...appFields,
  vacancyId: appFields.vacancyId.default(null),
  company: appFields.company.default(''),
  appliedAt: isoDate.optional(), // default: today (UTC)
  status: appFields.status.default('APPLIED'),
  notes: appFields.notes.default(''),
  hadInterview: appFields.hadInterview.default(false),
});
export type ApplicationCreateInput = z.infer<typeof applicationCreateSchema>;

/** PATCH: any subset of the editable fields, at least one. */
export const applicationUpdateSchema = z
  .object(appFields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export type ApplicationUpdateInput = z.infer<typeof applicationUpdateSchema>;
