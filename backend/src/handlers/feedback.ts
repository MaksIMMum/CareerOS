import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamo.js';
import { logEvent } from '../lib/events.js';
import { getSub, parseJsonBody, json, withErrorHandling } from '../lib/http.js';
import { uuidv7 } from '../lib/ids.js';

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  useful: z.string().max(2000).default(''),
  confusing: z.string().max(2000).default(''),
  callRequested: z.boolean().default(false),
  contact: z.string().max(200).optional(),
  context: z.string().max(50).optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

export interface FeedbackRecord {
  PK: string;
  SK: string;
  id: string;
  sub: string;
  rating: number;
  useful: string;
  confusing: string;
  callRequested: boolean;
  contact?: string;
  context: string;
  createdAt: string;
}

export function createFeedbackHandler(
  client: Pick<DynamoDBDocumentClient, 'send'> = docClient,
  tableName = TABLE_NAME,
) {
  return withErrorHandling(async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const sub = getSub(event);
    const body = parseJsonBody(event, feedbackSchema);
    const id = uuidv7();
    const createdAt = new Date().toISOString();

    const item: FeedbackRecord = {
      PK: `USER#${sub}`,
      SK: `FEEDBACK#${id}`,
      id,
      sub,
      rating: body.rating,
      useful: body.useful,
      confusing: body.confusing,
      callRequested: body.callRequested,
      ...(body.contact?.trim() ? { contact: body.contact.trim() } : {}),
      context: body.context || 'general',
      createdAt,
    };

    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      }),
    );

    await logEvent(
      sub,
      'FEEDBACK',
      {
        feedbackId: id,
        rating: body.rating,
        useful: body.useful,
        confusing: body.confusing,
        callRequested: body.callRequested,
        contact: item.contact,
        context: item.context,
      },
      client,
      tableName,
    );

    return json(201, { item });
  });
}

export const handler = createFeedbackHandler();
