import { describe, expect, it, vi } from 'vitest';
import {
  consumeQuota,
  DAILY_LIMITS,
  getQuotaUsage,
  QuotaExceededError,
  quotaDay,
  quotaExceededResponse,
  refundQuota,
} from './quota.js';

const NOW = new Date('2026-11-14T12:00:00Z');

describe('quotaDay', () => {
  it('uses the Kyiv calendar day, not UTC', () => {
    // 22:30 UTC on Nov 14 is already 00:30 on Nov 15 in Kyiv (UTC+2 in winter)
    expect(quotaDay(new Date('2026-11-14T22:30:00Z'))).toBe('2026-11-15');
    expect(quotaDay(new Date('2026-11-14T21:59:00Z'))).toBe('2026-11-14');
  });
});

describe('consumeQuota', () => {
  it('increments the right counter atomically, bounded by the daily limit', async () => {
    const send = vi.fn().mockResolvedValue({ Attributes: { analyses: 3 } });
    const res = await consumeQuota('u1', 'analysis', { client: { send }, tableName: 't', now: NOW });

    expect(res).toEqual({ used: 3, limit: 10, remaining: 7 });
    const input = send.mock.calls[0]![0].input;
    expect(input.Key).toEqual({ PK: 'USER#u1', SK: 'QUOTA#2026-11-14' });
    expect(input.ConditionExpression).toBe('attribute_not_exists(#c) OR #c < :limit');
    expect(input.ExpressionAttributeNames['#c']).toBe('analyses');
    expect(input.ExpressionAttributeValues[':limit']).toBe(DAILY_LIMITS.analysis);
    expect(input.ExpressionAttributeValues[':ttl']).toBeGreaterThan(NOW.getTime() / 1000);
  });

  it('uses a separate counter and limit of 5 for interviews', async () => {
    const send = vi.fn().mockResolvedValue({ Attributes: { interviews: 1 } });
    await consumeQuota('u1', 'interview', { client: { send }, tableName: 't', now: NOW });
    const input = send.mock.calls[0]![0].input;
    expect(input.ExpressionAttributeNames['#c']).toBe('interviews');
    expect(input.ExpressionAttributeValues[':limit']).toBe(5);
  });

  it('throws QuotaExceededError when the conditional update fails', async () => {
    const err = Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' });
    const send = vi.fn().mockRejectedValue(err);
    await expect(
      consumeQuota('u1', 'interview', { client: { send }, tableName: 't', now: NOW }),
    ).rejects.toMatchObject({ name: 'QuotaExceededError', kind: 'interview', limit: 5 });
  });

  it('rethrows other DynamoDB errors', async () => {
    const send = vi.fn().mockRejectedValue(new Error('throttled'));
    await expect(consumeQuota('u1', 'analysis', { client: { send }, tableName: 't' })).rejects.toThrow('throttled');
  });
});

describe('refundQuota / getQuotaUsage', () => {
  it('refund never goes below zero and ignores the guard failure', async () => {
    const err = Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' });
    const send = vi.fn().mockRejectedValue(err);
    await expect(refundQuota('u1', 'analysis', { client: { send }, tableName: 't' })).resolves.toBeUndefined();
    expect(send.mock.calls[0]![0].input.ConditionExpression).toBe('#c > :zero');
  });

  it('reports usage with zero defaults', async () => {
    const send = vi.fn().mockResolvedValue({ Item: { analyses: 4 } });
    expect(await getQuotaUsage('u1', { client: { send }, tableName: 't' })).toEqual({
      analysis: { used: 4, limit: 10 },
      interview: { used: 0, limit: 5 },
    });
  });
});

describe('quotaExceededResponse', () => {
  it('returns a friendly 429 in the request language', () => {
    const uk = quotaExceededResponse(new QuotaExceededError('analysis', 10), 'uk') as any;
    expect(uk.statusCode).toBe(429);
    const body = JSON.parse(uk.body);
    expect(body).toMatchObject({ error: 'quota_exceeded', kind: 'analysis', limit: 10 });
    expect(body.message).toContain('аналізів');

    const en = JSON.parse((quotaExceededResponse(new QuotaExceededError('interview', 5), 'en') as any).body);
    expect(en.message).toBe('You have used all 5 mock interviews for today. The limit resets at midnight Kyiv time.');
  });
});
