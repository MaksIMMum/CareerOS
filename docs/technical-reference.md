# CareerOS — technical reference

Details for developers. Start with the [README](../README.md) for setup and deployment.

## Data model

One DynamoDB table, `careeros` (provisioned 5 RCU / 5 WCU), keys `PK`/`SK` plus `GSI1` (`GSI1PK`/`GSI1SK`).
Everything a user owns lives in their own partition `USER#<sub>` (`sub` = Cognito user id).
The API builds every key from the caller's JWT, so a user can only ever touch their own items.

| Item | PK | SK | Attributes |
| --- | --- | --- | --- |
| Profile | `USER#<sub>` | `PROFILE` | `email`, `createdAt`, `source` (sign-up answer), `src` (`?src=` tag), `lang` |
| CV version | `USER#<sub>` | `CV#<id>` | `id`, `name` (e.g. "Backend CV"), `text` (≤ 15,000 chars), `createdAt`, `updatedAt` |
| Vacancy | `USER#<sub>` | `VACANCY#<id>` | `id`, `title`, `company`, `url`, `text` (≤ 10,000 chars), `createdAt`, `updatedAt` |
| Daily AI quota | `USER#<sub>` | `QUOTA#<yyyy-mm-dd>` | `analyses` (≤ 10/day), `interviews` (≤ 5/day), `shares` (≤ 10/day), `ttl` (auto-deleted after 3 days) |
| Analysis (summary) | `USER#<sub>` | `ANALYSIS#<uuidv7>` | `cvId`, `cvName`, `vacancyId`, `vacancyTitle`, `company`, `lang`, `matchScore`, `flaggedCount`, `createdAt`, `shareId?`, `shareScores?` |
| Analysis (detail) | `USER#<sub>` | `ANALYSISDETAIL#<uuidv7>` | `data` = brotli-compressed JSON: full AI result, post-check flags, CV + vacancy snapshot |
| Public share card | `SHARE#<shareId>` | `SHARE` | `jobTitle`, `scoreBefore`, `scoreAfter`, `createdAt` (+ `ownerSub`, `analysisId`, never returned) |
| Mock interview (summary) | `USER#<sub>` | `INTERVIEW#<uuidv7>` | `cvId`, `cvName`, `vacancyId`, `vacancyTitle`, `company`, `lang`, `status` (`IN_PROGRESS` \| `DONE`), `questionCount`, `answeredCount`, `createdAt`, `finishedAt?`, `overallScore?` (1–10) |
| Mock interview (detail) | `USER#<sub>` | `INTERVIEWDETAIL#<uuidv7>` | `answered` (lock counter), `data` = brotli-compressed JSON: CV + vacancy snapshot, questions (`type`, `topic`, `question`), scored answers, outcome |
| Application | `USER#<sub>` | `APP#<id>` | `id`, `vacancyId?`, `cvId` (the CV version sent), `cvName` (snapshot), `company`, `title`, `appliedAt` (`YYYY-MM-DD`), `status` (`APPLIED` \| `INTERVIEW` \| `OFFER` \| `REJECTED`), `statusChangedAt`, `hadInterview`, `notes` (≤ 1,000 chars), `createdAt`, `updatedAt` |
| Event | `EVENT#<yyyy-mm-dd>` | `<iso time>#<sub>#<type>` | `type` (`SIGNUP`, `LOGIN_DAY`, `ANALYSIS`, `SHARE_CREATED`, `INTERVIEW_STARTED`, `INTERVIEW_DONE`, `APPLICATION_ADDED`, `STATUS_CHANGED`, `FEEDBACK`, `DONATE_CLICK`, `DONATE_REPORTED`), `payload`; `GSI1PK=USER#<sub>`, `GSI1SK=<iso time>` |
| Feedback | `USER#<sub>` | `FEEDBACK#<uuidv7>` | `rating` (1–5), `useful`, `confusing`, `callRequested`, `contact?`, `context` (`analysis` \| `interview` \| `general`), `createdAt` |
| Self-reported donation | `USER#<sub>` | `DONATION#<uuidv7>` | `amount?`, `currency`, `jarUrl?`, `createdAt` |
| Login day | `USER#<sub>` | `LOGINDAY#<yyyy-mm-dd>` | `date`, `createdAt` (one per UTC day; the first one logs `LOGIN_DAY`) |

The quota day follows Kyiv time. Limits per user: 20 CVs, 50 vacancies, 200 applications.

**Tracker replies.** An application counts as a *reply* when it reached `INTERVIEW` or `OFFER`, or was
`REJECTED` after an interview (`hadInterview`, set automatically when a card passes through
INTERVIEW/OFFER, or ticked by the user). A rejection without an interview is not a reply. The "Which CV works"
summary groups applications by `cvId` and compares reply rates; cards that stay in `APPLIED` for more than
7 days get a "follow up?" badge. Adding a card logs `APPLICATION_ADDED`; a status change logs `STATUS_CHANGED`.

**Mock interview.** Starting one asks the AI for 6–8 questions (HR, technical and behavioural, specific to the
vacancy and CV) and uses 1 of 5 daily interviews; answers do not count separately. Each answer is one AI call
(score 1–10, feedback and a better example answer that uses only facts from the CV or the user's own answer,
with `[placeholders]` for anything missing; a post-check flags other skills/numbers). Answers are accepted
strictly in order. Strongest/weakest areas are computed from the per-question topic scores, so finishing needs
no extra AI call and every request stays under the 29 s API limit. Start logs `INTERVIEW_STARTED`, the last
answer logs `INTERVIEW_DONE`. The tracker links each card to the latest interview for the same vacancy.

