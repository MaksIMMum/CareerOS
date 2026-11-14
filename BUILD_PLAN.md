#  CareerOS — 9-step build plan for Claude Code

How to use this file:
- Put it in the root of your repo as `BUILD_PLAN.md`.
- Run the steps in order. For each step, start a fresh Claude Code session (`/clear`), paste the prompt, and let it work.
- After each step: check the "Done when" list yourself, then `git commit` and push. Don't start the next step on a broken one.
- Step 1 creates `CLAUDE.md`, which Claude Code reads automatically every session. It keeps the whole project consistent.

Demo is **Thursday 19 November**. Rough schedule: steps 1–3 on Saturday (live HTTPS sign-in by Saturday night, so the 3 points for a working prototype are safe early), steps 4–5 Sunday, 6–7 Monday, 8 Tuesday, 9 Wednesday. **Start inviting real users the moment step 5 is deployed**, because the report (4 points) needs people, and people need days.

----

## Before step 1 (humans, ~30 min, done once)

1. AWS account with MFA on root. Create an IAM user or SSO profile for deployment, then `aws configure` (region **eu-central-1**, Frankfurt).
2. Install: Node.js 22, AWS CLI v2, `npm i -g aws-cdk`, git, Claude Code.
3. Get a free Gemini API key at Google AI Studio (aistudio.google.com). Store it in AWS once:
   `aws ssm put-parameter --name /careeros/gemini-api-key --type SecureString --value "YOUR_KEY" --region eu-central-1`
4. Create an empty GitHub repo `careeros`, clone it, put this file in it.
5. Create a Monobank jar for the volunteer fund you choose and copy its public link (needed in step 8).

Stack chosen to cost **$0** (AWS Free Tier + Gemini free tier):

| Part | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind, i18next (UA/EN), pdf.js for CV text extraction in the browser |
| Hosting + HTTPS | S3 (private) + CloudFront, default `*.cloudfront.net` HTTPS |
| Sign-up / sign-in | Amazon Cognito User Pool (email + password, email verification) |
| API | API Gateway HTTP API with Cognito JWT authorizer → Lambda (Node.js 22, TypeScript) |
| Database | DynamoDB, single table, provisioned 5 RCU / 5 WCU (inside always-free) |
| AI | Google Gemini `gemini-2.5-flash` via REST, behind a small provider interface so it can be swapped |
| Infra as code | AWS CDK (TypeScript) in `infra/` |

---

## Step 1 — Repository skeleton and project rules

```
Read BUILD_PLAN.md fully. We are building CareerOS, a web app for junior IT job seekers in Ukraine:
paste a vacancy, upload a CV (PDF), get a match score, missing skills/keywords and a rewritten CV
(rephrase and reorder only, NEVER invent skills); a text mock interview built from the vacancy+CV;
and an application tracker that shows which CV version gets replies. UI in Ukrainian and English.

Do this step only: create the monorepo skeleton.
1. Top-level folders: backend/, frontend/, infra/, plus README.md, CLAUDE.md, .gitignore, .editorconfig.
   Use npm workspaces from the root package.json so `npm install` at root installs everything.
2. frontend/: Vite + React + TypeScript + Tailwind + react-router + i18next (uk default, en). Just a
   placeholder home page for now.
3. backend/: TypeScript Lambda project (Node.js 22), esbuild bundling, vitest for tests, src/handlers/
   and src/lib/ folders, one `health` handler returning {ok:true}.
4. infra/: AWS CDK v2 TypeScript app with an empty CareerOsStack, region eu-central-1.
5. CLAUDE.md: write the project description above, the stack table from BUILD_PLAN.md, and these rules:
   - everything must stay inside AWS Free Tier and Gemini free tier; never add paid services
     (no NAT gateway, no RDS, no Secrets Manager — use SSM Parameter Store);
   - all user-facing text goes through i18next with both uk and en keys;
   - secrets never in code or git; Gemini key is read from SSM /careeros/gemini-api-key;
   - every AI feature must say in its prompt: do not invent experience or skills;
   - keep README.md updated whenever setup or deploy commands change;
   - after each change, run lint, type-check and tests.
6. README.md first version: what CareerOS is (2–3 sentences), repo structure, prerequisites,
   placeholder sections "Run locally" and "Deploy to AWS".
7. Root npm scripts: lint, typecheck, test, build, deploy (cdk deploy), dev (vite).
Run install, lint, typecheck and tests and show me they pass.
```

**Done when:** `npm install`, `npm run build`, `npm test` pass; the four required top-level parts exist; CLAUDE.md exists.

---

## Step 2 — AWS infrastructure (CDK) and first deploy

