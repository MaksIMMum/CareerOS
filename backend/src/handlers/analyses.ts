import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import {
  analysisResultSchema,
  buildAnalysisPrompt,
  buildCoverLetterPrompt,
  buildRescorePrompt,
  checkCoverLetter,
  checkResult,
  clampScore,
  coverLetterSchema,
  rescoreSchema,
  type AnalysisResult,
  type VacancyForPrompt,
} from '../lib/analysis.js';
import { docClient, TABLE_NAME } from '../lib/dynamo.js';
import { logEvent } from '../lib/events.js';
import {
  getSub,
  HttpError,
  isConditionalCheckFailed,
  json,
  parseId,
  parseJsonBody,
  requestLang,
  withErrorHandling,
  type Lang,
} from '../lib/http.js';
import { newShareId, uuidv7 } from '../lib/ids.js';
import { createResourceRepo } from '../lib/items.js';
import { getLlmProvider, LlmError, type LlmProvider } from '../lib/llm.js';
import {
  consumeQuota,
  QuotaExceededError,
  quotaExceededResponse,
  refundQuota,
  type QuotaKind,
} from '../lib/quota.js';
import { cvConfig, vacancyConfig } from '../lib/repos.js';
import type { UnsupportedTerms } from '../lib/skillCheck.js';
import { aggregateSkillGaps, type AnalysisSkills } from '../lib/skillGaps.js';
import { vacancyInputSchema, type CvInput, type VacancyInput } from '../lib/validation.js';

type Client = Pick<DynamoDBDocumentClient, 'send'>;

/**
 * Items (both under PK=USER#<sub>):
 *  - ANALYSIS#<uuidv7>        small summary, listed on the History page (sorted by time)
 *  - ANALYSISDETAIL#<uuidv7>  { data: brotli(JSON) } with the full result + CV/vacancy snapshot.
 *    Compressed because DynamoDB bills per KB and we only have 5 WCU/RCU. Its prefix does not
 *    start with "ANALYSIS#", so list queries never read these big items.
 *  - COVERLETTER#<uuidv7>     the latest cover letter generated for that analysis
 * Public share: PK=SHARE#<shareId>, SK=SHARE { jobTitle, scoreBefore, scoreAfter } — no CV text.
 */
export interface AnalysisSummary {
  id: string;
  cvId: string;
  cvName: string;
  vacancyId: string | null;
  vacancyTitle: string;
  company: string;
  lang: Lang;
  matchScore: number;
  flaggedCount: number;
  createdAt: string;
  shareId?: string;
  shareScores?: { before: number; after: number };
  /** Names of the missing skills, kept on the summary for the skill-gap report (not listed). */
  missingSkills?: string[];
}

export interface CoverLetter {
  letter: string;
  lang: Lang;
  flagged: UnsupportedTerms;
  createdAt: string;
}

interface AnalysisDetail {
  result: AnalysisResult;
  flagged: UnsupportedTerms;
  cvText: string;
  vacancy: VacancyForPrompt;
  durationMs: number;
}

const createSchema = z
  .object({
    cvId: z.uuid(),
    vacancyId: z.uuid().optional(),
    vacancy: vacancyInputSchema.optional(),
    lang: z.enum(['uk', 'en']).optional(),
  })
  .refine((b) => Boolean(b.vacancyId) !== Boolean(b.vacancy), {
    message: 'Provide exactly one of vacancyId or vacancy',
  });

const coverLetterBodySchema = z.object({ lang: z.enum(['uk', 'en']).optional() });

/** The skill-gap report looks at this many most recent analyses. */
const INSIGHT_ANALYSES = 50;

const SUMMARY_ATTRS = [
  'id', 'cvId', 'cvName', 'vacancyId', 'vacancyTitle', 'company', 'lang', 'matchScore',
  'flaggedCount', 'createdAt', 'shareId', 'shareScores',
];

const pack = (d: AnalysisDetail) => brotliCompressSync(Buffer.from(JSON.stringify(d), 'utf8'));
const unpack = (b: Uint8Array): AnalysisDetail =>
  JSON.parse(brotliDecompressSync(Buffer.from(b)).toString('utf8')) as AnalysisDetail;

