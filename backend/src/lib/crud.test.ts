import { describe, expect, it, vi } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { createCrudHandler } from './crud.js';
import { createResourceRepo } from './items.js';
import { cvInputSchema, type CvInput } from './validation.js';

const ID = '3f2b8c1e-4a5d-4e6f-8a9b-0c1d2e3f4a5b';

function setup(sendImpl: (cmd: any) => unknown = () => ({})) {
  const send = vi.fn(async (cmd: any) => sendImpl(cmd));
  const repo = createResourceRepo<CvInput>(
    { prefix: 'CV', listAttributes: ['id', 'name', 'createdAt', 'updatedAt'], maxItems: 2 },
    { send } as any,
    'test-table',
  );
  return { send, handler: createCrudHandler(repo, cvInputSchema) };
}

function event(method: string, opts: { id?: string; body?: unknown; sub?: string | null } = {}) {
  const sub = opts.sub === undefined ? 'user-a' : opts.sub;
  return {
    requestContext: {
      http: { method },
      ...(sub ? { authorizer: { jwt: { claims: { sub } } } } : {}),
    },
    pathParameters: opts.id ? { id: opts.id } : undefined,
    body: opts.body === undefined ? undefined : typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body),
  } as unknown as APIGatewayProxyEventV2;
}

const call = async (h: ReturnType<typeof setup>['handler'], e: APIGatewayProxyEventV2) => {
  const res = (await h(e)) as { statusCode: number; body: string };
  return { status: res.statusCode, body: res.body ? JSON.parse(res.body) : undefined };
};

const conditionalFailure = () => {
  const err = new Error('conditional');
  err.name = 'ConditionalCheckFailedException';
  throw err;
};

describe('CRUD handler (/cvs)', () => {
  it('rejects requests without a user', async () => {
    const { handler } = setup();
    expect((await call(handler, event('GET', { sub: null }))).status).toBe(401);
  });

  it('creates a CV under the caller partition with a generated id', async () => {
    const { handler, send } = setup((cmd) => (cmd.input.Select === 'COUNT' ? { Count: 0 } : {}));
    const res = await call(handler, event('POST', { body: { name: 'Backend CV', text: 'Node.js' } }));

    expect(res.status).toBe(201);
    expect(res.body.item).toMatchObject({ name: 'Backend CV', text: 'Node.js' });
    expect(res.body.item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.item).not.toHaveProperty('PK');
    const put = send.mock.calls[1]![0].input;
    expect(put.Item.PK).toBe('USER#user-a');
    expect(put.Item.SK).toBe(`CV#${res.body.item.id}`);
  });

  it('returns 400 with details for invalid bodies and for broken JSON', async () => {
    const { handler, send } = setup();
    const invalid = await call(handler, event('POST', { body: { name: '', text: 'x' } }));
    expect(invalid.status).toBe(400);
    expect(invalid.body.error).toBe('validation_error');
    expect(invalid.body.details[0].path).toBe('name');

    const broken = await call(handler, event('POST', { body: '{not json' }));
    expect(broken.body.error).toBe('invalid_json');
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies with 413', async () => {
    const { handler } = setup();
    const res = await call(handler, event('POST', { body: { name: 'x', text: 'a'.repeat(70_000) } }));
    expect(res.status).toBe(413);
  });

  it('refuses to create more than maxItems', async () => {
    const { handler } = setup(() => ({ Count: 2 }));
    const res = await call(handler, event('POST', { body: { name: 'x', text: 'y' } }));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('limit_reached');
  });

  it('lists only the caller items, newest first, without the text', async () => {
    const { handler, send } = setup(() => ({
      Items: [
        { PK: 'USER#user-a', SK: 'CV#1', id: '1', name: 'Old', updatedAt: '2026-01-01' },
        { PK: 'USER#user-a', SK: 'CV#2', id: '2', name: 'New', updatedAt: '2026-02-01' },
      ],
    }));
    const res = await call(handler, event('GET'));
    expect(res.body.items.map((i: any) => i.name)).toEqual(['New', 'Old']);
    const q = send.mock.calls[0]![0].input;
    expect(q.ExpressionAttributeValues).toEqual({ ':pk': 'USER#user-a', ':sk': 'CV#' });
    expect(Object.values(q.ExpressionAttributeNames)).not.toContain('text');
  });

  it('reads another user id from the caller own partition only (-> 404)', async () => {
    const { handler, send } = setup(() => ({ Item: undefined }));
    const res = await call(handler, event('GET', { id: ID, sub: 'user-b' }));
    expect(res.status).toBe(404);
    expect(send.mock.calls[0]![0].input.Key).toEqual({ PK: 'USER#user-b', SK: `CV#${ID}` });
  });

  it('returns 404 for ids that are not UUIDs without touching the table', async () => {
    const { handler, send } = setup();
    expect((await call(handler, event('GET', { id: '../PROFILE' }))).status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it('updates an existing CV and 404s a missing one', async () => {
    const ok = setup(() => ({ Attributes: { PK: 'x', SK: 'y', id: ID, name: 'Generic CV', text: 't' } }));
    const updated = await call(ok.handler, event('PUT', { id: ID, body: { name: 'Generic CV', text: 't' } }));
    expect(updated.status).toBe(200);
    expect(updated.body.item).toEqual({ id: ID, name: 'Generic CV', text: 't' });
    expect(ok.send.mock.calls[0]![0].input.ConditionExpression).toBe('attribute_exists(PK)');

    const missing = setup(conditionalFailure);
    expect((await call(missing.handler, event('PUT', { id: ID, body: { name: 'x', text: 'y' } }))).status).toBe(404);
  });

  it('deletes with 204 and 404s a missing item', async () => {
    expect((await call(setup().handler, event('DELETE', { id: ID }))).status).toBe(204);
    expect((await call(setup(conditionalFailure).handler, event('DELETE', { id: ID }))).status).toBe(404);
  });

  it('hides unexpected errors behind a 500', async () => {
    const { handler } = setup(() => {
      throw new Error('boom: internal details');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call(handler, event('GET'));
    expect(res).toEqual({ status: 500, body: { error: 'internal_error' } });
  });
});