```
Read CLAUDE.md. Implement the CDK stack in infra/:
1. Cognito User Pool: self sign-up, sign-in with email, email verification code, password policy
   min 8 chars; a public app client (no secret) for the SPA; a user group "admins".
   Use Cognito's default email sender (free, fine for our volume).
2. DynamoDB single table "careeros" with PK/SK strings and one GSI (GSI1PK/GSI1SK), PROVISIONED
   billing 5/5 for table and GSI, point-in-time recovery off, RemovalPolicy.RETAIN.
3. S3 private bucket for the frontend + CloudFront distribution with Origin Access Control,
   HTTPS redirect, default root index.html, and SPA fallback (403/404 → /index.html, 200).
   Deploy frontend/dist with BucketDeployment and invalidate the cache.
4. HTTP API (API Gateway v2) with a Cognito JWT authorizer, CORS allowing only the CloudFront
   domain and http://localhost:5173, default throttling 20 rps / burst 40.
5. One NodejsFunction per backend handler (start with GET /health, public), Node.js 22, ARM64,
   256 MB, timeout 29 s, log retention 2 weeks, env var TABLE_NAME, IAM read on the SSM parameter
   /careeros/gemini-api-key and read/write on the table.
6. An AWS Budgets monthly budget of 1 USD with email alert to an address passed as CDK context
   (-c alertEmail=...).
7. Stack outputs: CloudFront URL, API URL, UserPoolId, UserPoolClientId, region.
   Write a script that after deploy writes these into frontend/.env.production
   (VITE_API_URL, VITE_USER_POOL_ID, VITE_USER_POOL_CLIENT_ID, VITE_REGION), then rebuilds and
   redeploys the frontend. Make `npm run deploy` do the full sequence.
8. Update README "Deploy to AWS": cdk bootstrap, the SSM key command, npm run deploy, how to destroy.
Then run `cdk synth`, show me the resources, and run the deploy.
```

**Done when:** deploy succeeds; the CloudFront `https://…cloudfront.net` URL opens the placeholder page; `GET <API>/health` returns `{ok:true}`; you received the budget subscription e-mail.

---

## Step 3 — Sign-up and sign-in (the graded prototype)

```
Read CLAUDE.md. Implement authentication in the frontend using only the `aws-amplify/auth`
module (Amplify v6 library, no Amplify hosting/CLI), configured from the VITE_ env vars.
1. Pages: Sign up (email, password, a required consent checkbox "I agree my CV text is processed
   by an AI service; don't upload phone/address if you don't want to", plus optional field
   "Where did you hear about CareerOS?" with options: university chat, poster/QR, DOU, Telegram,
   LinkedIn, friend, other), Confirm code (with resend), Sign in, Forgot/Reset password, Sign out.
2. Store the ?src= URL parameter (e.g. ?src=poster) in localStorage before sign-up and send it with
   the source answer to the backend after first sign-in.
3. Protected routes: /app/* requires a session; redirect to /signin otherwise.
4. API client helper that attaches the Cognito ID token as Authorization: Bearer.
5. Backend: POST /me (authorized) that creates the user profile item on first call
   (PK=USER#sub, SK=PROFILE, email, createdAt, source, lang) and logs a SIGNUP event (see below);
   GET /me returns the profile. Events are items PK=EVENT#yyyy-mm-dd, SK=<iso time>#<sub>#<type>,
   with GSI1PK=USER#sub so we can count per user later. Put event logging in src/lib/events.ts.
6. A simple landing page at / : headline "Check your CV against a vacancy in 60 seconds",
   3 feature bullets, buttons Sign up / Sign in, UA/EN language switch in the header.
7. Mobile-friendly layout (most students will open it from a phone via a Telegram link).
Deploy and give me the URL. Then test the full flow yourself in code where possible and tell me
exactly what to click to verify manually.
```

**Done when:** on your phone, over HTTPS, a new e-mail can sign up, receive the code, confirm, sign in, see an empty `/app` page, and sign out. **Criterion 2 is now met — protect it from here on.**

---

## Step 4 — Data model, CVs, vacancies and the AI client

```
Read CLAUDE.md. Build the backend foundation for the features.
1. DynamoDB items (document them in backend/README or a section of the main README):
   CV#<id>        under USER#sub: name (e.g. "Backend CV"), text, createdAt
   VACANCY#<id>   under USER#sub: title, company, url, text, createdAt
   ANALYSIS#<id>, INTERVIEW#<id>, APP#<id> (defined in later steps)
   QUOTA#<yyyy-mm-dd> under USER#sub: counters of AI calls today
2. REST endpoints (all JWT-protected, all validated with zod, user can only touch own items):
   CRUD for /cvs and /vacancies.
3. Frontend: "My CVs" page — upload a PDF, extract text in the browser with pdfjs-dist, show the
   text for editing, give the version a name, save. Also allow pasting text instead of a PDF.
   Limit CV text to 15,000 characters and vacancy text to 10,000.
4. src/lib/llm.ts: interface LlmProvider { generateJson(prompt, schema) }, a GeminiProvider that
   calls gemini-2.5-flash over REST with responseMimeType application/json, reads the key from SSM
   once per cold start, retries once on 429/5xx, and validates the JSON with zod.
5. Daily quota per user, enforced before any AI call: 10 analyses and 5 mock interviews per day;
   return a friendly 429 with a translated message when exceeded.
6. Unit tests for validation, quota and the LLM JSON parsing (mock the HTTP call).
Deploy and verify a CV PDF can be uploaded, edited and saved.
```

