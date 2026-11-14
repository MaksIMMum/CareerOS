# CareerOS Guidelines & Rules

## Project Description
CareerOS is a web app for junior IT job seekers in Ukraine: paste a vacancy, upload a CV (PDF), get a match score, missing skills/keywords and a rewritten CV (rephrase and reorder only, NEVER invent skills); a text mock interview built from the vacancy+CV; and an application tracker that shows which CV version gets replies. UI in Ukrainian and English.

## Technology Stack

| Part | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind, i18next (UA/EN), pdf.js for CV text extraction in the browser |
| Hosting + HTTPS | S3 (private) + CloudFront, default `*.cloudfront.net` HTTPS |
| Sign-up / sign-in | Amazon Cognito User Pool (email + password, email verification) |
| API | API Gateway HTTP API with Cognito JWT authorizer → Lambda (Node.js 22, TypeScript) |
| Database | DynamoDB, single table, provisioned 5 RCU / 5 WCU (inside always-free) |
| AI | Google Gemini `gemini-2.5-flash` via REST, behind a small provider interface so it can be swapped |
| Infra as code | AWS CDK (TypeScript) in `infra/` |

## Strict Project Rules
1. **Free Tier Only**: Everything must stay inside AWS Free Tier and Gemini free tier; never add paid services (no NAT gateway, no RDS, no Secrets Manager — use SSM Parameter Store).
2. **Localization**: All user-facing text goes through i18next with both `uk` and `en` keys (`uk` default).
3. **No Secrets in Code/Git**: Secrets never in code or git; Gemini API key is read from SSM `/careeros/gemini-api-key`.
4. **No Hallucinated CV Information**: Every AI feature must explicitly instruct in its prompt: *do not invent experience or skills*. Only rephrase and reorder facts present in the CV.
5. **Documentation**: Keep `README.md` updated whenever setup or deploy commands change.
6. **Verification Quality**: After each change, run lint, type-check, and tests to verify clean builds.
