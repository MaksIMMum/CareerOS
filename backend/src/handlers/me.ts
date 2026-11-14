import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamo.js';
import { logEvent } from '../lib/events.js';

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

function isConditionalCheckFailed(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'ConditionalCheckFailedException';
}

export async function handleMeRequest(
  event: APIGatewayProxyEventV2,
  client: Pick<DynamoDBDocumentClient, 'send'> = docClient,
  tableName: string = TABLE_NAME,
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

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ profile: newProfile }),
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  return handleMeRequest(event);
};
