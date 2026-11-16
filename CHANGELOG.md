# Changelog

All notable changes to CareerOS are documented in this file.

## Changes from user feedback

Fill this in as we change things because of real user feedback (the /admin feedback list and
user calls). One line per change: date, what users said (source), what we changed.

<!-- Example: - 2026-11-20 — 3 users found the match score unclear (in-app feedback) → added a "how the score works" tooltip. -->

## Step 9 — hardening (2026-11-16)

- Security: CORS locked to the site (localhost only with `ALLOW_LOCAL_DEV=1`), donation URLs validated,
  `/me` errors return a plain error code; git history scanned for secrets (none).
- Phones: every page checked at 360 px — the tracker summary and `/admin` no longer overflow.
- Accessibility: Lighthouse 100 on the public pages; better contrast, `<main>` landmarks, keyboard-scrollable tables.
- Translated the remaining English-only labels and error messages.
- `npm run smoke` checks a deployed site; README rewritten for a fresh AWS account; report template and demo script.
- AI: Gemini "high demand" errors are retried with backoff and a fallback model.

## Step 8 — validation tools (2026-11-16)

- In-app feedback card after the first analysis and after a finished interview, plus a permanent Feedback button.
- Optional donation prompt (CareerOS Monobank jar) after results, with "I donated" self-reports.
- `/admin` metrics for the `admins` Cognito group: sign-ups per day, real use, return, sources, feedback, donations, anonymised CSV export.
- Privacy page and "Delete my account and data".
