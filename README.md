<div align="center">

# CareerOS

### A practical AI career assistant for junior IT job seekers in Ukraine

Paste a vacancy, upload your CV, and get a clear match analysis, missing keywords,
and a factual rewrite that never invents experience. CareerOS also provides tailored
text interview practice and tracks which CV versions get replies.

[![CI](https://github.com/MaksIMMum/CareerOS/actions/workflows/ci.yml/badge.svg)](https://github.com/MaksIMMum/CareerOS/actions/workflows/ci.yml)
[![Status](https://img.shields.io/badge/status-prototype-blueviolet.svg)](#project-status)
[![Node.js](https://img.shields.io/badge/Node.js-22+-2ea44f?logo=node.js&logoColor=white)](#prerequisites)
[![AWS](https://img.shields.io/badge/AWS-Free%20Tier-ff9900?logo=amazon-aws&logoColor=white)](#architecture)

</div>

> **Project status:** prototype. The landing page and infrastructure foundation are
> in place; CV analysis, authentication, interviews, and tracking are being built
> incrementally.

## What CareerOS does

| Capability | Outcome |
| --- | --- |
| **CV matching** | Compare a CV with a vacancy and surface the strongest matches and gaps. |
| **Factual rewriting** | Rephrase and reorder existing CV content without inventing skills or experience. |
| **Interview practice** | Generate a text mock interview from the vacancy and CV. |
| **Application tracking** | See which CV version produces replies over time. |
| **Ukrainian + English** | Switch the interface language with Ukrainian as the default. |

## Architecture

```text
Browser
  ├─ React + Vite + TypeScript + Tailwind + i18next
  └─ PDF text extraction in the browser
          │
          ▼
CloudFront + private S3 ── API Gateway HTTP API ── Cognito JWT
                                  │
                                  ▼
                         Node.js 22 Lambda handlers
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
              DynamoDB                    Google Gemini REST API
```

The AWS deployment is designed for the AWS Free Tier: Cognito, a provisioned
DynamoDB table, private S3 + CloudFront, API Gateway, ARM64 Lambda, and SSM
Parameter Store for the Gemini key. Secrets are never committed to the repository.

## Data model

One DynamoDB table, `careeros` (provisioned 5 RCU / 5 WCU), keys `PK`/`SK` plus `GSI1` (`GSI1PK`/`GSI1SK`).
Everything a user owns lives in their own partition `USER#<sub>` (`sub` = Cognito user id).
The API builds every key from the caller's JWT, so a user can only ever touch their own items.

| Item | PK | SK | Attributes |
| --- | --- | --- | --- |
| Profile | `USER#<sub>` | `PROFILE` | `email`, `createdAt`, `source` (sign-up answer), `src` (`?src=` tag), `lang` |
| CV version | `USER#<sub>` | `CV#<id>` | `id`, `name` (e.g. "Backend CV"), `text` (≤ 15,000 chars), `createdAt`, `updatedAt` |
| Vacancy | `USER#<sub>` | `VACANCY#<id>` | `id`, `title`, `company`, `url`, `text` (≤ 10,000 chars), `createdAt`, `updatedAt` |
| Daily AI quota | `USER#<sub>` | `QUOTA#<yyyy-mm-dd>` | `analyses` (≤ 10/day), `interviews` (≤ 5/day), `ttl` (auto-deleted after 3 days) |
| Analysis | `USER#<sub>` | `ANALYSIS#<id>` | defined in Step 5 |
| Mock interview | `USER#<sub>` | `INTERVIEW#<id>` | defined in Step 7 |
| Application | `USER#<sub>` | `APP#<id>` | defined in Step 6 |
| Event | `EVENT#<yyyy-mm-dd>` | `<iso time>#<sub>#<type>` | `type` (e.g. `SIGNUP`), `payload`; `GSI1PK=USER#<sub>`, `GSI1SK=<iso time>` |

The quota day follows Kyiv time. Limits per user: 20 CVs, 50 vacancies.

### API

All routes except `/health` require `Authorization: Bearer <Cognito ID token>`; bodies are validated with zod.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Public liveness check, `{ "ok": true }` |
| `GET /me`, `POST /me` | Read / create the profile (first sign-in logs `SIGNUP`) |
| `GET /cvs`, `POST /cvs` | List CV versions (without text) / create one `{ name, text }` |
| `GET /cvs/{id}`, `PUT /cvs/{id}`, `DELETE /cvs/{id}` | Read / replace / delete one CV |
| `GET /vacancies`, `POST /vacancies` | List / create `{ title, company?, url?, text }` |
| `GET /vacancies/{id}`, `PUT /vacancies/{id}`, `DELETE /vacancies/{id}` | Read / replace / delete one vacancy |

Errors are JSON `{ "error": "<code>" }`: `validation_error` (400, with `details`), `unauthorized` (401),
`not_found` (404), `limit_reached` (409), `payload_too_large` (413), and `quota_exceeded` (429, with `kind`,
`limit` and a translated `message`).

### AI client

`backend/src/lib/llm.ts` defines `LlmProvider.generateJson(prompt, schema)`. The `GeminiProvider` calls
`gemini-3.5-flash-lite` (the `GEMINI_MODEL` setting in `infra/lib/careeros-stack.ts`) over REST in JSON mode,
reads the key from SSM once per cold start, retries once on
429/5xx, validates the answer with zod, and always sends the "do not invent experience or skills" rule as
the system instruction. `backend/src/lib/quota.ts` takes one unit of the daily quota before every AI call.

## Repository layout

```text
.
├── backend/       # Node.js 22 Lambda handlers, TypeScript, esbuild, Vitest
├── frontend/      # React single-page app, Vite, Tailwind, i18next
├── infra/         # AWS CDK v2 stack and deployment script
├── .github/
│   └── workflows/ # CI and manual AWS deployment workflows
├── BUILD_PLAN.md  # Product and implementation roadmap
└── CLAUDE.md      # Project conventions and non-negotiable rules
```

## Prerequisites

- Node.js **22+** and npm
- AWS CLI v2 configured for an AWS account
- AWS CDK (use `npx cdk`; global installation is optional)
- A Google Gemini API key

## Run locally

```bash
npm install
npm run dev
```

The frontend is served at `http://localhost:5173`.

Run the repository checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy to AWS

The CDK stack is pinned to `us-east-1` by default. Set `CAREEROS_REGION` only
when intentionally deploying to another region.

### 1. Bootstrap CDK once

```bash
cd infra
npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
cd ..
```

### 2. Store the Gemini key in SSM

Create a free key at <https://aistudio.google.com/apikey> (the "Default Gemini Project" is fine;
don't enable billing). Then, in a normal terminal:

```bash
npm run set-gemini-key        # uses AWS_PROFILE (default: carreros)
```

It asks for the key with masked input (paste with Ctrl+Shift+V), so the key never appears on
screen, in shell history or in Git, and saves it as an encrypted `SecureString` in
`/careeros/gemini-api-key`. Run it again to rotate the key. Never put it in source code, `.env`
files, or GitHub workflow YAML.

The model is `gemini-3.5-flash-lite`: `gemini-2.5-flash` is closed to new keys, and the Gemini 3
Flash models take 15–60 s on the free tier, over API Gateway's ~30 s limit.

### 3. Deploy the stack and frontend

```bash
ALERT_EMAIL=you@example.com npm run deploy
```

The deployment script builds the frontend, deploys `CareerOsStack`, writes the
CloudFormation outputs to `frontend/.env.production`, then rebuilds and deploys
the frontend again if those values changed. It prints the CloudFront URL and API
URL when complete.

Useful commands:

```bash
npm run synth --workspace=infra
npx cdk diff --app "npx tsx infra/bin/careeros.ts"
curl "<API_URL>/health"
```

### Destroy

```bash
npm run destroy --workspace=infra
```

The S3 bucket, CloudFront distribution, API, Lambdas, log groups, and budget are
removed. The DynamoDB table and Cognito User Pool are retained to protect user
data. Delete them manually only when you are certain the data is no longer needed.

## GitHub Actions

### Continuous integration

`.github/workflows/ci.yml` runs on pushes and pull requests. It installs the
workspace dependencies and runs lint, type-checking, tests, and builds on Node.js 22.

### Manual deployment

`.github/workflows/deploy.yml` runs only through **Actions → Deploy to AWS →
Run workflow**. Configure:

1. A repository secret named `AWS_ROLE_ARN` for an AWS IAM role trusted by
   GitHub's OIDC provider.
2. CDK bootstrap and the `/careeros/gemini-api-key` SSM parameter in the target account.
3. Enter the Budget notification email in the workflow's required `alert_email`
   input when starting a deployment.

The workflow uses short-lived OIDC credentials and does not require long-lived
AWS access keys in GitHub.

## Project rules

- Stay within the AWS Free Tier and Gemini free tier.
- Route all user-facing text through i18next with both `uk` and `en` keys.
- Never invent CV experience or skills; AI prompts must explicitly prohibit it.
- Keep secrets out of code and Git.
- Update this README when setup or deployment commands change.

## Project status

CareerOS is being developed as an incremental prototype for junior IT job seekers
in Ukraine. See [`BUILD_PLAN.md`](BUILD_PLAN.md) for the current roadmap.
