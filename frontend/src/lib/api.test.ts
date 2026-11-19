import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError, apiRequest, withAiRetry } from './api.js';

describe('apiRequest helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('performs fetch with JSON headers and parses response', async () => {
    const mockData = { ok: true, profile: { sub: 'test-123' } };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockData),
    });

    const res = await apiRequest('/me');
    expect(res).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      '/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('throws helpful error message on non-200 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: vi.fn().mockResolvedValue({ error: 'User profile not found' }),
    });

    const err = await apiRequest('/me').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe('User profile not found');
    expect((err as ApiError).status).toBe(404);
  });
});

describe('withAiRetry', () => {
  it('retries once when the AI was too slow or busy', async () => {
    for (const code of ['ai_timeout', 'ai_unavailable']) {
      const fn = vi.fn().mockRejectedValueOnce(new ApiError(code, 504, code)).mockResolvedValueOnce('ok');
      expect(await withAiRetry(fn, 0)).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });

  it('gives up after the second failure with the original error', async () => {
    const fn = vi.fn().mockRejectedValue(new ApiError('ai_timeout', 504, 'ai_timeout'));
    await expect(withAiRetry(fn, 0)).rejects.toMatchObject({ code: 'ai_timeout' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors (quota, validation, network)', async () => {
    for (const err of [new ApiError('quota_exceeded', 429, 'quota_exceeded'), new ApiError('validation_error', 400, 'validation_error'), new TypeError('Failed to fetch')]) {
      const fn = vi.fn().mockRejectedValue(err);
      await expect(withAiRetry(fn, 0)).rejects.toBe(err);
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });
});
