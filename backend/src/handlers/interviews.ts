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
import type { VacancyForPrompt } from '../lib/analysis.js';
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
import { uuidv7 } from '../lib/ids.js';
import {
  ANSWER_MAX,
  answerFeedbackSchema,
  buildAnswerPrompt,
  buildQuestionsPrompt,
  checkBetterAnswer,
  clampAnswerScore,
  questionsSchema,
  summarizeInterview,
  type InterviewOutcome,
  type InterviewQuestion,
} from '../lib/interview.js';
import { createResourceRepo } from '../lib/items.js';
import { getLlmProvider, LlmError, type LlmProvider } from '../lib/llm.js';
import {
  consumeQuota,
  QuotaExceededError,
  quotaExceededResponse,
  refundQuota,
} from '../lib/quota.js';
import { cvConfig, vacancyConfig } from '../lib/repos.js';
import type { UnsupportedTerms } from '../lib/skillCheck.js';
import type { CvInput, VacancyInput } from '../lib/validation.js';

type Client = Pick<DynamoDBDocumentClient, 'send'>;

/**
 * Items (both under PK=USER#<sub>), same layout as analyses:
 *  - INTERVIEW#<uuidv7>        small summary for the list (newest first) and the tracker link
 *  - INTERVIEWDETAIL#<uuidv7>  { data: brotli(JSON), answered: n } with the CV/vacancy snapshot,
 *    the questions and the scored answers. `answered` is the optimistic lock: an answer is only
 *    saved if nobody saved that question's answer first.
 */
export type InterviewStatus = 'IN_PROGRESS' | 'DONE';

export interface InterviewSummary {
  id: string;
  cvId: string;
  cvName: string;
  vacancyId: string;
  vacancyTitle: string;
  company: string;
  lang: Lang;
  status: InterviewStatus;
  questionCount: number;
  answeredCount: number;
  createdAt: string;
  finishedAt?: string;
  overallScore?: number;
}

export interface InterviewAnswer {
  answer: string;
  /** Seconds the user spent on the answer, if the timer was on. */
  seconds?: number;
  score: number;
  feedback: string;
  betterAnswer: string;
  flagged: UnsupportedTerms;
  answeredAt: string;
}

interface InterviewDetail {
  cvText: string;
  vacancy: VacancyForPrompt;
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  outcome?: InterviewOutcome;
}

const createSchema = z.object({
  cvId: z.uuid(),
  vacancyId: z.uuid(),
  lang: z.enum(['uk', 'en']).optional(),
});

const answerSchema = z.object({
  /** Which question this answers (0-based); must be the next unanswered one. */
  index: z.number().int().min(0).max(20),
  answer: z.string().trim().min(1).max(ANSWER_MAX),
  seconds: z.number().int().min(0).max(24 * 60 * 60).optional(),
});

const SUMMARY_ATTRS = [
  'id', 'cvId', 'cvName', 'vacancyId', 'vacancyTitle', 'company', 'lang', 'status',
  'questionCount', 'answeredCount', 'createdAt', 'finishedAt', 'overallScore',
];

const pack = (d: InterviewDetail) => brotliCompressSync(Buffer.from(JSON.stringify(d), 'utf8'));
const unpack = (b: Uint8Array): InterviewDetail =>
  JSON.parse(brotliDecompressSync(Buffer.from(b)).toString('utf8')) as InterviewDetail;

function strip(item: Record<string, unknown>): InterviewSummary {
  const { PK: _pk, SK: _sk, ...rest } = item;
  return rest as unknown as InterviewSummary;
}

function llmFailure(err: unknown): unknown {
  if (err instanceof LlmError) {
    console.error('LLM call failed', { code: err.code, status: err.status, message: err.message });
    return err.code === 'timeout'
      ? new HttpError(504, 'ai_timeout')
      : new HttpError(502, 'ai_unavailable');
  }
  return err;
}

/** What the client sees: never the CV snapshot. */
const publicView = (summary: InterviewSummary, d: InterviewDetail) => ({
  ...summary,
  questions: d.questions,
  answers: d.answers,
  ...(d.outcome ? { outcome: d.outcome } : {}),
});

