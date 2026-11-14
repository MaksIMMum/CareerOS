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
- **AWS CLI v2**: Configured for your AWS account (`aws configure`, default region `eu-central-1`)
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

*(Configured in Step 2)*

1. Ensure AWS credentials and SSM parameter are configured:
   ```bash
   aws ssm put-parameter \
     --name /careeros/gemini-api-key \
     --type SecureString \
     --value "<YOUR_GEMINI_KEY>" \
     --region eu-central-1
   ```

2. Bootstrap CDK (first time per account/region):
   ```bash
   cd infra && npx cdk bootstrap aws://<ACCOUNT_ID>/eu-central-1
   ```

3. Build and deploy:
   ```bash
   npm run build
   npm run deploy
   ```
