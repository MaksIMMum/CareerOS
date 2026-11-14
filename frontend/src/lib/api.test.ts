import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiRequest } from './api.js';

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

    await expect(apiRequest('/me')).rejects.toThrow('User profile not found');
  });
});
