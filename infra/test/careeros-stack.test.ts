import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUrlIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { beforeAll, describe, expect, it } from 'vitest';
import { CareerOsStack } from '../lib/careeros-stack.js';

function makeStack(context: Record<string, string> = {}): CareerOsStack {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'careeros-dist-'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>test</title>');
  const app = new cdk.App({ context });
  const stack = new CareerOsStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'eu-central-1' },
    frontendDistPath: dist,
  });
  return stack;
}

function synth(context: Record<string, string> = {}): Template {
  return Template.fromStack(makeStack(context));
}

describe('CareerOsStack', () => {
  let t: Template;
  beforeAll(() => {
    t = synth({ alertEmail: 'alerts@example.com' });
  }, 120_000);

  it('creates a Cognito pool with email sign-in, 8-char passwords and an admins group', () => {
    t.hasResourceProperties('AWS::Cognito::UserPool', {
      UsernameAttributes: ['email'],
      AutoVerifiedAttributes: ['email'],
      Policies: { PasswordPolicy: Match.objectLike({ MinimumLength: 8 }) },
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
    });
    t.hasResourceProperties('AWS::Cognito::UserPoolClient', { GenerateSecret: false });
    t.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'admins' });
  });

  it('creates the provisioned 5/5 single table with GSI1, retained, PITR off', () => {
    t.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        TableName: 'careeros',
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
        PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false },
        GlobalSecondaryIndexes: [
          Match.objectLike({
            IndexName: 'GSI1',
            ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
          }),
        ],
      }),
    });
  });

  it('serves the SPA through CloudFront with OAC, HTTPS redirect and SPA fallback', () => {
    t.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
        CustomErrorResponses: [
          Match.objectLike({ ErrorCode: 403, ResponseCode: 200, ResponsePagePath: '/index.html' }),
          Match.objectLike({ ErrorCode: 404, ResponseCode: 200, ResponsePagePath: '/index.html' }),
        ],
      }),
    });
    t.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('throttles the HTTP API and restricts CORS', () => {
    t.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: '$default',
      DefaultRouteSettings: { ThrottlingRateLimit: 20, ThrottlingBurstLimit: 40 },
    });
    const apis = t.findResources('AWS::ApiGatewayV2::Api');
    const cors = Object.values(apis)[0]!.Properties.CorsConfiguration;
    expect(cors.AllowOrigins).toHaveLength(2);
    expect(cors.AllowOrigins).toContain('http://localhost:5173');
  });

  it('protects routes with the Cognito JWT authorizer by default', () => {
    const stack = makeStack();
    stack.httpApi.addRoutes({
      path: '/private',
      methods: [apigw.HttpMethod.GET],
      integration: new HttpUrlIntegration('Dummy', 'https://example.com'),
    });
    const tpl = Template.fromStack(stack);
    tpl.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
    });
    tpl.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /private',
      AuthorizationType: 'JWT',
    });
  }, 120_000);

  it('exposes GET /health without auth', () => {
    t.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /health',
      AuthorizationType: 'NONE',
    });
  });

  it('configures handler Lambdas: node22, arm64, 256MB, 29s, TABLE_NAME, 2-week logs', () => {
    t.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs22.x',
      Architectures: ['arm64'],
      MemorySize: 256,
      Timeout: 29,
      Environment: { Variables: Match.objectLike({ TABLE_NAME: Match.anyValue() }) },
    });
    t.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 14 });
    const policies = JSON.stringify(t.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('ssm:GetParameter');
    expect(policies).toContain(':parameter/careeros/gemini-api-key');
    expect(policies).toContain('dynamodb:PutItem');
  });

  it('creates a 1 USD monthly budget when alertEmail is given', () => {
    t.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({
        TimeUnit: 'MONTHLY',
        BudgetLimit: { Amount: 1, Unit: 'USD' },
        CostFilters: { TagKeyValue: ['user:project$careeros'] },
        CostTypes: Match.objectLike({ IncludeCredit: false }),
      }),
    });
    t.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'alerts@example.com',
    });
  });

  it('skips the budget when alertEmail is missing', () => {
    synth().resourceCountIs('AWS::Budgets::Budget', 0);
  }, 120_000);

  it('outputs everything the frontend needs', () => {
    for (const key of ['CloudFrontUrl', 'ApiUrl', 'UserPoolId', 'UserPoolClientId', 'Region']) {
      t.hasOutput(key, {});
    }
  });
});
