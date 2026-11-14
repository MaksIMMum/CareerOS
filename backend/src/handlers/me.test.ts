import { describe, it, expect, vi } from 'vitest';
import { handleMeRequest } from './me.js';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

describe('me handler', () => {
  const authorizedContext = (sub = 'sub-456', email = 'test@example.com') => ({
    http: { method: 'GET', path: '/me', protocol: 'HTTP/1.1', sourceIp: '127.0.0.1', userAgent: 'test' },
    authorizer: {
      jwt: {
        claims: { sub, email },
        scopes: [],
      },
    },
  });

  it('returns 401 when user is not authenticated', async () => {
    const event = {
      requestContext: { http: { method: 'GET' } },
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handleMeRequest(event)) as any;
    expect(res.statusCode).toBe(401);
  });

  it('GET /me returns 404 when profile not found', async () => {
    const mockSend = vi.fn().mockResolvedValue({ Item: undefined });
    const mockClient = { send: mockSend } as any;

    const event = {
      requestContext: authorizedContext(),
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handleMeRequest(event, mockClient, 'test-table')) as any;
    expect(res.statusCode).toBe(404);
  });

  it('GET /me returns 200 with profile when found', async () => {
    const mockProfile = { PK: 'USER#sub-456', SK: 'PROFILE', email: 'test@example.com' };
    const mockSend = vi.fn().mockResolvedValue({ Item: mockProfile });
    const mockClient = { send: mockSend } as any;

    const event = {
      requestContext: authorizedContext(),
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handleMeRequest(event, mockClient, 'test-table')) as any;
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ profile: mockProfile });
  });

  it('POST /me creates new profile and logs SIGNUP event if not existing', async () => {
    const mockSend = vi.fn().mockImplementation((cmd: any) => {
      // First call is GetCommand (check existing)
      if (cmd.input?.Key) {
        return Promise.resolve({ Item: undefined });
      }
      // Subsequent calls are PutCommand (profile, then event)
      return Promise.resolve({});
    });
    const mockClient = { send: mockSend } as any;

    const event = {
      requestContext: { ...authorizedContext(), http: { method: 'POST' } },
      body: JSON.stringify({ source: 'university_chat', lang: 'uk' }),
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handleMeRequest(event, mockClient, 'test-table')) as any;
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.profile).toEqual(
      expect.objectContaining({
        sub: 'sub-456',
        email: 'test@example.com',
        source: 'university_chat',
        lang: 'uk',
      }),
    );
    // Verified 3 DynamoDB calls: GetCommand, PutCommand for Profile, PutCommand for Event
    expect(mockSend).toHaveBeenCalledTimes(3);
  });
});
