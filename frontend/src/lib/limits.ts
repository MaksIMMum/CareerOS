// Mirrors backend/src/lib/validation.ts LIMITS (the backend enforces them; this is for the UI).
export const LIMITS = {
  CV_NAME_MAX: 80,
  CV_TEXT_MAX: 15_000,
  VACANCY_TEXT_MAX: 10_000,
  PDF_MAX_BYTES: 5 * 1024 * 1024,
  PDF_MAX_PAGES: 20,
  VACANCY_TITLE_MAX: 150,
  VACANCY_COMPANY_MAX: 120,
  APP_NOTES_MAX: 1_000,
} as const;
