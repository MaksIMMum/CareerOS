import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import type { Construct } from 'constructs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..');
const FRONTEND_DIST = path.join(REPO_ROOT, 'frontend', 'dist');
const HANDLERS_DIR = path.join(REPO_ROOT, 'backend', 'src', 'handlers');

export const GEMINI_KEY_PARAM = '/careeros/gemini-api-key';
/** Gemini model used by all AI features (see backend/src/lib/llm.ts for why this one). */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';
/** Used only for the last retry when GEMINI_MODEL keeps answering 503 "high demand" (~2–8 s). */
export const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
export const LOCAL_DEV_ORIGIN = 'http://localhost:5173';

/**
 * One entry per backend handler (backend/src/handlers/<file>.ts).
 * `public: true` routes skip the Cognito JWT authorizer.
 */
interface RouteDef {
  id: string;
  file: string;
  routes: { path: string; methods: apigw.HttpMethod[] }[];
  public?: boolean;
}

const { GET, POST, PUT, PATCH, DELETE } = apigw.HttpMethod;

/** REST resource served by one Lambda: GET+POST /x and GET+PUT+DELETE /x/{id}. */
const crud = (id: string, file: string, path: string): RouteDef => ({
  id,
  file,
  routes: [
    { path, methods: [GET, POST] },
    { path: `${path}/{id}`, methods: [GET, PUT, DELETE] },
  ],
});

const ROUTES: RouteDef[] = [
  { id: 'Health', file: 'health.ts', routes: [{ path: '/health', methods: [GET] }], public: true },
  { id: 'Me', file: 'me.ts', routes: [{ path: '/me', methods: [GET, POST, DELETE] }] },
  crud('Cvs', 'cvs.ts', '/cvs'),
  crud('Vacancies', 'vacancies.ts', '/vacancies'),
  {
    id: 'Analyses',
    file: 'analyses.ts',
    routes: [
      { path: '/analyses', methods: [GET, POST] },
      { path: '/analyses/{id}', methods: [GET] },
      { path: '/analyses/{id}/share', methods: [POST] },
    ],
  },
  // Mock interview: answers are posted one at a time, in order.
  {
    id: 'Interviews',
    file: 'interviews.ts',
    routes: [
      { path: '/interviews', methods: [GET, POST] },
      { path: '/interviews/{id}', methods: [GET] },
      { path: '/interviews/{id}/answers', methods: [POST] },
    ],
  },
  // Application tracker: PATCH changes any subset of fields (e.g. only the status on drag-and-drop).
  {
    id: 'Applications',
    file: 'applications.ts',
    routes: [
      { path: '/applications', methods: [GET, POST] },
      { path: '/applications/{id}', methods: [GET, PATCH, DELETE] },
    ],
  },
  // In-app user feedback
  {
    id: 'Feedback',
    file: 'feedback.ts',
    routes: [{ path: '/feedback', methods: [POST] }],
  },
  // Donations telemetry
  {
    id: 'Donations',
    file: 'donations.ts',
    routes: [
      { path: '/donations/click', methods: [POST] },
      { path: '/donations/report', methods: [POST] },
    ],
  },
  // Admin metrics dashboard
  {
    id: 'Admin',
    file: 'admin.ts',
    routes: [{ path: '/admin/metrics', methods: [GET] }],
  },
  // Read-only share card (job title + score before/after, no CV text) for /s/<id> links.
  {
    id: 'PublicShare',
    file: 'public-share.ts',
    routes: [{ path: '/public/shares/{shareId}', methods: [GET] }],
    public: true,
  },
];

export interface CareerOsStackProps extends cdk.StackProps {
  /** Built SPA directory. Defaults to frontend/dist. */
  frontendDistPath?: string;
}

export class CareerOsStack extends cdk.Stack {
  /** Routes added without an explicit authorizer require a valid Cognito JWT. */
  public readonly httpApi: apigw.HttpApi;

