import { describe, it, expect, vi } from 'vitest';
import { createFeedbackHandler } from './feedback.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('feedback handler', () => {
  const authorizedContext = (sub = 'user-test-123') => ({
    http: { method: 'POST', path: '/feedback', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
    authorizer: {
      jwt: {
        claims: { sub },
        scopes: [],
      },
    },
  });

  it('rejects unauthenticated request with 401', async () => {
    const handler = createFeedbackHandler({ send: vi.fn() } as any, 'test-table');
    const event = {
      requestContext: { http: { method: 'POST' } },
      body: JSON.stringify({ rating: 5 }),
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handler(event)) as any;
    expect(res.statusCode).toBe(401);
  });

  it('rejects invalid rating (< 1 or > 5) with 400', async () => {
    const handler = createFeedbackHandler({ send: vi.fn() } as any, 'test-table');
    const event = {
      requestContext: authorizedContext(),
      body: JSON.stringify({ rating: 6 }),
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handler(event)) as any;
    expect(res.statusCode).toBe(400);
  });

  it('stores feedback in DynamoDB and logs FEEDBACK event', async () => {
    const mockSend = vi.fn().mockResolvedValue({});
    const handler = createFeedbackHandler({ send: mockSend } as any, 'test-table');

    const event = {
      requestContext: authorizedContext(),
      body: JSON.stringify({
        rating: 5,
        useful: 'Great AI resume rewrite',
        confusing: 'Nothing',
        callRequested: true,
        contact: '@tg_handle',
        context: 'analysis',
      }),
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handler(event)) as any;
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.item).toEqual(
      expect.objectContaining({
        sub: 'user-test-123',
        rating: 5,
        useful: 'Great AI resume rewrite',
        callRequested: true,
        contact: '@tg_handle',
        context: 'analysis',
      }),
    );
    expect(mockSend).toHaveBeenCalledTimes(2); // PutCommand item, PutCommand event
  });
});
