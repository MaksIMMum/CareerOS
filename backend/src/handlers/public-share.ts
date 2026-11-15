import { GetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamo.js';
import { HttpError, json, withErrorHandling } from '../lib/http.js';
import { SHARE_ID_RE } from '../lib/ids.js';

/** Public, unauthenticated: GET /public/shares/{shareId} -> job title + score before/after only. */
export function createPublicShareHandler(
  client: Pick<DynamoDBDocumentClient, 'send'> = docClient,
  tableName: string = TABLE_NAME,
) {
  return withErrorHandling(async (event) => {
    const shareId = event.pathParameters?.shareId ?? '';
    if (!SHARE_ID_RE.test(shareId)) throw new HttpError(404, 'not_found');
    const res = await client.send(
      new GetCommand({ TableName: tableName, Key: { PK: `SHARE#${shareId}`, SK: 'SHARE' } }),
    );
    if (!res.Item) throw new HttpError(404, 'not_found');
    const { jobTitle, scoreBefore, scoreAfter, createdAt } = res.Item;
    const response = json(200, { jobTitle, scoreBefore, scoreAfter, createdAt });
    return {
      ...(response as object),
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    };
  });
}

export const handler = createPublicShareHandler();
