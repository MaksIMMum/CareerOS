import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamo.js';
import { logEvent } from '../lib/events.js';
import { getSub, parseJsonBody, json, withErrorHandling, HttpError } from '../lib/http.js';
import { uuidv7 } from '../lib/ids.js';

export const donationReportSchema = z.object({
  amount: z.number().positive().max(100000).optional(),
  currency: z.string().max(10).default('UAH'),
  jarUrl: z.url({ protocol: /^https$/ }).max(500).optional(),
});

export const donationClickSchema = z.object({
  url: z.url({ protocol: /^https$/ }).max(500).optional(),
});

export function createDonationsHandler(
  client: Pick<DynamoDBDocumentClient, 'send'> = docClient,
  tableName = TABLE_NAME,
) {
  return withErrorHandling(async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const sub = getSub(event);
    const path = event.rawPath || event.requestContext.http.path;

    if (path.endsWith('/click')) {
      const body = parseJsonBody(event, donationClickSchema);
      await logEvent(sub, 'DONATE_CLICK', { url: body.url }, client, tableName);
      return json(200, { ok: true });
    }

    if (path.endsWith('/report')) {
      const body = parseJsonBody(event, donationReportSchema);
      const id = uuidv7();
      const createdAt = new Date().toISOString();

      const item = {
        PK: `USER#${sub}`,
        SK: `DONATION#${id}`,
        id,
        sub,
        amount: body.amount,
        currency: body.currency,
        jarUrl: body.jarUrl,
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
        'DONATE_REPORTED',
        {
          donationId: id,
          amount: body.amount,
          currency: body.currency,
        },
        client,
        tableName,
      );

      return json(201, { ok: true, id, item });
    }

    throw new HttpError(404, 'not_found');
  });
}

export const handler = createDonationsHandler();