export interface InterviewsDeps {
  client?: Client;
  tableName?: string;
  llm?: LlmProvider;
}

export function createInterviewsHandler({
  client = docClient,
  tableName = TABLE_NAME,
  llm,
}: InterviewsDeps = {}) {
  const cvs = createResourceRepo<CvInput>(cvConfig, client, tableName);
  const vacancies = createResourceRepo<VacancyInput>(vacancyConfig, client, tableName);
  const getLlm = () => llm ?? getLlmProvider();
  const pk = (sub: string) => `USER#${sub}`;

  async function getSummary(sub: string, id: string): Promise<InterviewSummary> {
    const res = await client.send(
      new GetCommand({ TableName: tableName, Key: { PK: pk(sub), SK: `INTERVIEW#${id}` } }),
    );
    if (!res.Item) throw new HttpError(404, 'not_found');
    return strip(res.Item);
  }

  async function getDetail(sub: string, id: string): Promise<{ detail: InterviewDetail; answered: number }> {
    const res = await client.send(
      new GetCommand({ TableName: tableName, Key: { PK: pk(sub), SK: `INTERVIEWDETAIL#${id}` } }),
    );
    if (!res.Item?.data) throw new HttpError(404, 'not_found');
    return { detail: unpack(res.Item.data as Uint8Array), answered: Number(res.Item.answered ?? 0) };
  }

  async function create(event: APIGatewayProxyEventV2, sub: string) {
    const body = parseJsonBody(event, createSchema);
    const lang: Lang = body.lang ?? requestLang(event);
    const cv = await cvs.get(sub, body.cvId);
    const vacancy = await vacancies.get(sub, body.vacancyId);
    const vacancyForPrompt: VacancyForPrompt = { title: vacancy.title, company: vacancy.company, text: vacancy.text };

    // One interview = one unit of the daily quota; answers don't count. Refunded if the AI fails.
    await consumeQuota(sub, 'interview', { client, tableName });
    let questions: InterviewQuestion[];
    try {
      ({ questions } = await getLlm().generateJson(
        buildQuestionsPrompt(cv.text, vacancyForPrompt, lang),
        questionsSchema,
      ));
    } catch (err) {
      await refundQuota(sub, 'interview', { client, tableName }).catch(() => undefined);
      throw llmFailure(err);
    }

    const id = uuidv7();
    const summary: InterviewSummary = {
      id,
      cvId: cv.id,
      cvName: cv.name,
      vacancyId: vacancy.id,
      vacancyTitle: vacancy.title,
      company: vacancy.company ?? '',
      lang,
      status: 'IN_PROGRESS',
      questionCount: questions.length,
      answeredCount: 0,
      createdAt: new Date().toISOString(),
    };
    const detail: InterviewDetail = { cvText: cv.text, vacancy: vacancyForPrompt, questions, answers: [] };
    await client.send(
      new PutCommand({
        TableName: tableName,
        Item: { PK: pk(sub), SK: `INTERVIEWDETAIL#${id}`, data: pack(detail), answered: 0, v: 1 },
      }),
    );
    await client.send(
      new PutCommand({ TableName: tableName, Item: { PK: pk(sub), SK: `INTERVIEW#${id}`, ...summary } }),
    );
    await logEvent(
      sub,
      'INTERVIEW_STARTED',
      { interviewId: id, cvId: cv.id, vacancyId: vacancy.id, questionCount: questions.length, lang },
      client,
      tableName,
    );
    return json(201, { item: publicView(summary, detail) });
  }

  async function answer(event: APIGatewayProxyEventV2, sub: string, id: string) {
    const body = parseJsonBody(event, answerSchema);
    const summary = await getSummary(sub, id);
    if (summary.status === 'DONE') throw new HttpError(409, 'interview_finished');
    const { detail, answered } = await getDetail(sub, id);
    // Answers go strictly in order; a stale tab or a double submit gets a 409 and reloads.
    if (body.index !== answered) throw new HttpError(409, 'wrong_question', undefined, { expected: answered });
    const question = detail.questions[answered];
    if (!question) throw new HttpError(409, 'interview_finished');

    let raw;
    try {
      raw = await getLlm().generateJson(
        buildAnswerPrompt(detail.cvText, detail.vacancy, question, body.answer, summary.lang),
        answerFeedbackSchema,
      );
    } catch (err) {
      throw llmFailure(err);
    }

    const saved: InterviewAnswer = {
      answer: body.answer,
      ...(body.seconds !== undefined ? { seconds: body.seconds } : {}),
      score: clampAnswerScore(raw.score),
      feedback: raw.feedback,
      betterAnswer: raw.betterAnswer,
      flagged: checkBetterAnswer(detail.cvText, body.answer, raw.betterAnswer),
      answeredAt: new Date().toISOString(),
    };
    const answers = [...detail.answers, saved];
    const done = answers.length >= detail.questions.length;
    const next: InterviewDetail = { ...detail, answers };
    if (done) {
      next.outcome = summarizeInterview(
        answers.map((a, i) => ({ type: detail.questions[i]!.type, topic: detail.questions[i]!.topic, score: a.score })),
      );
    }

    try {
      await client.send(
        new UpdateCommand({
          TableName: tableName,
          Key: { PK: pk(sub), SK: `INTERVIEWDETAIL#${id}` },
          UpdateExpression: 'SET #d = :d, #a = :next',
          ConditionExpression: '#a = :n',
          ExpressionAttributeNames: { '#d': 'data', '#a': 'answered' },
          ExpressionAttributeValues: { ':d': pack(next), ':next': answers.length, ':n': answered },
        }),
      );
    } catch (err) {
      if (isConditionalCheckFailed(err)) {
        throw new HttpError(409, 'wrong_question', undefined, { expected: answered + 1 });
      }
      throw err;
    }

    const updated: InterviewSummary = {
      ...summary,
      answeredCount: answers.length,
      ...(done
        ? { status: 'DONE' as const, finishedAt: saved.answeredAt, overallScore: next.outcome!.overallScore }
        : {}),
    };
    await client.send(
      new PutCommand({ TableName: tableName, Item: { PK: pk(sub), SK: `INTERVIEW#${id}`, ...updated } }),
    );
    if (done) {
      await logEvent(
        sub,
        'INTERVIEW_DONE',
        {
          interviewId: id,
          cvId: summary.cvId,
          vacancyId: summary.vacancyId,
          overallScore: next.outcome!.overallScore,
          questionCount: detail.questions.length,
          lang: summary.lang,
        },
        client,
        tableName,
      );
    }
    return json(201, { item: publicView(updated, next) });
  }

  async function list(sub: string) {
    const names = Object.fromEntries(SUMMARY_ATTRS.map((a, i) => [`#a${i}`, a]));
    const res = await client.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: { ':pk': pk(sub), ':sk': 'INTERVIEW#' },
        ExpressionAttributeNames: names,
        ProjectionExpression: Object.keys(names).join(', '),
        ScanIndexForward: false, // uuidv7 ids sort by time -> newest first
        Limit: 50,
      }),
    );
    return json(200, { items: (res.Items ?? []).map(strip) });
  }

  async function get(sub: string, id: string) {
    const [summary, { detail }] = await Promise.all([getSummary(sub, id), getDetail(sub, id)]);
    return json(200, { item: publicView(summary, detail) });
  }

  return withErrorHandling(async (event): Promise<APIGatewayProxyResultV2> => {
    const sub = getSub(event);
    try {
      switch (event.routeKey) {
        case 'POST /interviews':
          return await create(event, sub);
        case 'GET /interviews':
          return await list(sub);
        case 'GET /interviews/{id}':
          return await get(sub, parseId(event));
        case 'POST /interviews/{id}/answers':
          return await answer(event, sub, parseId(event));
        default:
          throw new HttpError(404, 'not_found');
      }
    } catch (err) {
      if (err instanceof QuotaExceededError) return quotaExceededResponse(err, requestLang(event));
      throw err;
    }
  });
}

export const handler = createInterviewsHandler();