  constructor(scope: Construct, id: string, props: CareerOsStackProps = {}) {
    super(scope, id, props);
    const frontendDist = props.frontendDistPath ?? FRONTEND_DIST;

    // ---------------------------------------------------------------- Cognito
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'careeros-users',
      featurePlan: cognito.FeaturePlan.LITE,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      signInCaseSensitive: false,
      autoVerify: { email: true },
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: false,
        requireUppercase: false,
        requireDigits: false,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // Cognito default sender: free, 50 emails/day — enough for our volume.
      email: cognito.UserPoolEmail.withCognito(),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient('WebClient', {
      userPoolClientName: 'careeros-web',
      generateSecret: false, // public SPA client
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
    });

    new cognito.UserPoolGroup(this, 'AdminsGroup', {
      userPool,
      groupName: 'admins',
      description: 'CareerOS administrators',
    });

    // --------------------------------------------------------------- DynamoDB
    const table = new dynamodb.Table(this, 'Table', {
      tableName: 'careeros',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 5,
      writeCapacity: 5,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false },
      // Items with a `ttl` epoch (e.g. QUOTA#<day>) are deleted automatically (free).
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      readCapacity: 5,
      writeCapacity: 5,
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ------------------------------------------------- Frontend: S3 + CloudFront
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'SiteDistribution', {
      comment: 'CareerOS frontend',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      // SPA fallback: client-side routes resolve to index.html.
      errorResponses: [403, 404].map((httpStatus) => ({
        httpStatus,
        responseHttpStatus: 200,
        responsePagePath: '/index.html',
        ttl: cdk.Duration.seconds(0),
      })),
    });

    if (!fs.existsSync(path.join(frontendDist, 'index.html'))) {
      throw new Error(
        `${frontendDist}/index.html not found. Run "npm run build --workspace=frontend" first ` +
          `(npm run deploy does this automatically).`,
      );
    }

    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(frontendDist)],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
      memoryLimit: 256,
    });

    const siteUrl = `https://${distribution.distributionDomainName}`;

    // ----------------------------------------------------------- HTTP API
    const jwtAuthorizer = new authorizers.HttpUserPoolAuthorizer('CognitoAuthorizer', userPool, {
      userPoolClients: [userPoolClient],
    });

    // CORS is locked to the CloudFront site. `-c allowLocalDev=true` (ALLOW_LOCAL_DEV=1 npm run deploy)
    // also allows http://localhost:5173, for running the frontend locally against this API.
    const allowLocalDev = String(this.node.tryGetContext('allowLocalDev') ?? '') === 'true';

    const httpApi = (this.httpApi = new apigw.HttpApi(this, 'HttpApi', {
      apiName: 'careeros-api',
      createDefaultStage: false,
      defaultAuthorizer: jwtAuthorizer,
      corsPreflight: {
        allowOrigins: allowLocalDev ? [siteUrl, LOCAL_DEV_ORIGIN] : [siteUrl],
        allowMethods: [
          apigw.CorsHttpMethod.GET,
          apigw.CorsHttpMethod.POST,
          apigw.CorsHttpMethod.PUT,
          apigw.CorsHttpMethod.PATCH,
          apigw.CorsHttpMethod.DELETE,
          apigw.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['authorization', 'content-type'],
        maxAge: cdk.Duration.days(1),
      },
    }));

    new apigw.HttpStage(this, 'DefaultStage', {
      httpApi,
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 20, burstLimit: 40 },
    });

    // ----------------------------------------------------------- Lambdas
    const geminiParamArn = cdk.Arn.format(
      {
        service: 'ssm',
        resource: 'parameter',
        resourceName: GEMINI_KEY_PARAM.replace(/^\//, ''),
      },
      this,
    );

    // Team e-mails for the admin "exclude team accounts" filter: passed at deploy time
    // (-c teamEmails=a@x,b@y), never committed — the repository is public.
    const teamEmailsCtx: unknown = this.node.tryGetContext('teamEmails');
    const teamEmails = typeof teamEmailsCtx === 'string' ? teamEmailsCtx : '';
    if (!teamEmails) {
      cdk.Annotations.of(this).addWarning(
        'No teamEmails context given: /admin cannot exclude team accounts. Pass -c teamEmails=a@x.com,b@y.com',
      );
    }

    for (const route of ROUTES) {
      const logGroup = new logs.LogGroup(this, `${route.id}Logs`, {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });

      const fn = new nodejs.NodejsFunction(this, `${route.id}Fn`, {
        entry: path.join(HANDLERS_DIR, route.file),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 256,
        timeout: cdk.Duration.seconds(29),
        logGroup,
        projectRoot: REPO_ROOT,
        depsLockFilePath: path.join(REPO_ROOT, 'package-lock.json'),
        environment: {
          TABLE_NAME: table.tableName,
          ...(route.id === 'Me' ? { USER_POOL_ID: userPool.userPoolId } : {}),
          ...(route.id === 'Admin' ? { TEAM_EMAILS: teamEmails } : {}),
          GEMINI_KEY_PARAM,
          GEMINI_MODEL,
          GEMINI_FALLBACK_MODEL,
          NODE_OPTIONS: '--enable-source-maps',
        },
        bundling: {
          format: nodejs.OutputFormat.ESM,
          target: 'node22',
          minify: true,
          sourceMap: true,
          banner:
            "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
        },
      });

      table.grantReadWriteData(fn);
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['ssm:GetParameter'],
          resources: [geminiParamArn],
        }),
      );
      // Decrypt the SecureString (AWS-managed aws/ssm key), only when called through SSM.
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['kms:Decrypt'],
          resources: ['*'],
          conditions: { StringEquals: { 'kms:ViaService': `ssm.${this.region}.amazonaws.com` } },
        }),
      );
      // "Delete my account" removes the Cognito user: only the /me function may do that.
      if (route.id === 'Me') {
        fn.addToRolePolicy(
          new iam.PolicyStatement({
            actions: ['cognito-idp:AdminDeleteUser'],
            resources: [userPool.userPoolArn],
          }),
        );
      }

      const integration = new integrations.HttpLambdaIntegration(`${route.id}Integration`, fn);
      for (const r of route.routes) {
        httpApi.addRoutes({
          path: r.path,
          methods: r.methods,
          integration,
          ...(route.public ? { authorizer: new apigw.HttpNoneAuthorizer() } : {}),
        });
      }
    }

    // ----------------------------------------------------------- Budget
    const alertEmail: unknown = this.node.tryGetContext('alertEmail');
    if (typeof alertEmail === 'string' && alertEmail.includes('@')) {
      const budgetTopic = new sns.Topic(this, 'BudgetAlerts', {
        displayName: 'CareerOS budget alerts',
      });
      budgetTopic.addSubscription(new subs.EmailSubscription(alertEmail));
      budgetTopic.addToResourcePolicy(
        new iam.PolicyStatement({
          principals: [new iam.ServicePrincipal('budgets.amazonaws.com')],
          actions: ['sns:Publish'],
          resources: [budgetTopic.topicArn],
        }),
      );

      const subscribers = [
        { subscriptionType: 'EMAIL', address: alertEmail },
        { subscriptionType: 'SNS', address: budgetTopic.topicArn },
      ];

      const budget = new budgets.CfnBudget(this, 'MonthlyBudget', {
        budget: {
          budgetName: 'careeros-monthly-1usd',
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: 1, unit: 'USD' },
          // Count only CareerOS resources (all are tagged project=careeros; the tag must be
          // activated once in Billing -> Cost allocation tags). The account hosts other projects.
          costFilters: { TagKeyValue: ['user:project$careeros'] },
          // Count real usage before credits, so the alert fires even while credits pay the bill.
          costTypes: { includeCredit: false, includeRefund: false },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              notificationType: 'ACTUAL',
              comparisonOperator: 'GREATER_THAN',
              threshold: 1, // any real spend (> 1% of 1 USD)
              thresholdType: 'PERCENTAGE',
            },
            subscribers,
          },
          {
            notification: {
              notificationType: 'ACTUAL',
              comparisonOperator: 'GREATER_THAN',
              threshold: 100,
              thresholdType: 'PERCENTAGE',
            },
            subscribers,
          },
          {
            notification: {
              notificationType: 'FORECASTED',
              comparisonOperator: 'GREATER_THAN',
              threshold: 100,
              thresholdType: 'PERCENTAGE',
            },
            subscribers,
          },
        ],
      });
      budget.node.addDependency(budgetTopic);
    } else {
      cdk.Annotations.of(this).addWarning(
        'No alertEmail context given: the 1 USD budget is NOT created. Pass -c alertEmail=you@example.com',
      );
    }

    // ----------------------------------------------------------- Outputs
    new cdk.CfnOutput(this, 'CloudFrontUrl', { value: siteUrl });
    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'Region', { value: this.region });
    new cdk.CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
