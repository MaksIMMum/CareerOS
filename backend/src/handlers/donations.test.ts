import { describe, it, expect, vi } from 'vitest';
import { createDonationsHandler } from './donations.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('donations handler', () => {
  const authorizedContext = (sub = 'donor-123') => ({
    http: { method: 'POST', path: '/donations/click', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
    authorizer: {
      jwt: {
        claims: { sub },
        scopes: [],
      },
    },
  });

  it('POST /donations/click logs DONATE_CLICK event', async () => {
    const mockSend = vi.fn().mockResolvedValue({});
    const handler = createDonationsHandler({ send: mockSend } as any, 'test-table');

    const event = {
      rawPath: '/donations/click',
      requestContext: authorizedContext(),
      body: JSON.stringify({ url: 'https://send.monobank.ua/jar/123' }),
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handler(event)) as any;
    expect(res.statusCode).toBe(200);
    expect(mockSend).toHaveBeenCalledTimes(1);
    const putItem = mockSend.mock.calls[0][0].input.Item;
    expect(putItem.type).toBe('DONATE_CLICK');
  });

  it('POST /donations/report saves DONATION item and logs DONATE_REPORTED event', async () => {
    const mockSend = vi.fn().mockResolvedValue({});
    const handler = createDonationsHandler({ send: mockSend } as any, 'test-table');

    const event = {
      rawPath: '/donations/report',
      requestContext: { ...authorizedContext(), http: { method: 'POST', path: '/donations/report' } },
      body: JSON.stringify({ amount: 150, currency: 'UAH' }),
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handler(event)) as any;
    expect(res.statusCode).toBe(201);
    expect(mockSend).toHaveBeenCalledTimes(2); // item + event
    const item = JSON.parse(res.body).item;
    expect(item.amount).toBe(150);
    expect(item.currency).toBe('UAH');
  });
});
