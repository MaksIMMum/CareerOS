import { GetCommand, UpdateCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { docClient, TABLE_NAME } from './dynamo.js';
import { isConditionalCheckFailed, json, type Lang } from './http.js';

type Client = Pick<DynamoDBDocumentClient, 'send'>;

/** AI calls allowed per user per day (Kyiv calendar day). */
/** `share` = the before/after re-score made when a result is shared (once per analysis). */
/** `coverLetter` = a cover letter generated (or regenerated) from an analysis. */
/** `profile` = Djinni / LinkedIn profile text from a CV. `vacancyImport` = a vacancy read from a link (no AI). */
export const DAILY_LIMITS = {
  analysis: 10,
  interview: 5,
  share: 10,
  coverLetter: 10,
  profile: 10,
  vacancyImport: 30,
} as const;
export type QuotaKind = keyof typeof DAILY_LIMITS;

// Counter attribute on the QUOTA#<day> item for each kind.
const COUNTER: Record<QuotaKind, string> = {
  analysis: 'analyses',
  interview: 'interviews',
  share: 'shares',
  coverLetter: 'coverLetters',
  profile: 'profiles',
  vacancyImport: 'imports',
};

/** The quota day in Ukraine's time zone, so limits reset at local midnight. */
export function quotaDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // en-CA formats as yyyy-mm-dd
}

export class QuotaExceededError extends Error {
  constructor(
    public readonly kind: QuotaKind,
    public readonly limit: number,
  ) {
    super(`Daily ${kind} quota of ${limit} reached`);
    this.name = 'QuotaExceededError';
  }
}

interface QuotaDeps {
  client?: Client;
  tableName?: string;
  now?: Date;
}

const quotaKey = (sub: string, now: Date) => ({ PK: `USER#${sub}`, SK: `QUOTA#${quotaDay(now)}` });

/**
 * Atomically takes one unit of today's quota, BEFORE the AI call. The conditional update
 * means parallel requests can never go over the limit. Throws QuotaExceededError when used up.
 * Items carry `ttl` (DynamoDB TTL) so old days are deleted automatically.
 */
export async function consumeQuota(
  sub: string,
  kind: QuotaKind,
  { client = docClient, tableName = TABLE_NAME, now = new Date() }: QuotaDeps = {},
): Promise<{ used: number; limit: number; remaining: number }> {
  const limit = DAILY_LIMITS[kind];
  const ttl = Math.floor(now.getTime() / 1000) + 3 * 24 * 60 * 60;
  try {
    const res = await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: quotaKey(sub, now),
        UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :one, #ttl = :ttl',
        ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
        ExpressionAttributeNames: { '#c': COUNTER[kind], '#ttl': 'ttl' },
        ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':limit': limit, ':ttl': ttl },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    const used = Number(res.Attributes?.[COUNTER[kind]] ?? 1);
    return { used, limit, remaining: Math.max(0, limit - used) };
  } catch (err) {
    if (isConditionalCheckFailed(err)) throw new QuotaExceededError(kind, limit);
    throw err;
  }
}

/** Gives the unit back when the AI call failed on our side, so users don't pay for errors. */
export async function refundQuota(
  sub: string,
  kind: QuotaKind,
  { client = docClient, tableName = TABLE_NAME, now = new Date() }: QuotaDeps = {},
): Promise<void> {
  try {
    await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: quotaKey(sub, now),
        UpdateExpression: 'SET #c = #c - :one',
        ConditionExpression: '#c > :zero',
        ExpressionAttributeNames: { '#c': COUNTER[kind] },
        ExpressionAttributeValues: { ':zero': 0, ':one': 1 },
      }),
    );
  } catch (err) {
    if (!isConditionalCheckFailed(err)) throw err;
  }
}

export async function getQuotaUsage(
  sub: string,
  { client = docClient, tableName = TABLE_NAME, now = new Date() }: QuotaDeps = {},
): Promise<Record<QuotaKind, { used: number; limit: number }>> {
  const res = await client.send(new GetCommand({ TableName: tableName, Key: quotaKey(sub, now) }));
  const item = res.Item ?? {};
  const kinds = Object.keys(DAILY_LIMITS) as QuotaKind[];
  return Object.fromEntries(
    kinds.map((k) => [k, { used: Number(item[COUNTER[k]] ?? 0), limit: DAILY_LIMITS[k] }]),
  ) as Record<QuotaKind, { used: number; limit: number }>;
}

const MESSAGES: Record<QuotaKind, Record<Lang, (limit: number) => string>> = {
  analysis: {
    uk: (n) => `Ви використали всі ${n} аналізів на сьогодні. Ліміт оновиться опівночі за Києвом.`,
    en: (n) => `You have used all ${n} analyses for today. The limit resets at midnight Kyiv time.`,
  },
  interview: {
    uk: (n) => `Ви використали всі ${n} мок-інтерв'ю на сьогодні. Ліміт оновиться опівночі за Києвом.`,
    en: (n) => `You have used all ${n} mock interviews for today. The limit resets at midnight Kyiv time.`,
  },
  share: {
    uk: (n) => `Ви поділилися ${n} результатами сьогодні — це максимум. Ліміт оновиться опівночі за Києвом.`,
    en: (n) => `You have shared ${n} results today, which is the maximum. The limit resets at midnight Kyiv time.`,
  },
  coverLetter: {
    uk: (n) => `Ви створили ${n} супровідних листів сьогодні — це максимум. Ліміт оновиться опівночі за Києвом.`,
    en: (n) => `You have created ${n} cover letters today, which is the maximum. The limit resets at midnight Kyiv time.`,
  },
  profile: {
    uk: (n) => `Ви створили ${n} текстів профілю сьогодні — це максимум. Ліміт оновиться опівночі за Києвом.`,
    en: (n) => `You have created ${n} profile texts today, which is the maximum. The limit resets at midnight Kyiv time.`,
  },
  vacancyImport: {
    uk: (n) => `Ви імпортували ${n} вакансій сьогодні — це максимум. Ліміт оновиться опівночі за Києвом.`,
    en: (n) => `You have imported ${n} vacancies today, which is the maximum. The limit resets at midnight Kyiv time.`,
  },
};

/**
 * Friendly 429. `error`/`kind`/`limit` let the frontend show its own i18n text
 * (errors.quotaExceeded.*); `message` is a ready translation in the request language.
 */
export function quotaExceededResponse(err: QuotaExceededError, lang: Lang): APIGatewayProxyResultV2 {
  return json(429, {
    error: 'quota_exceeded',
    kind: err.kind,
    limit: err.limit,
    message: MESSAGES[err.kind][lang](err.limit),
  });
}
