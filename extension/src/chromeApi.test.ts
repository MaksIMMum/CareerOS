import { describe, expect, it } from 'vitest';
import { badgeColor, isApplyMessage, vacancyKey } from './chromeApi.js';
import { localDate } from './sidepanel/TrackerCard.js';

describe('extension helpers', () => {
  it('colours the score badge like the website (blue ≥ 50, orange below)', () => {
    expect(badgeColor(68)).toBe('#2346D8');
    expect(badgeColor(50)).toBe('#2346D8');
    expect(badgeColor(49)).toBe('#C2410C');
  });

  it('formats the applied-on date in local time', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('accepts only well-formed apply messages', () => {
    expect(isApplyMessage({ type: 'careeros:apply', url: 'https://djinni.co/jobs/1/' })).toBe(true);
    expect(isApplyMessage({ type: 'other', url: 'x' })).toBe(false);
    expect(isApplyMessage({ type: 'careeros:apply' })).toBe(false);
    expect(isApplyMessage(null)).toBe(false);
  });

  it('keys a vacancy by host and path', () => {
    expect(vacancyKey('https://www.work.ua/jobs/1/?utm=x#top')).toBe('work.ua/jobs/1');
  });
});
