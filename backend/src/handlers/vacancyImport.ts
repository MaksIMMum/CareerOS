import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { docClient, TABLE_NAME } from '../lib/dynamo.js';
import { logEvent } from '../lib/events.js';
import { getSub, HttpError, json, parseJsonBody, requestLang, withErrorHandling } from '../lib/http.js';
import {
  consumeQuota,
  QuotaExceededError,
  quotaExceededResponse,
  refundQuota,
} from '../lib/quota.js';
import { importVacancy, type Fetcher } from '../lib/vacancyImport.js';

type Client = Pick<DynamoDBDocumentClient, 'send'>;

const bodySchema = z.object({ url: z.string().trim().min(1).max(2000) });

/**
 * POST /vacancies/import { url } → { title, company, url, text, site }.
 * Fills the "new analysis" form; nothing is saved here (the vacancy is saved with the analysis).
 */
export function createVacancyImportHandler({
  client = docClient,
  tableName = TABLE_NAME,
  fetcher,
}: { client?: Client; tableName?: string; fetcher?: Fetcher } = {}) {
  return withErrorHandling(async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    const sub = getSub(event);
    if (event.routeKey !== 'POST /vacancies/import') throw new HttpError(404, 'not_found');
    const { url } = parseJsonBody(event, bodySchema);

    try {
      await consumeQuota(sub, 'vacancyImport', { client, tableName });
    } catch (err) {
      if (err instanceof QuotaExceededError) return quotaExceededResponse(err, requestLang(event));
      throw err;
    }

    try {
      const vacancy = await importVacancy(url, fetcher ?? fetch);
      await logEvent(sub, 'VACANCY_IMPORT', { site: vacancy.site, ok: true }, client, tableName);
      return json(200, { vacancy });
    } catch (err) {
      // Failed imports (blocked site, unsupported page) don't use up the daily limit.
      await refundQuota(sub, 'vacancyImport', { client, tableName }).catch(() => undefined);
      if (err instanceof HttpError) {
        await logEvent(sub, 'VACANCY_IMPORT', { ok: false, error: err.code }, client, tableName).catch(() => undefined);
      }
      throw err;
    }
  });
}

export const handler = createVacancyImportHandler();
