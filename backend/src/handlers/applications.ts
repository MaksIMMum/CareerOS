import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamo.js';
import { logEvent } from '../lib/events.js';
import { getSub, HttpError, json, parseId, parseJsonBody, withErrorHandling } from '../lib/http.js';
import { createResourceRepo, type StoredItem } from '../lib/items.js';
import { applicationConfig, cvConfig, vacancyConfig } from '../lib/repos.js';
import {
  applicationCreateSchema,
  applicationUpdateSchema,
  type AppStatus,
  type CvInput,
  type VacancyInput,
} from '../lib/validation.js';

type Client = Pick<DynamoDBDocumentClient, 'send'>;

/**
 * Item: PK=USER#<sub>, SK=APP#<id> — one job application on the tracker board.
 * `cvName` is a snapshot of the CV version's name, so the "which CV works" summary still reads
 * well after that CV is renamed or deleted.
 */
export interface ApplicationRecord extends Record<string, unknown> {
  vacancyId: string | null;
  cvId: string;
  cvName: string;
  company: string;
  title: string;
  appliedAt: string; // YYYY-MM-DD
  status: AppStatus;
  statusChangedAt: string; // ISO time the current status was set
  hadInterview: boolean;
  notes: string;
}
export type Application = StoredItem<ApplicationRecord>;

/** INTERVIEW and OFFER always mean an interview happened; APPLIED means no answer yet. */
export function resolveHadInterview(status: AppStatus, requested: boolean): boolean {
  if (status === 'INTERVIEW' || status === 'OFFER') return true;
  if (status === 'APPLIED') return false;
  return requested; // REJECTED: before or after an interview
}

export interface ApplicationsDeps {
  client?: Client;
  tableName?: string;
  now?: () => Date;
}

export function createApplicationsHandler({
  client = docClient,
  tableName = TABLE_NAME,
  now = () => new Date(),
}: ApplicationsDeps = {}) {
  const apps = createResourceRepo<ApplicationRecord>(applicationConfig, client, tableName);
  const cvs = createResourceRepo<CvInput>(cvConfig, client, tableName);
  const vacancies = createResourceRepo<VacancyInput>(vacancyConfig, client, tableName);

  /** A vacancy deleted since the analysis is not an error: the card just loses the link. */
  async function ownVacancyOrNull(sub: string, id: string | null): Promise<string | null> {
    if (!id) return null;
    try {
      return (await vacancies.get(sub, id)).id;
    } catch (err) {
      if (err instanceof HttpError && err.statusCode === 404) return null;
      throw err;
    }
  }

  async function create(event: APIGatewayProxyEventV2, sub: string) {
    const body = parseJsonBody(event, applicationCreateSchema);
    const cv = await cvs.get(sub, body.cvId); // 404 for a CV that is not the caller's
    const vacancyId = await ownVacancyOrNull(sub, body.vacancyId);

    const nowIso = now().toISOString();
    const today = nowIso.slice(0, 10);
    const appliedAt = body.appliedAt ?? today;
    // An application backdated as APPLIED has been waiting since that day (drives "follow up?").
    const statusChangedAt =
      body.status === 'APPLIED' && appliedAt < today ? `${appliedAt}T00:00:00.000Z` : nowIso;

    const item = await apps.create(sub, {
      vacancyId,
      cvId: cv.id,
      cvName: cv.name,
      company: body.company,
      title: body.title,
      appliedAt,
      status: body.status,
      statusChangedAt,
      hadInterview: resolveHadInterview(body.status, body.hadInterview),
      notes: body.notes,
    });
    await logEvent(
      sub,
      'APPLICATION_ADDED',
      { applicationId: item.id, cvId: item.cvId, vacancyId, status: item.status },
      client,
      tableName,
    );
    return json(201, { item });
  }

  async function update(event: APIGatewayProxyEventV2, sub: string, id: string) {
    const patch = parseJsonBody(event, applicationUpdateSchema);
    const current = await apps.get(sub, id);
    const changes: Partial<ApplicationRecord> = { ...patch };

    if (patch.cvId !== undefined && patch.cvId !== current.cvId) {
      changes.cvName = (await cvs.get(sub, patch.cvId)).name;
    }
    if (patch.vacancyId !== undefined && patch.vacancyId !== current.vacancyId) {
      changes.vacancyId = await ownVacancyOrNull(sub, patch.vacancyId);
    }

    const status = patch.status ?? current.status;
    const statusChanged = status !== current.status;
    if (statusChanged) changes.statusChangedAt = now().toISOString();
    changes.hadInterview = resolveHadInterview(
      status,
      patch.hadInterview ?? Boolean(current.hadInterview),
    );

    const item = await apps.update(sub, id, changes);
    if (statusChanged) {
      await logEvent(
        sub,
        'STATUS_CHANGED',
        { applicationId: id, cvId: item.cvId, from: current.status, to: status },
        client,
        tableName,
      );
    }
    return json(200, { item });
  }

  return withErrorHandling(async (event): Promise<APIGatewayProxyResultV2> => {
    const sub = getSub(event);
    switch (event.routeKey) {
      case 'GET /applications':
        return json(200, { items: await apps.list(sub) });
      case 'POST /applications':
        return create(event, sub);
      case 'GET /applications/{id}':
        return json(200, { item: await apps.get(sub, parseId(event)) });
      case 'PATCH /applications/{id}':
        return update(event, sub, parseId(event));
      case 'DELETE /applications/{id}':
        await apps.remove(sub, parseId(event));
        return json(204);
      default:
        throw new HttpError(404, 'not_found');
    }
  });
}

export const handler = createApplicationsHandler();
