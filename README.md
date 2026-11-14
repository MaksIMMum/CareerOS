# CareerOS

CareerOS is an AI-powered career assistant designed for junior IT job seekers in Ukraine. It matches your CV against vacancy postings to provide precision gap analyses and factual rewrites without hallucinating experience, prepares you through tailored text mock interviews, and tracks application outcomes to optimize response rates.

## Repository Structure

```text
careeros/
├── backend/       # AWS Lambda handlers (Node.js 22, TypeScript, esbuild, vitest)
├── frontend/      # Single-page web application (React, Vite, TypeScript, Tailwind, i18next)
├── infra/         # AWS CDK v2 TypeScript infrastructure (Cognito, DynamoDB, S3, CloudFront, API Gateway)
├── CLAUDE.md      # Project conventions, rules, and technology stack definitions
├── BUILD_PLAN.md  # Step-by-step roadmap and deployment plan
└── package.json   # Root workspace manager
```

## Prerequisites

- **Node.js**: v22+ (tested with v22/v26) and `npm`
- **AWS CLI v2**: Configured for your AWS account (`aws configure`, default region `us-east-1`)
- **AWS CDK**: `npm install -g aws-cdk` (or via `npx cdk`)
- **Google Gemini API Key**: Stored in AWS SSM Parameter Store as `/careeros/gemini-api-key`

## Run Locally

1. Install all dependencies across all workspaces:
   ```bash
   npm install
   ```

2. Run frontend development server:
   ```bash
   npm run dev
   ```

3. Run tests and typechecks across workspaces:
   ```bash
   npm test
   npm run typecheck
   npm run lint
   ```

## Deploy to AWS

Everything lives in one CDK stack, `CareerOsStack`, in **us-east-1** (N. Virginia). The region is pinned in `infra/bin/careeros.ts`, so your AWS CLI default region doesn't matter. Set `CAREEROS_REGION` to override it.

**What gets created:** Cognito User Pool (email sign-in, verification code, `admins` group) + public SPA client · DynamoDB table `careeros` (PK/SK + GSI1, provisioned 5/5) · private S3 bucket + CloudFront (OAC, HTTPS, SPA fallback) · HTTP API with Cognito JWT authorizer (20 rps / burst 40) · one Lambda per backend handler (Node.js 22, ARM64) · 1 USD monthly AWS Budget with e-mail alerts.

1. **Bootstrap CDK** (once per account and region):
   ```bash
   cd infra && npx cdk bootstrap aws://<ACCOUNT_ID>/us-east-1 && cd ..
   ```

2. **Store the Gemini API key** in SSM Parameter Store (free; never commit it):
   ```bash
   aws ssm put-parameter \
     --name /careeros/gemini-api-key \
     --type SecureString \
     --value "<YOUR_GEMINI_KEY>" \
     --region us-east-1
   ```
   To change it later, run the same command with `--overwrite`.

3. **Deploy everything** (the e-mail gets the budget alerts):
   ```bash
   ALERT_EMAIL=you@example.com npm run deploy
   # or: npm run deploy -- --alert-email you@example.com
   ```
   `npm run deploy` runs `infra/scripts/deploy.ts`, which:
   1. builds the frontend,
   2. runs `cdk deploy` and saves the stack outputs to `infra/cdk-outputs.json`,
   3. writes `frontend/.env.production` (`VITE_API_URL`, `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_REGION`),
   4. if that file changed, rebuilds the frontend and deploys again (S3 upload + CloudFront invalidation).

   At the end it prints the CloudFront URL and the API URL. Check it with `curl <ApiUrl>/health`, which should return `{"ok":true}`.
   After the first deploy, **confirm the SNS subscription e-mail** ("AWS Notification - Subscription Confirmation").

   Useful extras: `npm run synth --workspace=infra` (render the CloudFormation template) and `npx cdk diff` (inside `infra/`).

### Destroy

```bash
npm run destroy --workspace=infra
```

This removes the bucket (and its objects), CloudFront, the API, the Lambdas, the log groups and the budget. To protect user data, the **DynamoDB table `careeros` and the Cognito User Pool are retained**. Delete them by hand if you really want them gone, which you must do for the table before deploying again into the same account:

```bash
aws dynamodb delete-table --table-name careeros --region us-east-1
aws cognito-idp list-user-pools --max-results 10 --region us-east-1   # find the careeros-users id
aws cognito-idp delete-user-pool --user-pool-id <ID> --region us-east-1
```
