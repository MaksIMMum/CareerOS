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
    // Verified 5 DynamoDB calls: GetCommand (existing check), PutCommand for Profile, PutCommand for SIGNUP event, PutCommand for LOGINDAY, PutCommand for LOGIN_DAY event
    expect(mockSend).toHaveBeenCalledTimes(5);
  });

  const postEvent = (body: unknown) =>
    ({
      requestContext: { ...authorizedContext(), http: { method: 'POST' } },
      body: JSON.stringify(body),
    }) as unknown as APIGatewayProxyEventV2;

  it('POST /me stores the ?src= value next to the source answer and logs it', async () => {
    const puts: any[] = [];
    const mockSend = vi.fn().mockImplementation((cmd: any) => {
      if (cmd.input?.Key) return Promise.resolve({ Item: undefined });
      puts.push(cmd.input);
      return Promise.resolve({});
    });

    const res = (await handleMeRequest(
      postEvent({ source: 'telegram', src: ' Poster ', lang: 'en' }),
      { send: mockSend } as any,
      'test-table',
    )) as any;

    expect(res.statusCode).toBe(201);
    const [profilePut, eventPut] = puts;
    expect(profilePut.Item).toEqual(
      expect.objectContaining({ source: 'telegram', src: 'poster', lang: 'en' }),
    );
    expect(profilePut.ConditionExpression).toBe('attribute_not_exists(PK)');
    expect(eventPut.Item.type).toBe('SIGNUP');
    expect(eventPut.Item.payload).toEqual(
      expect.objectContaining({ source: 'telegram', src: 'poster' }),
    );
  });

  it('POST /me rejects unknown source answers and junk src values', async () => {
    const puts: any[] = [];
    const mockSend = vi.fn().mockImplementation((cmd: any) => {
      if (cmd.input?.Key) return Promise.resolve({ Item: undefined });
      puts.push(cmd.input);
      return Promise.resolve({});
    });

    await handleMeRequest(
      postEvent({ source: '<script>', src: '!!!' }),
      { send: mockSend } as any,
      'test-table',
    );

    expect(puts[0].Item.source).toBe('unknown');
    expect(puts[0].Item).not.toHaveProperty('src');
    expect(puts[0].Item.lang).toBe('uk');
  });

  it('POST /me logs no second SIGNUP when a concurrent request created the profile first', async () => {
    const existing = { PK: 'USER#sub-456', SK: 'PROFILE', email: 'test@example.com' };
    let gets = 0;
    const mockSend = vi.fn().mockImplementation((cmd: any) => {
      if (cmd.input?.Key) {
        gets += 1;
        // first GET: not there yet; GET after the failed conditional put: the winner's item
        return Promise.resolve({ Item: gets === 1 ? undefined : existing });
      }
      const err = new Error('The conditional request failed');
      err.name = 'ConditionalCheckFailedException';
      return Promise.reject(err);
    });

    const res = (await handleMeRequest(
      postEvent({ source: 'dou' }),
      { send: mockSend } as any,
      'test-table',
    )) as any;

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ profile: existing });
    // GET, failed conditional PUT, GET — and no event PUT
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it('POST /me rethrows unexpected DynamoDB errors', async () => {
    const mockSend = vi.fn().mockImplementation((cmd: any) => {
      if (cmd.input?.Key) return Promise.resolve({ Item: undefined });
      return Promise.reject(new Error('ProvisionedThroughputExceededException'));
    });

    await expect(
      handleMeRequest(postEvent({}), { send: mockSend } as any, 'test-table'),
    ).rejects.toThrow('ProvisionedThroughputExceededException');
  });

  it('DELETE /me queries and deletes all items under USER#sub and logs USER_DELETED', async () => {
    const deletes: any[] = [];
    const mockSend = vi.fn().mockImplementation((cmd: any) => {
      // QueryCommand
      if (cmd.input?.KeyConditionExpression) {
        return Promise.resolve({
          Items: [
            { PK: 'USER#sub-456', SK: 'PROFILE' },
            { PK: 'USER#sub-456', SK: 'CV#123' },
          ],
        });
      }
      // DeleteCommand
      if (cmd.input?.Key) {
        deletes.push(cmd.input.Key);
        return Promise.resolve({});
      }
      // PutCommand for USER_DELETED event
      return Promise.resolve({});
    });

    const deleteEvent = {
      requestContext: { ...authorizedContext(), http: { method: 'DELETE' } },
    } as unknown as APIGatewayProxyEventV2;

    const res = (await handleMeRequest(deleteEvent, { send: mockSend } as any, 'test-table')) as any;
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, message: 'Account and all data deleted' });
    expect(deletes).toHaveLength(2);
  });
});
