import * as cdk from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export class CareerOsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Placeholder stack for CareerOS (Step 1)
    // Infrastructure resources will be added in Step 2:
    // Cognito, DynamoDB, S3/CloudFront, API Gateway, Lambdas, Budgets.
  }
}
