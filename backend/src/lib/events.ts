import { PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamo.js';

export interface EventRecord {
  PK: string; // EVENT#yyyy-mm-dd
  SK: string; // <iso time>#<sub>#<type>
  GSI1PK: string; // USER#<sub>
  GSI1SK: string; // <iso time>
  type: string;
  sub: string;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export async function logEvent(
  sub: string,
  type: string,
  payload?: Record<string, unknown>,
  client: Pick<DynamoDBDocumentClient, 'send'> = docClient,
  tableName: string = TABLE_NAME,
): Promise<EventRecord> {
  const now = new Date();
  const isoTime = now.toISOString();
  const dateStr = isoTime.slice(0, 10);

  const eventItem: EventRecord = {
    PK: `EVENT#${dateStr}`,
    SK: `${isoTime}#${sub}#${type}`,
    GSI1PK: `USER#${sub}`,
    GSI1SK: isoTime,
    type,
    sub,
    createdAt: isoTime,
    ...(payload ? { payload } : {}),
  };

  await client.send(
    new PutCommand({
      TableName: tableName,
      Item: eventItem,
    }),
  );

  return eventItem;
}