## API

All routes except `/health` require `Authorization: Bearer <Cognito ID token>`; bodies are validated with zod.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Public liveness check, `{ "ok": true }` |
| `GET /me`, `POST /me` | Read / create the profile (first sign-in logs `SIGNUP`; the first request of each day logs `LOGIN_DAY`) |
| `DELETE /me` | Delete the account: all `USER#<sub>` items, the user's events, public share cards and the Cognito user (`502 delete_incomplete` if anything failed; safe to retry) |
| `GET /cvs`, `POST /cvs` | List CV versions (without text) / create one `{ name, text }` |
| `GET /cvs/{id}`, `PUT /cvs/{id}`, `DELETE /cvs/{id}` | Read / replace / delete one CV |
| `GET /vacancies`, `POST /vacancies` | List / create `{ title, company?, url?, text }` |
| `GET /vacancies/{id}`, `PUT /vacancies/{id}`, `DELETE /vacancies/{id}` | Read / replace / delete one vacancy |
| `POST /analyses` | `{ cvId, vacancyId \| vacancy, lang }` → AI analysis (uses 1 of 10 daily analyses) |
| `GET /analyses`, `GET /analyses/{id}` | History (50 newest, summaries) / full result |
| `POST /analyses/{id}/share` | Re-scores CV before → after once and creates a public card (1 of 10 daily shares) |
| `GET /applications`, `POST /applications` | Tracker cards / add one `{ cvId, title, company?, vacancyId?, appliedAt?, status?, hadInterview?, notes? }` |
| `GET /applications/{id}`, `PATCH /applications/{id}`, `DELETE /applications/{id}` | Read / change any subset of fields (e.g. only `status`) / delete |
| `POST /interviews` | `{ cvId, vacancyId, lang? }` → mock interview with 6–8 questions (uses 1 of 5 daily interviews) |
| `GET /interviews`, `GET /interviews/{id}` | Interview history (50 newest, summaries) / questions, answers and outcome |
| `POST /interviews/{id}/answers` | `{ index, answer, seconds? }` → score, feedback, better answer; `409 wrong_question` if not the next question |
| `POST /feedback` | `{ rating 1–5, useful?, confusing?, callRequested?, contact?, context? }` → stores `FEEDBACK#<id>`, logs `FEEDBACK` |
| `POST /donations/click`, `POST /donations/report` | Log `DONATE_CLICK` / store a self-reported donation `{ amount?, currency? }` and log `DONATE_REPORTED` |
| `GET /admin/metrics` | **Admins only** (Cognito group `admins`, checked in the backend): sign-ups, real use, return, sources, feedback, donations, per-user metrics |
| `GET /public/shares/{shareId}` | **Public**: job title + score before → after only (no CV text) |

Errors are JSON `{ "error": "<code>" }`: `validation_error` (400, with `details`), `unauthorized` (401),
`not_found` (404), `limit_reached` (409), `payload_too_large` (413), `quota_exceeded` (429, with `kind`,
`limit` and a translated `message`), `ai_unavailable` (502) and `ai_timeout` (504). Failed AI calls refund the quota.

## AI client

`backend/src/lib/llm.ts` defines `LlmProvider.generateJson(prompt, schema)`. The `GeminiProvider` calls
`gemini-3.5-flash-lite` (the `GEMINI_MODEL` setting in `infra/lib/careeros-stack.ts`) over REST in JSON mode,
reads the key from SSM once per cold start, validates the answer with zod,
retries a 429/5xx/network error ("model is experiencing high demand") up to 3 times after 1.5 s, 3 s and 5 s
(within a 25 s budget, under API Gateway's 29 s limit) and sends only the last attempt to
`gemini-3.1-flash-lite` (`GEMINI_FALLBACK_MODEL`); a malformed answer gets one fresh attempt, and always sends the "do not invent experience or skills" rule as
the system instruction. `backend/src/lib/quota.ts` takes one unit of the daily quota before every AI call.

**No invented facts.** The analysis prompt (`backend/src/lib/analysis.ts`) forbids adding skills, tools,
employers, dates or numbers that are not in the CV; missing skills come back as advice instead. Then
`backend/src/lib/skillCheck.ts` checks the rewrite in code: any skill/technology or number that does not
appear in the original CV is flagged and shown to the user as a warning (highlighted in the improved CV),
never silently trusted.

The ANALYSIS item uses a time-ordered UUIDv7, so history is sorted newest-first by the sort key; the big
payload lives in a separate compressed `ANALYSISDETAIL#` item to keep reads and writes small on 5 RCU / 5 WCU.

## Security notes

- **Ownership:** every per-user key is built from the caller's Cognito `sub` (from the verified JWT), never
  from the request, so a user can only read or change their own items; a foreign id is simply "not found".
- **Validation:** request bodies are validated with zod (64 KB limit); path ids must be UUIDs.
- **Admin:** `/admin/metrics` checks the `admins` group in the backend, not only in the UI.
- **CORS:** only the CloudFront site origin (`ALLOW_LOCAL_DEV=1` at deploy time adds `http://localhost:5173`).
- **Errors:** responses carry only an error code (`internal_error` for anything unexpected); details stay in
  CloudWatch logs.
- **Secrets:** the Gemini key lives only in SSM Parameter Store (`SecureString`); the git history has been
  scanned for keys, tokens and `.env` files (none). Team e-mails for `/admin` are passed at deploy time.
- **Least privilege:** only the `/me` function may delete Cognito users (account deletion); Lambdas can read
  only the one SSM parameter.
