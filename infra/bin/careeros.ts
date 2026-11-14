#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CareerOsStack } from '../lib/careeros-stack.js';

const app = new cdk.App();

// The project lives in us-east-1 regardless of the local AWS CLI default region.
// Override with CAREEROS_REGION if really needed.
const region = process.env.CAREEROS_REGION ?? 'us-east-1';

new CareerOsStack(app, 'CareerOsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region,
  },
  description: 'CareerOS - Cloud Infrastructure (Cognito, API Gateway, DynamoDB, CloudFront)',
  tags: { project: 'careeros' },
});
