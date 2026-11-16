import { describe, expect, it } from 'vitest';
import type { Application, AppStatus } from './api.js';
import { bestVersion, cvStats, daysSince, isReply, localToday, needsFollowUp, resolveHadInterview } from './tracker.js';

let n = 0;
function app(cvId: string, status: AppStatus, extra: Partial<Application> = {}): Application {
  n += 1;
  return {
    id: `id-${n}`, vacancyId: null, cvId, cvName: cvId === 'a' ? 'Backend CV' : 'General CV', company: 'Acme',
    title: 'Junior', appliedAt: '2026-11-01', status, statusChangedAt: '2026-11-01T00:00:00.000Z',
    hadInterview: status === 'INTERVIEW' || status === 'OFFER', notes: '', createdAt: '', updatedAt: '',
    ...extra,
  };
}

describe('isReply', () => {
  it('counts interviews, offers and rejections after an interview only', () => {
    expect(isReply(app('a', 'APPLIED'))).toBe(false);
    expect(isReply(app('a', 'INTERVIEW'))).toBe(true);
    expect(isReply(app('a', 'OFFER'))).toBe(true);
    expect(isReply(app('a', 'REJECTED'))).toBe(false);
    expect(isReply(app('a', 'REJECTED', { hadInterview: true }))).toBe(true);
  });

  it('resolveHadInterview follows the status', () => {
    expect(resolveHadInterview('INTERVIEW', false)).toBe(true);
    expect(resolveHadInterview('APPLIED', true)).toBe(false);
    expect(resolveHadInterview('REJECTED', true)).toBe(true);
  });
});

describe('follow-up', () => {
  const now = new Date('2026-11-16T12:00:00.000Z');
  it('suggests a follow-up after more than 7 days in APPLIED', () => {
    expect(needsFollowUp({ status: 'APPLIED', statusChangedAt: '2026-11-08T11:00:00.000Z' }, now)).toBe(true);
    expect(needsFollowUp({ status: 'APPLIED', statusChangedAt: '2026-11-09T13:00:00.000Z' }, now)).toBe(false);
    expect(needsFollowUp({ status: 'INTERVIEW', statusChangedAt: '2026-10-01T00:00:00.000Z' }, now)).toBe(false);
  });
  it('daysSince and localToday', () => {
    expect(daysSince('2026-11-14T12:00:00.000Z', now)).toBe(2);
    expect(daysSince('garbage', now)).toBe(0);
    expect(localToday(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('cvStats + bestVersion', () => {
  it('computes sent, replies and rate per CV version, best first', () => {
    const apps = [
      app('b', 'APPLIED'), app('b', 'REJECTED'), app('b', 'INTERVIEW'), app('b', 'APPLIED'),
      app('a', 'INTERVIEW'), app('a', 'REJECTED', { hadInterview: true }), app('a', 'APPLIED'),
    ];
    const stats = cvStats(apps, new Map([['a', 'Backend CV v2']]));
    expect(stats).toEqual([
      { cvId: 'a', cvName: 'Backend CV v2', sent: 3, replies: 2, rate: 2 / 3 },
      { cvId: 'b', cvName: 'General CV', sent: 4, replies: 1, rate: 0.25 },
    ]);
    // (2/3) / (1/4) = 2.67 -> "3×"
    expect(bestVersion(stats)).toEqual({ kind: 'ratio', cvId: 'a', cvName: 'Backend CV v2', ratio: 3 });
  });

  it('keeps one decimal below 2×, calls small differences a tie', () => {
    const mk = (ra: number, sa: number, rb: number, sb: number) => [
      { cvId: 'a', cvName: 'A', sent: sa, replies: ra, rate: ra / sa },
      { cvId: 'b', cvName: 'B', sent: sb, replies: rb, rate: rb / sb },
    ];
    expect(bestVersion(mk(3, 4, 1, 2))).toEqual({ kind: 'ratio', cvId: 'a', cvName: 'A', ratio: 1.5 });
    expect(bestVersion(mk(5, 10, 9, 20))).toEqual({ kind: 'tie' });
  });

  it('handles "only this one gets replies", "no replies yet" and a single version', () => {
    expect(bestVersion(cvStats([app('a', 'OFFER'), app('b', 'APPLIED'), app('b', 'REJECTED')]))).toMatchObject({ kind: 'only', cvId: 'a' });
    expect(bestVersion(cvStats([app('a', 'APPLIED'), app('b', 'REJECTED')]))).toEqual({ kind: 'noReplies' });
    expect(bestVersion(cvStats([app('a', 'OFFER')]))).toBeNull();
    expect(bestVersion([])).toBeNull();
  });
});