**Done when:** you can save two CV versions (e.g. "Backend CV", "Generic CV") and see them after re-login; tests pass.

---

## Step 5 — CV vs vacancy analysis (the main hook)

```
Read CLAUDE.md. Implement the CV-vs-vacancy feature.
1. POST /analyses {cvId, vacancyText or vacancyId}: save the vacancy if new, call the LLM, store
   ANALYSIS#<id>, log an ANALYSIS event, return the result.
2. The LLM must return JSON: matchScore 0–100, summary, matchedSkills[], missingSkills[],
   missingKeywords[], weakBullets[{original, rewritten, why}], improvedCv (full text).
   Prompt rules: answer in the user's UI language; ONLY rephrase and reorder what is in the CV;
   NEVER add skills, tools, employers, dates or numbers that are not in the CV; for missing skills
   give advice on how to learn/show them instead of inserting them.
3. A post-check in code: flag any word in improvedCv's skills that does not appear in the original
   CV or in the user's edits, and show a warning instead of silently trusting the model.
4. Frontend "New analysis" page: choose CV version, paste vacancy (title, company, text), button
   Analyse with a progress state (up to ~20 s). Result page: big score, matched vs missing chips,
   before/after bullets, improved CV with a Copy button, button "Save this as a new CV version",
   button "Add to tracker", button "Practise interview for this vacancy".
5. A shareable result card: a "Share" button that creates a public read-only link
   /s/<random id> showing only score before → after (re-score the improved CV) and the job title,
   no CV text. This is our growth hook for Telegram/LinkedIn.
6. History page with past analyses.
Deploy, run it on a real vacancy from DOU/Djinni with one of our real CVs, and show me the output.
```

**Done when:** a real CV + real vacancy gives a sensible score in under ~20 s, with no invented skills in the rewrite. **Now start sending the link to real users** (year chats, career centre, Telegram, DOU).

---

## Step 6 — Application tracker

```
Read CLAUDE.md. Implement the tracker.
1. APP#<id> items: vacancyId, cvId (which CV version was sent), company, title, appliedAt,
   status (APPLIED | INTERVIEW | OFFER | REJECTED), statusChangedAt, notes. CRUD endpoints;
   log APPLICATION_ADDED and STATUS_CHANGED events.
2. Frontend board with four columns; drag-and-drop on desktop, a status dropdown on mobile;
   card shows company, title, CV version, dates, notes; "Add to tracker" from an analysis
   pre-fills everything.
3. "Which CV works" summary at the top: for each CV version — sent, replies (status INTERVIEW or
   OFFER or REJECTED-after-interview counts as a reply; define it clearly in the UI), reply rate.
   Highlight the best version with a sentence like "Your Backend CV gets 3× more replies".
4. A reminder badge on cards in APPLIED for more than 7 days: "follow up?".
Deploy and test with 5 fake applications using 2 CV versions, then delete them.
```

**Done when:** the board persists across sessions and the summary correctly compares CV versions.

---

## Step 7 — Text mock interview

```
Read CLAUDE.md. Implement the mock interview.
1. POST /interviews {vacancyId, cvId}: LLM generates 6–8 questions mixed HR / technical /
   behavioural, specific to the vacancy and the CV; store INTERVIEW#<id>.
2. One question at a time in the UI with a text answer box and optional timer.
   POST /interviews/<id>/answers sends each answer; the LLM returns score 1–10, short feedback,
   and a better example answer that uses only facts from the user's CV (or clearly marked
   placeholders like [your project]).
3. Final screen: overall score, strongest/weakest areas, list of all Q/A with feedback; saved in
   history and linked to the tracker card for that vacancy. Log INTERVIEW_DONE when finished.
4. Count each interview as 1 against the daily interview quota (answers don't count separately),
   and keep each LLM call under the 29 s API limit.
Deploy and run one full interview yourself.
```

**Done when:** a full interview runs end-to-end on a phone and appears in history.

---

## Step 8 — Validation tools: metrics, feedback, donations (for the report and the bonus)

