import { describe, expect, it } from 'vitest';
import { newShareId, SHARE_ID_RE, uuidv7 } from './ids.js';

describe('ids', () => {
  it('uuidv7 is a valid v7 UUID that sorts by creation time', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });

  it('share ids are 12 url-safe chars and unique', () => {
    const ids = new Set(Array.from({ length: 1000 }, newShareId));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(id).toMatch(SHARE_ID_RE);
  });
});