function strip(item: Record<string, unknown>): AnalysisSummary {
  const { PK: _pk, SK: _sk, ...rest } = item;
  return rest as unknown as AnalysisSummary;
}

function llmFailure(err: unknown): HttpError {
  if (err instanceof LlmError) {
    console.error('LLM call failed', { code: err.code, status: err.status, message: err.message });
    return err.code === 'timeout'
      ? new HttpError(504, 'ai_timeout')
      : new HttpError(502, 'ai_unavailable');
  }
  return err as HttpError;
}

export interface AnalysesDeps {
  client?: Client;
  tableName?: string;
  llm?: LlmProvider;
}

export function createAnalysesHandler({
  client = docClient,
  tableName = TABLE_NAME,
  llm,
}: AnalysesDeps = {}) {
  const cvs = createResourceRepo<CvInput>(cvConfig, client, tableName);
  const vacancies = createResourceRepo<VacancyInput>(vacancyConfig, client, tableName);
  const getLlm = () => llm ?? getLlmProvider();
  const pk = (sub: string) => `USER#${sub}`;

  /** Takes one quota unit, runs `fn`, and refunds the unit if the AI call fails. */
  async function withQuota<T>(sub: string, kind: QuotaKind, fn: () => Promise<T>): Promise<T> {
    await consumeQuota(sub, kind, { client, tableName });
    try {
      return await fn();
    } catch (err) {
      await refundQuota(sub, kind, { client, tableName }).catch(() => undefined);
      throw llmFailure(err);
    }
  }

  async function getSummary(sub: string, id: string): Promise<AnalysisSummary> {
    const res = await client.send(
      new GetCommand({ TableName: tableName, Key: { PK: pk(sub), SK: `ANALYSIS#${id}` } }),
    );
    if (!res.Item) throw new HttpError(404, 'not_found');
    return strip(res.Item);
  }

  async function getDetail(sub: string, id: string): Promise<AnalysisDetail> {
    const res = await client.send(
      new GetCommand({ TableName: tableName, Key: { PK: pk(sub), SK: `ANALYSISDETAIL#${id}` } }),
    );
    if (!res.Item?.data) throw new HttpError(404, 'not_found');
    return unpack(res.Item.data as Uint8Array);
  }

  async function create(event: APIGatewayProxyEventV2, sub: string) {
    const body = parseJsonBody(event, createSchema);
    const lang: Lang = body.lang ?? requestLang(event);
    const cv = await cvs.get(sub, body.cvId);
    const savedVacancy = body.vacancyId ? await vacancies.get(sub, body.vacancyId) : undefined;
    const vacancy: VacancyInput = savedVacancy ?? body.vacancy!;

    const started = Date.now();
    const raw = await withQuota(sub, 'analysis', () =>
      getLlm().generateJson(buildAnalysisPrompt(cv.text, vacancy, lang), analysisResultSchema),
    );
    const durationMs = Date.now() - started;
    const result: AnalysisResult = { ...raw, matchScore: clampScore(raw.matchScore) };
    const flagged = checkResult(cv.text, result);

    // Save a pasted vacancy only after a successful analysis (no duplicates from failed retries).
    let vacancyId = savedVacancy?.id ?? null;
    if (!savedVacancy) {
      try {
        vacancyId = (await vacancies.create(sub, vacancy)).id;
      } catch (err) {
        if (!(err instanceof HttpError && err.code === 'limit_reached')) throw err;
      }
    }

    const id = uuidv7();
    const summary: AnalysisSummary = {
      id,
      cvId: cv.id,
      cvName: cv.name,
      vacancyId,
      vacancyTitle: vacancy.title,
      company: vacancy.company ?? '',
      lang,
      matchScore: result.matchScore,
      flaggedCount: flagged.skills.length + flagged.numbers.length,
      createdAt: new Date().toISOString(),
      missingSkills: result.missingSkills.map((m) => m.skill),
    };
    const detail: AnalysisDetail = {
      result,
      flagged,
      cvText: cv.text,
      vacancy: { title: vacancy.title, company: vacancy.company, text: vacancy.text },
      durationMs,
    };
    await client.send(
      new PutCommand({ TableName: tableName, Item: { PK: pk(sub), SK: `ANALYSISDETAIL#${id}`, data: pack(detail), v: 1 } }),
    );
    await client.send(
      new PutCommand({ TableName: tableName, Item: { PK: pk(sub), SK: `ANALYSIS#${id}`, ...summary } }),
    );
    await logEvent(
      sub,
      'ANALYSIS',
      { analysisId: id, cvId: cv.id, vacancyId, matchScore: result.matchScore, flaggedCount: summary.flaggedCount, durationMs, lang },
      client,
      tableName,
    );

    const { missingSkills: _ms, ...publicSummary } = summary;
    return json(201, { item: { ...publicSummary, result, flagged, vacancy: detail.vacancy } });
  }

  async function list(sub: string) {
    const names = Object.fromEntries(SUMMARY_ATTRS.map((a, i) => [`#a${i}`, a]));
    const res = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': pk(sub), ':sk': 'ANALYSIS#' },
        ExpressionAttributeNames: names,
        ProjectionExpression: Object.keys(names).join(', '),
        ScanIndexForward: false, // uuidv7 ids sort by time -> newest first
        Limit: 50,
      }),
    );
    return json(200, { items: (res.Items ?? []).map(strip) });
  }

  async function getCoverLetter(sub: string, id: string): Promise<CoverLetter | undefined> {
    const res = await client.send(
      new GetCommand({ TableName: tableName, Key: { PK: pk(sub), SK: `COVERLETTER#${id}` } }),
    );
    if (!res.Item) return undefined;
    const { letter, lang, flagged, createdAt } = res.Item as unknown as CoverLetter;
    return { letter, lang, flagged, createdAt };
  }

  async function get(sub: string, id: string) {
    const [summary, detail, coverLetter] = await Promise.all([
      getSummary(sub, id),
      getDetail(sub, id),
      getCoverLetter(sub, id),
    ]);
    const { missingSkills: _ms, ...publicSummary } = summary;
    return json(200, {
      item: {
        ...publicSummary,
        result: detail.result,
        flagged: detail.flagged,
        vacancy: detail.vacancy, // the vacancy text exactly as it was analysed
        ...(coverLetter ? { coverLetter } : {}),
      },
    });
  }

  /** Writes (or rewrites) the cover letter for an analysis. Uses only the CV saved with it. */
  async function createCoverLetter(event: APIGatewayProxyEventV2, sub: string, id: string) {
    const body = parseJsonBody(event, coverLetterBodySchema);
    const lang: Lang = body.lang ?? requestLang(event);
    const detail = await getDetail(sub, id); // 404 for a foreign / unknown id, before any quota

    const started = Date.now();
    const raw = await withQuota(sub, 'coverLetter', () =>
      getLlm().generateJson(
        buildCoverLetterPrompt(detail.cvText, detail.vacancy, detail.result.matchedSkills, lang),
        coverLetterSchema,
      ),
    );
    const letter = raw.letter.trim();
    const coverLetter: CoverLetter = {
      letter,
      lang,
      flagged: checkCoverLetter(detail.cvText, letter, detail.result),
      createdAt: new Date().toISOString(),
    };
    await client.send(
      new PutCommand({ TableName: tableName, Item: { PK: pk(sub), SK: `COVERLETTER#${id}`, ...coverLetter } }),
    );
    await logEvent(
      sub,
      'COVER_LETTER',
      {
        analysisId: id,
        lang,
        flaggedCount: coverLetter.flagged.skills.length + coverLetter.flagged.numbers.length,
        durationMs: Date.now() - started,
      },
      client,
      tableName,
    );
    return json(201, { coverLetter });
  }

  /**
   * Skill gaps across the latest analyses. Analyses saved before `missingSkills` was kept on the
   * summary are filled in once from their detail item, so later reports stay one query.
   */
  async function skillInsights(sub: string) {
    const res = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': pk(sub), ':sk': 'ANALYSIS#' },
        ExpressionAttributeNames: {
          '#id': 'id', '#t': 'vacancyTitle', '#c': 'company', '#at': 'createdAt', '#ms': 'missingSkills',
        },
        ProjectionExpression: '#id, #t, #c, #at, #ms',
        ScanIndexForward: false,
        Limit: INSIGHT_ANALYSES,
      }),
    );
    const rows = (res.Items ?? []) as Partial<AnalysisSkills>[];

    const analyses: AnalysisSkills[] = [];
    for (const row of rows) {
      let missingSkills = row.missingSkills;
      if (!Array.isArray(missingSkills)) {
        try {
          missingSkills = (await getDetail(sub, row.id!)).result.missingSkills.map((m) => m.skill);
          await client.send(
            new UpdateCommand({
              TableName: tableName,
              Key: { PK: pk(sub), SK: `ANALYSIS#${row.id}` },
              UpdateExpression: 'SET #ms = :ms',
              ConditionExpression: 'attribute_exists(PK)',
              ExpressionAttributeNames: { '#ms': 'missingSkills' },
              ExpressionAttributeValues: { ':ms': missingSkills },
            }),
          );
        } catch (err) {
          console.error('skill insights: backfill failed', { id: row.id, err });
          missingSkills = missingSkills ?? [];
        }
      }
      analyses.push({
        id: row.id!,
        vacancyTitle: row.vacancyTitle ?? '',
        company: row.company ?? '',
        createdAt: row.createdAt ?? '',
        missingSkills,
      });
    }

    // Current CV texts, to show which gaps the user has closed since.
    const cvRes = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': pk(sub), ':sk': 'CV#' },
        ExpressionAttributeNames: { '#n': 'name', '#t': 'text' },
        ProjectionExpression: '#n, #t',
      }),
    );
    const cvTexts = (cvRes.Items ?? []).map((i) => ({ name: String(i.name ?? ''), text: String(i.text ?? '') }));

    return json(200, aggregateSkillGaps(analyses, cvTexts));
  }

  async function share(sub: string, id: string) {
    const summary = await getSummary(sub, id);
    if (summary.shareId && summary.shareScores) {
      return json(200, { shareId: summary.shareId, scores: summary.shareScores });
    }
    const detail = await getDetail(sub, id);

    // Fair before/after: both versions scored in ONE call with the same criteria.
    const raw = await withQuota(sub, 'share', () =>
      getLlm().generateJson(
        buildRescorePrompt(detail.cvText, detail.result.improvedCv, detail.vacancy),
        rescoreSchema,
      ),
    );
    const scores = { before: clampScore(raw.before), after: clampScore(raw.after) };
    const shareId = newShareId();

    try {
      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: pk(sub), SK: `ANALYSIS#${id}` },
          UpdateExpression: 'SET shareId = :s, shareScores = :sc',
          ConditionExpression: 'attribute_exists(PK) AND attribute_not_exists(shareId)',
          ExpressionAttributeValues: { ':s': shareId, ':sc': scores },
        }),
      );
    } catch (err) {
      if (!isConditionalCheckFailed(err)) throw err;
      const winner = await getSummary(sub, id); // a parallel request shared it first
      return json(200, { shareId: winner.shareId, scores: winner.shareScores });
    }
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          PK: `SHARE#${shareId}`,
          SK: 'SHARE',
          jobTitle: summary.vacancyTitle,
          scoreBefore: scores.before,
          scoreAfter: scores.after,
          createdAt: new Date().toISOString(),
          ownerSub: sub, // never returned by the public endpoint
          analysisId: id,
        },
      }),
    );
    await logEvent(sub, 'SHARE_CREATED', { analysisId: id, shareId, ...scores }, client, tableName);
    return json(201, { shareId, scores });
  }

  return withErrorHandling(async (event): Promise<APIGatewayProxyResultV2> => {
    const sub = getSub(event);
    try {
      switch (event.routeKey) {
        case 'POST /analyses':
          return await create(event, sub);
        case 'GET /analyses':
          return await list(sub);
        case 'GET /analyses/{id}':
          return await get(sub, parseId(event));
        case 'POST /analyses/{id}/share':
          return await share(sub, parseId(event));
        case 'POST /analyses/{id}/cover-letter':
          return await createCoverLetter(event, sub, parseId(event));
        case 'GET /insights/skills':
          return await skillInsights(sub);
        default:
          throw new HttpError(404, 'not_found');
      }
    } catch (err) {
      if (err instanceof QuotaExceededError) return quotaExceededResponse(err, requestLang(event));
      throw err;
    }
  });
}

export const handler = createAnalysesHandler();
