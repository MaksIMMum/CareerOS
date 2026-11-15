import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  DEFAULT_GEMINI_MODEL,
  extractJson,
  GeminiProvider,
  getGeminiApiKey,
  LlmError,
  NO_INVENT_RULE,
  resetGeminiApiKeyCache,
} from './llm.js';

const schema = z.object({ score: z.number().min(0).max(100), missing: z.array(z.string()) });

const geminiBody = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
});

const response = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function provider(...responses: (Response | Error)[]) {
  const fetchFn = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected extra call');
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async () => {});
  const p = new GeminiProvider({ getApiKey: async () => 'test-key', fetchFn: fetchFn as any, sleep });
  return { p, fetchFn, sleep };
}

describe('extractJson', () => {
  it('parses plain and ```json fenced output', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('throws invalid_json for non-JSON text', () => {
    expect(() => extractJson('Sure! Here is your JSON: {')).toThrow(
      expect.objectContaining({ code: 'invalid_json' }),
    );
  });
});

describe('GeminiProvider', () => {
  it('calls the default model with JSON mode, the key header and the no-invent rule', async () => {
    const { p, fetchFn } = provider(response(200, geminiBody('{"score":72,"missing":["Docker"]}')));
    const out = await p.generateJson('Compare CV and vacancy', schema);

    expect(out).toEqual({ score: 72, missing: ['Docker'] });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.systemInstruction.parts[0].text).toBe(NO_INVENT_RULE);
    expect(NO_INVENT_RULE).toMatch(/do not invent experience or skills/i);
    expect(body.contents[0].parts[0].text).toContain('JSON Schema');
  });

  it('uses the GEMINI_MODEL env var when set', async () => {
    const prev = process.env.GEMINI_MODEL;
    process.env.GEMINI_MODEL = 'gemini-3.8-flash';
    try {
      const { p, fetchFn } = provider(response(200, geminiBody('{"score":1,"missing":[]}')));
      await p.generateJson('x', schema);
      expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toContain('/models/gemini-3.8-flash:');
    } finally {
      if (prev === undefined) delete process.env.GEMINI_MODEL;
      else process.env.GEMINI_MODEL = prev;
    }
  });

  it('retries once on 429 and then succeeds', async () => {
    const { p, fetchFn, sleep } = provider(
      response(429),
      response(200, geminiBody('{"score":10,"missing":[]}')),
    );
    expect(await p.generateJson('x', schema)).toEqual({ score: 10, missing: [] });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it('retries once on a network error', async () => {
    const { p, fetchFn } = provider(new TypeError('fetch failed'), response(200, geminiBody('{"score":1,"missing":[]}')));
    await p.generateJson('x', schema);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('gives up after the single retry on repeated 5xx', async () => {
    const { p, fetchFn } = provider(response(503), response(500));
    await expect(p.generateJson('x', schema)).rejects.toMatchObject({ code: 'http', status: 500 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry client errors such as 400 or 403', async () => {
    const { p, fetchFn } = provider(response(400));
    await expect(p.generateJson('x', schema)).rejects.toMatchObject({ code: 'http', status: 400 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('rejects JSON that does not match the zod schema (after one retry)', async () => {
    const bad = () => response(200, geminiBody('{"score":"high","missing":[]}'));
    const { p, fetchFn } = provider(bad(), bad());
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(p.generateJson('x', schema)).rejects.toMatchObject({ code: 'schema_mismatch' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('retries once on truncated JSON and returns the good second answer', async () => {
    const { p, fetchFn } = provider(
      response(200, geminiBody('{"score":72,"missing":["Dock')),
      response(200, geminiBody('{"score":72,"missing":["Docker"]}')),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await p.generateJson('x', schema)).toEqual({ score: 72, missing: ['Docker'] });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('reports blocked prompts and empty answers distinctly', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const blocked = provider(response(200, { promptFeedback: { blockReason: 'SAFETY' } }));
    await expect(blocked.p.generateJson('x', schema)).rejects.toMatchObject({ code: 'blocked' });

    const emptyBody = { candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }] };
    const empty = provider(response(200, emptyBody), response(200, emptyBody));
    await expect(empty.p.generateJson('x', schema)).rejects.toMatchObject({ code: 'empty' });
  });

  it('does not retry when the deadline leaves no time for a second attempt', async () => {
    const fetchFn = vi.fn(async () => response(503));
    const p = new GeminiProvider({ getApiKey: async () => 'k', fetchFn: fetchFn as any, sleep: async () => {}, deadlineMs: 3_000 });
    await expect(p.generateJson('x', schema)).rejects.toBeInstanceOf(LlmError);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('getGeminiApiKey', () => {
  afterEach(() => resetGeminiApiKeyCache());

  it('reads the SecureString once per cold start and caches it', async () => {
    const send = vi.fn().mockResolvedValue({ Parameter: { Value: ' secret-key ' } });
    expect(await getGeminiApiKey({ send } as any, '/careeros/gemini-api-key')).toBe('secret-key');
    expect(await getGeminiApiKey({ send } as any, '/careeros/gemini-api-key')).toBe('secret-key');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].input).toEqual({ Name: '/careeros/gemini-api-key', WithDecryption: true });
  });

  it('turns SSM failures into a config error and retries on the next call', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('nope'), { name: 'ParameterNotFound' }))
      .mockResolvedValueOnce({ Parameter: { Value: 'k2' } });
    await expect(getGeminiApiKey({ send } as any)).rejects.toMatchObject({ code: 'config' });
    expect(await getGeminiApiKey({ send } as any)).toBe('k2');
  });
});
