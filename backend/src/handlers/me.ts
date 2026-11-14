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
  source: string;
  lang: string;
}

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

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
    let body: { source?: string; lang?: string } = {};
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
      source: body.source?.trim() || 'unknown',
      lang: body.lang === 'en' ? 'en' : 'uk',
    };

    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: newProfile,
      }),
    );

    // Log SIGNUP event
    await logEvent(
      sub,
      'SIGNUP',
      { email, source: newProfile.source, lang: newProfile.lang },
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
