import { describe, expect, it } from 'vitest';
import { fillDays } from './adminChart.js';

describe('fillDays', () => {
  it('fills quiet days between the first and last sign-up with zero, in order', () => {
    expect(fillDays({ '2026-11-16': 2, '2026-11-14': 1, unknown: 5 })).toEqual([
      { day: '2026-11-14', count: 1 },
      { day: '2026-11-15', count: 0 },
      { day: '2026-11-16', count: 2 },
    ]);
  });

  it('returns nothing when there are no sign-ups', () => {
    expect(fillDays({})).toEqual([]);
  });
});
