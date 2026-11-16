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
  /**
   * Second model, used only for the LAST attempt after the main model kept failing with
   * 429/5xx/timeouts (Google's "model is experiencing high demand"). Default: GEMINI_FALLBACK_MODEL.
   */
  fallbackModel?: string;
  /** Whole call budget incl. retries; Lambda times out at 29 s. */
  deadlineMs?: number;
  /** Waits before each retry after an overload/network error; their count + 1 = max attempts. */
  retryDelaysMs?: number[];
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
  private readonly fallbackModel: string | undefined;
  private readonly retryDelaysMs: number[];
  private readonly temperature: number;
  private readonly maxOutputTokens: number;

  constructor(opts: GeminiOptions = {}) {
    this.model = opts.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
    this.getApiKey = opts.getApiKey ?? (() => getGeminiApiKey());
    this.fetchFn = opts.fetchFn ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.deadlineMs = opts.deadlineMs ?? 25_000;
    this.fallbackModel = (opts.fallbackModel ?? process.env.GEMINI_FALLBACK_MODEL) || undefined;
    this.retryDelaysMs = opts.retryDelaysMs ?? [1_500, 3_000, 5_000];
    this.temperature = opts.temperature ?? 0.3;
    this.maxOutputTokens = opts.maxOutputTokens ?? 8192;
  }

  async generateJson<S extends z.ZodType>(prompt: string, schema: S): Promise<z.infer<S>> {
    const apiKey = await this.getApiKey();
    const body = JSON.stringify(this.buildRequest(prompt, schema));
    const started = Date.now();
    const maxAttempts = this.retryDelaysMs.length + 1;
    let overloadRetries = 0; // retries after 429/5xx/network/timeout (with a growing wait)
    let badOutputRetried = false; // at most one fresh attempt after a malformed answer

    for (;;) {
      // The last allowed attempt goes to the fallback model, if one is configured.
      const lastAttempt = overloadRetries === maxAttempts - 1;
      const model = lastAttempt && this.fallbackModel ? this.fallbackModel : this.model;
      const remaining = this.deadlineMs - (Date.now() - started);
      let failure: { code: LlmErrorCode; message: string; status?: number } | undefined;
      let res: Response | undefined;
      try {
        res = await this.fetchFn(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body,
            signal: AbortSignal.timeout(Math.max(1_000, remaining)),
          },
        );
      } catch (err) {
        const code = (err as Error).name === 'TimeoutError' ? 'timeout' : 'network';
        failure = { code, message: `Gemini request failed: ${(err as Error).message}` };
      }

      if (res && !res.ok) {
        if (!RETRYABLE(res.status)) throw new LlmError('http', `Gemini HTTP ${res.status}`, res.status);
        failure = { code: 'http', message: `Gemini HTTP ${res.status}`, status: res.status };
      }

      if (failure) {
        const delay = this.retryDelaysMs[overloadRetries];
        if (delay !== undefined && this.canRetry(started, delay)) {
          console.warn('Gemini busy, retrying', { model, status: failure.status, code: failure.code, attempt: overloadRetries + 1 });
          overloadRetries++;
          await this.sleep(delay);
          continue;
        }
        throw new LlmError(failure.code, failure.message, failure.status);
      }

      try {
        const result = parseAndValidate(this.extractText((await res!.json()) as GeminiResponse), schema);
        if (model !== this.model) console.warn('Answered by the fallback model', { model });
        return result;
      } catch (err) {
        // Models occasionally return truncated/malformed JSON; one fresh attempt usually fixes it.
        const retryable =
          err instanceof LlmError && ['invalid_json', 'schema_mismatch', 'empty'].includes(err.code);
        if (retryable && !badOutputRetried && this.canRetry(started, 0)) {
          console.warn('Retrying after bad model output', { code: (err as LlmError).code });
          badOutputRetried = true;
          continue;
        }
        throw err;
      }
    }
  }

  private canRetry(started: number, delayMs: number): boolean {
    // Only retry when another attempt still has a realistic time budget after the wait.
    return this.deadlineMs - (Date.now() - started) - delayMs > 5_000;
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
