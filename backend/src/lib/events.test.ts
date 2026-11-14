import { describe, it, expect, vi } from 'vitest';
import { logEvent } from './events.js';

describe('logEvent', () => {
  it('creates correct EVENT item schema and sends PutCommand to DynamoDB', async () => {
    const mockSend = vi.fn().mockResolvedValue({});
    const mockClient = { send: mockSend } as any;

    const result = await logEvent(
      'user-123',
      'SIGNUP',
      { email: 'test@example.com', source: 'poster' },
      mockClient,
      'test-table',
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const command = mockSend.mock.calls[0][0];
    expect(command.input.TableName).toBe('test-table');
    expect(command.input.Item).toEqual(
      expect.objectContaining({
        type: 'SIGNUP',
        sub: 'user-123',
        GSI1PK: 'USER#user-123',
        payload: { email: 'test@example.com', source: 'poster' },
      }),
    );
    expect(command.input.Item.PK).toMatch(/^EVENT#\d{4}-\d{2}-\d{2}$/);
    expect(command.input.Item.SK).toContain('#user-123#SIGNUP');
    expect(result.sub).toBe('user-123');
  });
});