```
Read CLAUDE.md. Add everything we need to measure real users for our report.
1. Events: make sure we log SIGNUP, LOGIN_DAY (first authorized request of each day per user),
   ANALYSIS, INTERVIEW_DONE, APPLICATION_ADDED, STATUS_CHANGED, SHARE_CREATED, FEEDBACK,
   DONATE_CLICK, DONATE_REPORTED.
2. Admin page /admin (only Cognito group "admins"; check the group claim in the backend too):
   - totals and per-day chart of sign-ups;
   - our one-pager signals: % of sign-ups with 2+ analyses or 1 finished interview ("real use"),
     % who came back on another day and added a vacancy to the tracker within 7 days ("return");
   - sign-ups by source (?src and the "where did you hear" answer);
   - list of feedback messages; donation clicks and self-reported donations;
   - "Export CSV" of anonymised per-user metrics (no e-mails, no CV text) for the report;
   - checkbox "exclude team accounts" (list of our e-mails in an env var).
3. In-app feedback: after the first analysis result and after a finished interview, a small card:
   rating 1–5, "What was most useful?", "What was confusing or missing?", and
   "Can we call you for 15 minutes? (optional contact)". Also a permanent Feedback button.
4. Donation prompt right after a user sees a result (never a paywall): short text in UA/EN
   "CareerOS is free. If it helped, donate any amount to <fund name>" with a button to our
   Monobank jar (URL from env var VITE_DONATION_URL). Ask them to write their CareerOS nickname in
   the jar comment. After clicking, show "I donated" (optional amount) → DONATE_REPORTED.
5. Privacy page (UA/EN): what we store, that CV text is sent to Google Gemini for analysis,
   and a "Delete my account and data" button in settings that deletes all USER#sub items and
   the Cognito user.
6. A CHANGELOG.md section "Changes from user feedback" that we fill in as we change things.
Deploy. Tell me the command to add my account to the admins group.
```

**Done when:** `/admin` shows real numbers; you can export the CSV; the donate button opens the jar. Keep screenshots of the jar (with the CareerOS comments) and of `/admin` for the report.

---

## Step 9 — Hardening, final README, report pack

```
Read CLAUDE.md. Final pass before the demo.
1. Fix every bug in BUGS.md (we will list what users reported there) and every item marked TODO.
2. Security review: every endpoint checks ownership; inputs validated; no secrets in the repo
   (scan git history); CORS locked to our domain; admin endpoints check the group; error messages
   don't leak internals.
3. Quality: loading and empty states everywhere, translated error messages, works on a 360px
   phone screen, Lighthouse accessibility check on the main pages.
4. Tests: backend unit tests pass; add a smoke script `npm run smoke` that hits the deployed /health
   and checks the site returns 200 over HTTPS.
5. Final README.md written for a stranger: what CareerOS is and who it's for; live URL; screenshot;
   architecture diagram (Mermaid: CloudFront/S3 → Cognito → API Gateway → Lambda → DynamoDB,
   Lambda → Gemini); repo structure (backend/, frontend/, infra/); prerequisites; run locally;
   deploy step-by-step from a fresh AWS account including the SSM key and cdk bootstrap; how to make
   an admin; cost notes (free tier); how to destroy; team.
6. Create docs/report-template.md for our user-feedback report with sections: who we showed it to
   (channels, dates), how many people tried it (numbers from /admin, team excluded), signals vs our
   one-pager targets (10 sign-ups, 40% real use, 30% return, 3 donations, 5 calls), what users said
   (quotes from feedback and calls), what we changed because of it (from CHANGELOG.md, with before/
   after screenshots), money evidence (jar screenshots, donation count), what we would do next.
7. Final deploy, run smoke test, and give me a 3-minute demo script: sign up → analyse CV →
   share card → tracker → mock interview → admin metrics.
```

**Done when:** a teammate who didn't build it can follow the README from scratch; the smoke test passes; the report template is ready to fill.

---

## Grading checklist

| Criterion | Where it comes from |
|---|---|
| Repo with backend/, frontend/, infra/, README (3) | Steps 1, 2, 9 |
| Deployed HTTPS prototype with sign-up/sign-in (3) | Steps 2–3 (done by day 1) |
| Report with user feedback (4) | Steps 5 (start users), 8 (metrics, feedback, calls), 9 (template) |
| Bonus: users paid/donated | Step 8 (Monobank jar + "I donated" + screenshots) |

Tips:
- Your one-pager says "10 sign-ups in 10 days", but you have about 4 days of real users before the demo. Report the honest number and the time window. Teachers usually value that more than an inflated number.
- Book the five 15-minute calls as soon as people tick "you can call me". Write down one change per call, ship it, and log it in CHANGELOG.md. That is the "what you changed" part of the report.
- If Claude Code goes off track inside a step, stop it, `git checkout .`, and paste the prompt again with one extra sentence about what went wrong. Don't patch on top of a mess.
- Gemini's free tier may use prompts to improve Google's products. That's why the consent text and privacy page exist. Tell users not to upload their phone number or address.
