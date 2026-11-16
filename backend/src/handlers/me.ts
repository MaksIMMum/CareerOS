import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, PutCommand, QueryCommand, DeleteCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { docClient, TABLE_NAME } from '../lib/dynamo.js';
import { logEvent } from '../lib/events.js';
import { withErrorHandling } from '../lib/http.js';

export interface UserProfile {
  PK: string; // USER#<sub>
  SK: string; // PROFILE
  sub: string;
  email: string;
  createdAt: string;
  /** Answer to "Where did you hear about CareerOS?" (one of SOURCE_OPTIONS or 'unknown'). */
  source: string;
  /** Value of the ?src= URL parameter the user arrived with, if any (e.g. 'poster'). */
  src?: string;
  lang: string;
}

/** Allowed answers for the sign-up "Where did you hear about CareerOS?" field. */
export const SOURCE_OPTIONS = [
  'university_chat',
  'poster',
  'dou',
  'telegram',
  'linkedin',
  'friend',
  'other',
] as const;

// CORS headers are added by API Gateway (allowed origins are configured in infra/).
const headers = { 'Content-Type': 'application/json' };

export function normalizeSource(value: unknown): string {
  return typeof value === 'string' && (SOURCE_OPTIONS as readonly string[]).includes(value)
    ? value
    : 'unknown';
}

/** Keeps campaign tags like "poster" or "tg-kpi_2026": lowercase [a-z0-9_-], max 64 chars. */
export function normalizeSrc(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 64);
  return cleaned || undefined;
}

export async function recordLoginDay(
  sub: string,
  client: Pick<DynamoDBDocumentClient, 'send'> = docClient,
  tableName: string = TABLE_NAME,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `USER#${sub}`,
          SK: `LOGINDAY#${today}`,
          date: today,
          createdAt: new Date().toISOString(),
        },
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      }),
    );
    await logEvent(sub, 'LOGIN_DAY', { date: today }, client, tableName);
    return true;
  } catch (err) {
    if (isConditionalCheckFailed(err)) return false;
    console.warn('Failed to record LOGIN_DAY', err);
    return false;
  }
}

function isConditionalCheckFailed(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'ConditionalCheckFailedException';
}

type Client = Pick<DynamoDBDocumentClient, 'send'>;
type Cognito = Pick<CognitoIdentityProviderClient, 'send'>;

/** Every key of a query, following pagination. */
async function queryKeys(
  client: Client,
  input: { TableName: string; IndexName?: string; KeyConditionExpression: string; ExpressionAttributeValues: Record<string, unknown> },
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let start: Record<string, unknown> | undefined;
  do {
    const res = await client.send(new QueryCommand({ ...input, ExclusiveStartKey: start }));
    items.push(...(res.Items ?? []));
    start = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (start);
  return items;
}

/**
 * "Delete my account and data" (privacy page): removes EVERYTHING about the user —
 *  - all USER#<sub> items (profile, CVs, vacancies, analyses, interviews, applications, feedback,
 *    donations, quota, login days);
 *  - the public share cards of their analyses (SHARE#<shareId>), so old links stop working;
 *  - their analytics events (EVENT#… found through GSI1PK = USER#<sub>), which hold the sign-up
 *    e-mail and feedback texts/contacts;
 *  - the Cognito user, last, so a failed run can simply be retried while the session is valid.
 * Nothing new is logged about the deleted user.
 */
export async function deleteAccount(
  sub: string,
  client: Client = docClient,
  tableName: string = TABLE_NAME,
  cognito?: Cognito,
  userPoolId: string | undefined = process.env.USER_POOL_ID,
): Promise<{ deleted: number }> {
  const pk = `USER#${sub}`;
  const own = await queryKeys(client, {
    TableName: tableName,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': pk },
  });
  const events = await queryKeys(client, {
    TableName: tableName,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': pk },
  });
  const shares = own
    .filter((i) => String(i.SK).startsWith('ANALYSIS#') && typeof i.shareId === 'string')
    .map((i) => ({ PK: `SHARE#${String(i.shareId)}`, SK: 'SHARE' }));

  const keys = [...shares, ...events, ...own].map((i) => ({ PK: i.PK, SK: i.SK }));
  for (const Key of keys) {
    await client.send(new DeleteCommand({ TableName: tableName, Key }));
  }

  if (!userPoolId) throw new Error('USER_POOL_ID is not configured');
  try {
    await (cognito ?? new CognitoIdentityProviderClient({})).send(
      new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: sub }),
    );
  } catch (err) {
    if ((err as { name?: string }).name !== 'UserNotFoundException') throw err; // already gone: fine
  }
  return { deleted: keys.length };
}

export async function handleMeRequest(
  event: APIGatewayProxyEventV2,
  client: Client = docClient,
  tableName: string = TABLE_NAME,
  cognito?: Cognito,
): Promise<APIGatewayProxyResultV2> {
  const method = event.requestContext.http.method.toUpperCase();
  const claims = (event.requestContext as any)?.authorizer?.jwt?.claims;
  const sub = claims?.sub as string | undefined;
  const email = (claims?.email as string | undefined) ?? '';

  if (!sub) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized: missing user claims' }),
    };
  }

  const profilePK = `USER#${sub}`;
  const profileSK = 'PROFILE';

  if (method === 'GET') {
    const res = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: profilePK, SK: profileSK },
      }),
    );

    if (!res.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'User profile not found' }),
      };
    }

    await recordLoginDay(sub, client, tableName);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ profile: res.Item }),
    };
  }

  if (method === 'POST') {
    let body: { source?: unknown; src?: unknown; lang?: unknown } = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch {
        // use default body
      }
    }

    // Check if profile exists already
    const existing = await client.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: profilePK, SK: profileSK },
      }),
    );

    if (existing.Item) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ profile: existing.Item }),
      };
    }

    const now = new Date().toISOString();
    const newProfile: UserProfile = {
      PK: profilePK,
      SK: profileSK,
      sub,
      email,
      createdAt: now,
      source: normalizeSource(body.source),
      lang: body.lang === 'en' ? 'en' : 'uk',
    };
    const src = normalizeSrc(body.src);
    if (src) newProfile.src = src;

    try {
      // Conditional write: if two requests race (double tap, two tabs), only one creates the
      // profile, so exactly one SIGNUP event is logged per user.
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: newProfile,
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
    } catch (err) {
      if (!isConditionalCheckFailed(err)) throw err;
      const winner = await client.send(
        new GetCommand({ TableName: tableName, Key: { PK: profilePK, SK: profileSK } }),
      );
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ profile: winner.Item }),
      };
    }

    // Log SIGNUP event
    await logEvent(
      sub,
      'SIGNUP',
      { email, source: newProfile.source, lang: newProfile.lang, ...(src ? { src } : {}) },
      client,
      tableName,
    );
    await recordLoginDay(sub, client, tableName);

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ profile: newProfile }),
    };
  }

  if (method === 'DELETE') {
    try {
      await deleteAccount(sub, client, tableName, cognito);
    } catch (err) {
      // Never claim success when something was left behind; deleting again is safe (idempotent).
      console.error('Account deletion incomplete', { name: (err as Error).name });
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'delete_incomplete' }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}

// Unexpected errors become a plain `{ error: 'internal_error' }` 500 (details only in the logs).
export const handler = withErrorHandling((event) => handleMeRequest(event));
