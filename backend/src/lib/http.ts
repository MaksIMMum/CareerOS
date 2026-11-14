import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import type { z } from 'zod';

/** Max accepted JSON body. A 15k-char Cyrillic CV is ~30 KB in UTF-8, so 64 KB is plenty. */
export const MAX_BODY_BYTES = 64 * 1024;

export type Lang = 'uk' | 'en';

/** An error that maps directly to an HTTP response: `{ error: code, message?, details? }`. */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = 'HttpError';
  }
}

// CORS headers are added by API Gateway (allowed origins are configured in infra/).
export function json(statusCode: number, body?: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

/** The Cognito user id from the JWT authorizer. Every per-user key is built from this. */
export function getSub(event: APIGatewayProxyEventV2): string {
  const claims = (
    event.requestContext as { authorizer?: { jwt?: { claims?: Record<string, unknown> } } }
  ).authorizer?.jwt?.claims;
  const sub = claims?.sub;
  if (typeof sub !== 'string' || !sub) throw new HttpError(401, 'unauthorized');
  return sub;
}

export function requestLang(event: APIGatewayProxyEventV2): Lang {
  const header = event.headers?.['accept-language'] ?? event.headers?.['Accept-Language'] ?? '';
  return header.toLowerCase().startsWith('en') ? 'en' : 'uk';
}

export function parseJsonBody<T>(event: APIGatewayProxyEventV2, schema: z.ZodType<T>): T {
  let raw = event.body ?? '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large');

  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'invalid_json');
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(
      400,
      'validation_error',
      'Request body is invalid',
      result.error.issues.map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message })),
    );
  }
  return result.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The {id} path parameter. Anything that is not a UUID can't exist, so it is a 404. */
export function parseId(event: APIGatewayProxyEventV2): string {
  const id = event.pathParameters?.id;
  if (!id || !UUID_RE.test(id)) throw new HttpError(404, 'not_found');
  return id.toLowerCase();
}

type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

/** Turns thrown HttpErrors into JSON responses and hides internal errors behind a 500. */
export function withErrorHandling(fn: Handler): Handler {
  return async (event) => {
    try {
      return await fn(event);
    } catch (err) {
      if (err instanceof HttpError) {
        return json(err.statusCode, {
          error: err.code,
          ...(err.message !== err.code ? { message: err.message } : {}),
          ...(err.details !== undefined ? { details: err.details } : {}),
        });
      }
      console.error('Unhandled error', err);
      return json(500, { error: 'internal_error' });
    }
  };
}

export function isConditionalCheckFailed(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'ConditionalCheckFailedException';
}
