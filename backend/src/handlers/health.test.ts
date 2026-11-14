import { describe, it, expect } from 'vitest';
import { handler } from './health.js';
import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';

describe('Health check handler', () => {
  it('returns ok: true with statusCode 200', async () => {
    const fakeEvent = {} as APIGatewayProxyEventV2;
    const fakeContext = {} as Context;
    const result = await handler(fakeEvent, fakeContext, () => {});

    expect(result).toBeDefined();
    if (typeof result === 'object' && result !== null && 'statusCode' in result) {
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body as string)).toEqual({ ok: true });
    } else {
      throw new Error('Unexpected response format from handler');
    }
  });
});
