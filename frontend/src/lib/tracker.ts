import type { Application, AppStatus } from './api.js';

/** An application is "in APPLIED for too long" after this many days: suggest a follow-up. */
export const FOLLOW_UP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A reply = the company answered with something more than silence or an instant "no":
 * the application reached INTERVIEW or OFFER, or was REJECTED after an interview.
 * A rejection without an interview is not a reply.
 */
export function isReply(a: Pick<Application, 'status' | 'hadInterview'>): boolean {
  return a.status === 'INTERVIEW' || a.status === 'OFFER' || (a.status === 'REJECTED' && a.hadInterview);
}

/** Mirrors the backend: INTERVIEW/OFFER imply an interview, APPLIED clears it. */
export function resolveHadInterview(status: AppStatus, requested: boolean): boolean {
  if (status === 'INTERVIEW' || status === 'OFFER') return true;
  if (status === 'APPLIED') return false;
  return requested;
}

export function daysSince(iso: string, now: Date = new Date()): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export function needsFollowUp(a: Pick<Application, 'status' | 'statusChangedAt'>, now: Date = new Date()): boolean {
  return a.status === 'APPLIED' && daysSince(a.statusChangedAt, now) > FOLLOW_UP_DAYS;
}

/** Today in the user's time zone, as YYYY-MM-DD (the value of <input type="date">). */
export function localToday(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export interface CvStats {
  cvId: string;
  cvName: string;
  sent: number;
  replies: number;
  /** replies / sent, 0..1 */
  rate: number;
}

/**
 * Per CV version: how many applications were sent with it and how many got a reply.
 * `currentNames` (from /cvs) wins over the snapshot stored on the application, so renames show up.
 * Sorted best first: reply rate, then number sent.
 */
export function cvStats(apps: Application[], currentNames: Map<string, string> = new Map()): CvStats[] {
  const by = new Map<string, CvStats>();
  for (const a of apps) {
    const s = by.get(a.cvId) ?? {
      cvId: a.cvId,
      cvName: currentNames.get(a.cvId) ?? a.cvName,
      sent: 0,
      replies: 0,
      rate: 0,
    };
    s.sent += 1;
    if (isReply(a)) s.replies += 1;
    by.set(a.cvId, s);
  }
  const list = [...by.values()].map((s) => ({ ...s, rate: s.sent ? s.replies / s.sent : 0 }));
  return list.sort((a, b) => b.rate - a.rate || b.sent - a.sent || a.cvName.localeCompare(b.cvName));
}

export type BestVersion =
  | { kind: 'ratio'; cvId: string; cvName: string; ratio: number }
  | { kind: 'only'; cvId: string; cvName: string }
  | { kind: 'tie' }
  | { kind: 'noReplies' };

/** Below this ratio two versions are "about the same" — small samples are noisy. */
export const TIE_RATIO = 1.25;

/**
 * Compares the best CV version with all the other versions together.
 * Null when there is nothing to compare (fewer than two versions were sent).
 */
export function bestVersion(stats: CvStats[]): BestVersion | null {
  if (stats.length < 2) return null;
  const [best, ...rest] = stats;
  if (!best || best.replies === 0) return { kind: 'noReplies' };
  const sent = rest.reduce((n, s) => n + s.sent, 0);
  const replies = rest.reduce((n, s) => n + s.replies, 0);
  const otherRate = sent ? replies / sent : 0;
  if (otherRate === 0) return { kind: 'only', cvId: best.cvId, cvName: best.cvName };
  const ratio = best.rate / otherRate;
  if (ratio < TIE_RATIO) return { kind: 'tie' };
  return { kind: 'ratio', cvId: best.cvId, cvName: best.cvName, ratio: ratio >= 2 ? Math.round(ratio) : Math.round(ratio * 10) / 10 };
}
