import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { z } from 'zod';

/**
 * CLAUDE.md rule 4. Sent as the system instruction of EVERY model call, so no AI feature can
 * forget it. Feature prompts should still repeat it where it matters (CV rewrite, interview).
 */
export const NO_INVENT_RULE =
  'Do not invent experience or skills. Use only facts that are present in the CV text you are ' +
  'given: you may rephrase and reorder them, but never add employers, projects, technologies, ' +
  'degrees, certificates, dates or numbers that the CV does not contain.';

/**
 * Default model. gemini-2.5-flash is closed to new API keys; the Gemini 3 Flash models take
 * 15–60 s on the free tier (over the ~30 s API Gateway limit), while 3.5 Flash-Lite answers in
 * ~1–3 s. Override per deployment with the GEMINI_MODEL env var (set in infra/).
 */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export interface LlmProvider {
  /** Sends `prompt`, expects JSON back and returns it validated against `schema`. */
  generateJson<S extends z.ZodType>(prompt: string, schema: S): Promise<z.infer<S>>;
}

export type LlmErrorCode =
  | 'config' // API key missing/unreadable
  | 'http' // non-retryable or still failing HTTP error
  | 'timeout'
  | 'network'
  | 'blocked' // safety filter
  | 'empty' // no text in the response
  | 'invalid_json'
  | 'schema_mismatch';

export class LlmError extends Error {
  constructor(
    public readonly code: LlmErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

/** Parses model text as JSON, tolerating ```json fences. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const candidate = fenced ? fenced[1]! : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new LlmError('invalid_json', 'Model response is not valid JSON');
  }
}

export function parseAndValidate<S extends z.ZodType>(text: string, schema: S): z.infer<S> {
  const result = schema.safeParse(extractJson(text));
  if (!result.success) {
    throw new LlmError(
      'schema_mismatch',
      `Model JSON does not match schema: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || '(root)'} ${i.message}`)
        .join('; ')}`,
    );
  }
  return result.data;
}

// ---------------------------------------------------------------- API key (SSM)

let cachedKey: Promise<string> | undefined;

/** Reads the Gemini key from SSM once per Lambda cold start (the promise is cached). */
export function getGeminiApiKey(
  ssm: Pick<SSMClient, 'send'> = new SSMClient({}),
  name: string = process.env.GEMINI_KEY_PARAM ?? '/careeros/gemini-api-key',
): Promise<string> {
  cachedKey ??= ssm
    .send(new GetParameterCommand({ Name: name, WithDecryption: true }))
    .then((res) => {
      const value = res.Parameter?.Value?.trim();
      if (!value) throw new LlmError('config', `SSM parameter ${name} is empty`);
      return value;
    })
    .catch((err: unknown) => {
      cachedKey = undefined; // allow a retry on the next request
      if (err instanceof LlmError) throw err;
      throw new LlmError('config', `Cannot read SSM parameter ${name}: ${(err as Error).name}`);
    });
  return cachedKey;
}

/** Test hook. */
export function resetGeminiApiKeyCache(): void {
  cachedKey = undefined;
}

// ---------------------------------------------------------------- Gemini

export interface GeminiOptions {
  model?: string;
  getApiKey?: () => Promise<string>;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Whole call budget incl. the retry; Lambda times out at 29 s. */
  deadlineMs?: number;
  retryDelayMs?: number;
  temperature?: number;
  /** Caps the answer length; a full improved CV needs a few thousand tokens. */
  maxOutputTokens?: number;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

const RETRYABLE = (status: number) => status === 429 || status >= 500;

export class GeminiProvider implements LlmProvider {
  private readonly model: string;
  private readonly getApiKey: () => Promise<string>;
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly deadlineMs: number;
  private readonly retryDelayMs: number;
  private readonly temperature: number;
  private readonly maxOutputTokens: number;

  constructor(opts: GeminiOptions = {}) {
    this.model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
    this.getApiKey = opts.getApiKey ?? (() => getGeminiApiKey());
    this.fetchFn = opts.fetchFn ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.deadlineMs = opts.deadlineMs ?? 25_000;
    this.retryDelayMs = opts.retryDelayMs ?? 1_000;
    this.temperature = opts.temperature ?? 0.3;
    this.maxOutputTokens = opts.maxOutputTokens ?? 8192;
  }

  async generateJson<S extends z.ZodType>(prompt: string, schema: S): Promise<z.infer<S>> {
    const apiKey = await this.getApiKey();
    const body = JSON.stringify(this.buildRequest(prompt, schema));
    const started = Date.now();

    // At most 2 attempts: the second only after a 429/5xx/network error/timeout or a bad answer.
    for (let attempt = 1; ; attempt++) {
      const remaining = this.deadlineMs - (Date.now() - started);
      let res: Response;
      try {
        res = await this.fetchFn(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body,
            signal: AbortSignal.timeout(Math.max(1_000, remaining)),
          },
        );
      } catch (err) {
        const code = (err as Error).name === 'TimeoutError' ? 'timeout' : 'network';
        if (attempt === 1 && this.canRetry(started)) {
          await this.sleep(this.retryDelayMs);
          continue;
        }
        throw new LlmError(code, `Gemini request failed: ${(err as Error).message}`);
      }

      if (!res.ok) {
        if (attempt === 1 && RETRYABLE(res.status) && this.canRetry(started)) {
          await this.sleep(this.retryDelayMs);
          continue;
        }
        throw new LlmError('http', `Gemini HTTP ${res.status}`, res.status);
      }

      try {
        return parseAndValidate(this.extractText((await res.json()) as GeminiResponse), schema);
      } catch (err) {
        // Models occasionally return truncated/malformed JSON; one fresh attempt usually fixes it.
        const retryable =
          err instanceof LlmError && ['invalid_json', 'schema_mismatch', 'empty'].includes(err.code);
        if (attempt === 1 && retryable && this.canRetry(started)) {
          console.warn('Retrying after bad model output', { code: (err as LlmError).code });
          continue;
        }
        throw err;
      }
    }
  }

  private canRetry(started: number): boolean {
    // Only retry when a second attempt still has a realistic time budget.
    return this.deadlineMs - (Date.now() - started) - this.retryDelayMs > 5_000;
  }

  private buildRequest(prompt: string, schema: z.ZodType) {
    let schemaHint = '';
    try {
      schemaHint = `\n\nReturn ONLY a JSON value matching this JSON Schema:\n${JSON.stringify(
        z.toJSONSchema(schema),
      )}`;
    } catch {
      // Some zod types (e.g. transforms) can't be expressed; zod validation still applies.
    }
    return {
      systemInstruction: { parts: [{ text: NO_INVENT_RULE }] },
      contents: [{ role: 'user', parts: [{ text: prompt + schemaHint }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: this.temperature,
        maxOutputTokens: this.maxOutputTokens,
      },
    };
  }

  private extractText(data: GeminiResponse): string {
    if (data.promptFeedback?.blockReason) {
      throw new LlmError('blocked', `Prompt blocked: ${data.promptFeedback.blockReason}`);
    }
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text.trim()) {
      throw new LlmError('empty', `Empty model response (finishReason=${candidate?.finishReason})`);
    }
    return text;
  }
}

let defaultProvider: LlmProvider | undefined;

/** The provider used by handlers. Swap the implementation here to change AI vendor. */
export function getLlmProvider(): LlmProvider {
  defaultProvider ??= new GeminiProvider();
  return defaultProvider;
}
