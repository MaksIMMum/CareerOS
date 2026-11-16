import { describe, it, expect, vi } from 'vitest';
import { createAdminHandler } from './admin.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('admin metrics handler', () => {
  const adminContext = (sub = 'admin-1', groups: string[] = ['admins']) => ({
    http: { method: 'GET', path: '/admin/metrics', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
    authorizer: {
      jwt: {
        claims: { sub, 'cognito:groups': groups },
        scopes: [],
      },
    },
  });

  it('rejects non-admin users with 403', async () => {
    const handler = createAdminHandler({ send: vi.fn() } as any, 'test-table');
    const event = {
      requestContext: adminContext('regular-user', []),
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handler(event)) as any;
    expect(res.statusCode).toBe(403);
  });

  it('computes metrics from scanned DynamoDB items for admin users', async () => {
    const mockItems = [
      {
        PK: 'USER#sub-1',
        SK: 'PROFILE',
        sub: 'sub-1',
        email: 'user1@example.com',
        source: 'poster',
        src: 'poster',
        createdAt: '2026-11-14T10:00:00.000Z',
      },
      {
        PK: 'USER#sub-2',
        SK: 'PROFILE',
        sub: 'sub-2',
        email: 'maksym.kornatskyy@gmail.com', // team email
        source: 'telegram',
        createdAt: '2026-11-14T11:00:00.000Z',
      },
      // Event: 2 analyses for sub-1 (Real Use!)
      { PK: 'EVENT#2026-11-14', SK: '1#sub-1#ANALYSIS', type: 'ANALYSIS', sub: 'sub-1', createdAt: '2026-11-14T10:05:00.000Z' },
      { PK: 'EVENT#2026-11-14', SK: '2#sub-1#ANALYSIS', type: 'ANALYSIS', sub: 'sub-1', createdAt: '2026-11-14T10:10:00.000Z' },
      // Event: application added on day 2 (Return!)
      { PK: 'EVENT#2026-11-15', SK: '3#sub-1#APPLICATION_ADDED', type: 'APPLICATION_ADDED', sub: 'sub-1', createdAt: '2026-11-15T12:00:00.000Z' },
      // Donation click and report
      { PK: 'EVENT#2026-11-15', SK: '4#sub-1#DONATE_CLICK', type: 'DONATE_CLICK', sub: 'sub-1', createdAt: '2026-11-15T12:30:00.000Z' },
      { PK: 'EVENT#2026-11-15', SK: '5#sub-1#DONATE_REPORTED', type: 'DONATE_REPORTED', sub: 'sub-1', createdAt: '2026-11-15T12:35:00.000Z', payload: { amount: 200 } },
      // Feedback
      {
        PK: 'USER#sub-1',
        SK: 'FEEDBACK#f1',
        id: 'f1',
        sub: 'sub-1',
        rating: 5,
        useful: 'Very fast',
        confusing: 'None',
        callRequested: true,
        contact: '@tg_max',
        context: 'analysis',
        createdAt: '2026-11-15T12:40:00.000Z',
      },
    ];

    const mockSend = vi.fn().mockResolvedValue({ Items: mockItems });
    const handler = createAdminHandler({ send: mockSend } as any, 'test-table');

    const event = {
      requestContext: adminContext('admin-1', ['admins']),
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handler(event)) as any;
    expect(res.statusCode).toBe(200);
    const data = JSON.parse(res.body);

    expect(data.totals.signups).toBe(2);
    expect(data.totals.realUse).toBe(1); // sub-1 has 2 analyses
    expect(data.totals.returnUsers).toBe(1); // sub-1 returned next day and added app
    expect(data.totals.donationClicks).toBe(1);
    expect(data.totals.donationsReported).toBe(1);
    expect(data.totals.totalDonatedAmount).toBe(200);
    expect(data.feedback).toHaveLength(1);

    const user2 = data.users.find((u: any) => u.sub === 'sub-2');
    expect(user2.isTeam).toBe(true);
  });
});
