import { insertCoverLetter, installApplyWatcher, type InsertResult } from './pageActions.js';
import { readPage } from './pageReader.js';

/** The tab the user is looking at in this window (its url is visible only on the job sites). */
export async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/** Reads the page in a job-site tab. Needs the site's host permission (manifest). */
export async function readTab(tabId: number): Promise<ReturnType<typeof readPage>> {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: readPage });
  if (!res?.result) throw new Error('Could not read the page');
  return res.result as ReturnType<typeof readPage>;
}

/** Puts the cover letter into the application form on the page. */
export async function insertLetterIntoTab(tabId: number, letter: string): Promise<InsertResult> {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: insertCoverLetter, args: [letter] });
  return (res?.result as InsertResult | undefined) ?? { status: 'not_found' };
}

/** Starts noticing clicks on the site's "apply" buttons in this tab (see installApplyWatcher). */
export async function watchApplies(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, func: installApplyWatcher });
}

export function openUrl(url: string): void {
  void chrome.tabs.create({ url });
}

// ---------------------------------------------------------------- vacancy URL → last analysis

const KEY = 'analysisByUrl';
const MAX_ENTRIES = 100;

export interface SavedAnalysis {
  id: string;
  score: number;
}

/** Normalises a vacancy URL so the same vacancy maps to one key (no query, no hash). */
export const vacancyKey = (url: string) => {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`;
};

type Store = Record<string, SavedAnalysis | string>; // a bare id string = saved by phase 1

async function readStore(): Promise<Store> {
  return ((await chrome.storage.local.get(KEY))[KEY] as Store | undefined) ?? {};
}

export async function getSavedAnalysis(url: string): Promise<SavedAnalysis | undefined> {
  const v = (await readStore())[vacancyKey(url)];
  if (!v) return undefined;
  return typeof v === 'string' ? { id: v, score: NaN } : v;
}

export async function saveAnalysis(url: string, saved: SavedAnalysis): Promise<void> {
  const data = await readStore();
  delete data[vacancyKey(url)];
  data[vacancyKey(url)] = saved; // re-insert so the newest is last
  const keys = Object.keys(data);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete data[k];
  await chrome.storage.local.set({ [KEY]: data });
}

export async function clearSavedAnalyses(): Promise<void> {
  await chrome.storage.local.remove([KEY, TRACKED_KEY]);
}

// ---------------------------------------------------------------- score on the toolbar icon

/** Badge colour: CareerOS blue for a fair match (≥ 50), warm orange below. */
export const badgeColor = (score: number) => (score >= 50 ? '#2346D8' : '#C2410C');

export async function setScoreBadge(tabId: number, score: number | undefined): Promise<void> {
  const ok = typeof score === 'number' && Number.isFinite(score);
  await chrome.action.setBadgeText({ tabId, text: ok ? String(Math.round(score)) : '' });
  if (ok) {
    await chrome.action.setBadgeBackgroundColor({ tabId, color: badgeColor(score) });
    await chrome.action.setBadgeTextColor?.({ tabId, color: '#FFFFFF' });
  }
}

// ---------------------------------------------------------------- applications

const TRACKED_KEY = 'trackedByUrl';
const PENDING_KEY = 'pendingApplies';

/** Vacancies already added to the tracker from the extension (url key → application id). */
export async function getTracked(url: string): Promise<string | undefined> {
  const data = (await chrome.storage.local.get(TRACKED_KEY))[TRACKED_KEY] as Record<string, string> | undefined;
  return data?.[vacancyKey(url)];
}

export async function setTracked(url: string, applicationId: string): Promise<void> {
  const data = ((await chrome.storage.local.get(TRACKED_KEY))[TRACKED_KEY] as Record<string, string> | undefined) ?? {};
  data[vacancyKey(url)] = applicationId;
  const keys = Object.keys(data);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete data[k];
  await chrome.storage.local.set({ [TRACKED_KEY]: data });
}

/** "Apply" clicks seen while the panel was closed (session only), so the panel can offer them later. */
export async function addPendingApply(url: string): Promise<void> {
  const data = ((await chrome.storage.session.get(PENDING_KEY))[PENDING_KEY] as string[] | undefined) ?? [];
  const key = vacancyKey(url);
  if (!data.includes(key)) await chrome.storage.session.set({ [PENDING_KEY]: [...data, key].slice(-20) });
}

export async function takePendingApply(url: string): Promise<boolean> {
  const data = ((await chrome.storage.session.get(PENDING_KEY))[PENDING_KEY] as string[] | undefined) ?? [];
  const key = vacancyKey(url);
  if (!data.includes(key)) return false;
  await chrome.storage.session.set({ [PENDING_KEY]: data.filter((k) => k !== key) });
  return true;
}

export interface ApplyMessage {
  type: 'careeros:apply';
  url: string;
}
export const isApplyMessage = (m: unknown): m is ApplyMessage =>
  !!m && typeof m === 'object' && (m as ApplyMessage).type === 'careeros:apply' && typeof (m as ApplyMessage).url === 'string';
