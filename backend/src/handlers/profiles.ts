import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { docClient, TABLE_NAME } from '../lib/dynamo.js';
import { logEvent } from '../lib/events.js';
import {
  getSub,
  HttpError,
  json,
  parseId,
  parseJsonBody,
  requestLang,
  withErrorHandling,
  type Lang,
} from '../lib/http.js';
import { createResourceRepo } from '../lib/items.js';
import { getLlmProvider, LlmError, type LlmProvider } from '../lib/llm.js';
import {
  buildProfilePrompt,
  checkProfile,
  fitProfile,
  PLATFORMS,
  profileSchema,
  type Platform,
  type ProfileText,
} from '../lib/profile.js';
import { consumeQuota, QuotaExceededError, quotaExceededResponse, refundQuota } from '../lib/quota.js';
import { cvConfig } from '../lib/repos.js';
import type { UnsupportedTerms } from '../lib/skillCheck.js';
import type { CvInput } from '../lib/validation.js';

type Client = Pick<DynamoDBDocumentClient, 'send'>;

/** Item: PK=USER#<sub>, SK=PROFILE#<cvId>#<platform> — the latest profile text for that CV + site. */
export interface StoredProfile extends ProfileText {
  platform: Platform;
  lang: Lang;
  flagged: UnsupportedTerms;
  createdAt: string;
  /** The CV's updatedAt when the text was written, so the UI can say "the CV changed since". */
  cvUpdatedAt: string;
}

const bodySchema = z.object({
  platform: z.enum(PLATFORMS),
  lang: z.enum(['uk', 'en']).optional(),
});

const PROFILE_FIELDS = ['platform', 'lang', 'headline', 'about', 'skills', 'flagged', 'createdAt', 'cvUpdatedAt'] as const;
const pick = (item: Record<string, unknown>) =>
  Object.fromEntries(PROFILE_FIELDS.map((k) => [k, item[k]])) as unknown as StoredProfile;

export function createProfilesHandler({
  client = docClient,
  tableName = TABLE_NAME,
  llm,
}: { client?: Client; tableName?: string; llm?: LlmProvider } = {}) {
  const cvs = createResourceRepo<CvInput>(cvConfig, client, tableName);
  const pk = (sub: string) => `USER#${sub}`;

  /** GET /cvs/{id}/profile → { items: { djinni?, linkedin? } } */
  async function list(sub: string, cvId: string) {
    await cvs.get(sub, cvId); // 404 for a foreign / deleted CV
    const res = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': pk(sub), ':sk': `PROFILE#${cvId}#` },
      }),
    );
    const items: Partial<Record<Platform, StoredProfile>> = {};
    for (const it of res.Items ?? []) {
      const p = pick(it);
      if ((PLATFORMS as readonly string[]).includes(p.platform)) items[p.platform] = p;
    }
    return json(200, { items });
  }

  /** POST /cvs/{id}/profile { platform, lang } → { profile } */
  async function create(event: APIGatewayProxyEventV2, sub: string, cvId: string) {
    const body = parseJsonBody(event, bodySchema);
    const lang: Lang = body.lang ?? requestLang(event);
    const cv = await cvs.get(sub, cvId);

    await consumeQuota(sub, 'profile', { client, tableName });
    const started = Date.now();
    let raw: ProfileText;
    try {
      raw = await (llm ?? getLlmProvider()).generateJson(buildProfilePrompt(cv.text, body.platform, lang), profileSchema);
    } catch (err) {
      await refundQuota(sub, 'profile', { client, tableName }).catch(() => undefined);
      if (err instanceof LlmError) {
        console.error('LLM call failed', { code: err.code, status: err.status, message: err.message });
        throw err.code === 'timeout' ? new HttpError(504, 'ai_timeout') : new HttpError(502, 'ai_unavailable');
      }
      throw err;
    }

    const text = fitProfile(raw, body.platform);
    const profile: StoredProfile = {
      ...text,
      platform: body.platform,
      lang,
      flagged: checkProfile(cv.text, text),
      createdAt: new Date().toISOString(),
      cvUpdatedAt: cv.updatedAt,
    };
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: { PK: pk(sub), SK: `PROFILE#${cvId}#${body.platform}`, ...profile },
      }),
    );
    await logEvent(
      sub,
      'PROFILE_TEXT',
      {
        cvId,
        platform: body.platform,
        lang,
        flaggedCount: profile.flagged.skills.length + profile.flagged.numbers.length,
        durationMs: Date.now() - started,
      },
      client,
      tableName,
    );
    return json(201, { profile });
  }

  return withErrorHandling(async (event): Promise<APIGatewayProxyResultV2> => {
    const sub = getSub(event);
    try {
      switch (event.routeKey) {
        case 'GET /cvs/{id}/profile':
          return await list(sub, parseId(event));
        case 'POST /cvs/{id}/profile':
          return await create(event, sub, parseId(event));
        default:
          throw new HttpError(404, 'not_found');
      }
    } catch (err) {
      if (err instanceof QuotaExceededError) return quotaExceededResponse(err, requestLang(event));
      throw err;
    }
  });
}

export const handler = createProfilesHandler();
