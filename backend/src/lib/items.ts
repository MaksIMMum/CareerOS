import { randomUUID } from 'node:crypto';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from './dynamo.js';
import { HttpError, isConditionalCheckFailed } from './http.js';

type Client = Pick<DynamoDBDocumentClient, 'send'>;

export interface ResourceConfig {
  /** Sort-key prefix, e.g. 'CV' -> SK = CV#<id> under PK = USER#<sub>. */
  prefix: string;
  /** Attributes returned by list() — the large `text` is left out to keep responses small. */
  listAttributes: string[];
  maxItems: number;
}

export type StoredItem<T> = T & { id: string; createdAt: string; updatedAt: string };

const userPk = (sub: string) => `USER#${sub}`;

function strip<T>(item: Record<string, unknown>): StoredItem<T> {
  const { PK: _pk, SK: _sk, ...rest } = item;
  return rest as StoredItem<T>;
}

/**
 * CRUD for items owned by one user. Ownership is structural: every key is built from the
 * caller's Cognito `sub`, so a user can never read or change another user's items — a foreign
 * id simply resolves to a key under their own partition and is not found.
 */
export function createResourceRepo<T extends Record<string, unknown>>(
  cfg: ResourceConfig,
  client: Client = docClient,
  tableName: string = TABLE_NAME,
) {
  const key = (sub: string, id: string) => ({ PK: userPk(sub), SK: `${cfg.prefix}#${id}` });

  async function count(sub: string): Promise<number> {
    const res = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': userPk(sub), ':sk': `${cfg.prefix}#` },
        Select: 'COUNT',
      }),
    );
    return res.Count ?? 0;
  }

  return {
    async list(sub: string): Promise<StoredItem<Partial<T>>[]> {
      const names = Object.fromEntries(cfg.listAttributes.map((a, i) => [`#a${i}`, a]));
      const res = await client.send(
        new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          ExpressionAttributeValues: { ':pk': userPk(sub), ':sk': `${cfg.prefix}#` },
          ProjectionExpression: Object.keys(names).join(', '),
          ExpressionAttributeNames: names,
        }),
      );
      const items = (res.Items ?? []).map((i) => strip<Partial<T>>(i));
      return items.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    },

    async get(sub: string, id: string): Promise<StoredItem<T>> {
      const res = await client.send(new GetCommand({ TableName: tableName, Key: key(sub, id) }));
      if (!res.Item) throw new HttpError(404, 'not_found');
      return strip<T>(res.Item);
    },

    async create(sub: string, data: T): Promise<StoredItem<T>> {
      if ((await count(sub)) >= cfg.maxItems) {
        throw new HttpError(409, 'limit_reached', `At most ${cfg.maxItems} items allowed`, {
          max: cfg.maxItems,
        });
      }
      const now = new Date().toISOString();
      const item: StoredItem<T> = { ...data, id: randomUUID(), createdAt: now, updatedAt: now };
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: { ...key(sub, item.id), ...item },
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
      return item;
    },

    async update(sub: string, id: string, data: Partial<T>): Promise<StoredItem<T>> {
      const fields = Object.entries(data);
      const names: Record<string, string> = { '#updatedAt': 'updatedAt' };
      const values: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
      const sets = ['#updatedAt = :updatedAt'];
      fields.forEach(([k, v], i) => {
        names[`#f${i}`] = k;
        values[`:f${i}`] = v;
        sets.push(`#f${i} = :f${i}`);
      });
      try {
        const res = await client.send(
          new UpdateCommand({
            TableName: tableName,
            Key: key(sub, id),
            UpdateExpression: `SET ${sets.join(', ')}`,
            ConditionExpression: 'attribute_exists(PK)',
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ReturnValues: 'ALL_NEW',
          }),
        );
        return strip<T>(res.Attributes ?? {});
      } catch (err) {
        if (isConditionalCheckFailed(err)) throw new HttpError(404, 'not_found');
        throw err;
      }
    },

    async remove(sub: string, id: string): Promise<void> {
      try {
        await client.send(
          new DeleteCommand({
            TableName: tableName,
            Key: key(sub, id),
            ConditionExpression: 'attribute_exists(PK)',
          }),
        );
      } catch (err) {
        if (isConditionalCheckFailed(err)) throw new HttpError(404, 'not_found');
        throw err;
      }
    },
  };
}

export type ResourceRepo<T extends Record<string, unknown>> = ReturnType<
  typeof createResourceRepo<T>
>;
