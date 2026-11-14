#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CareerOsStack } from '../lib/careeros-stack.js';

const app = new cdk.App();

new CareerOsStack(app, 'CareerOsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-central-1',
  },
  description: 'CareerOS - Cloud Infrastructure (Cognito, API Gateway, DynamoDB, CloudFront)',
});
