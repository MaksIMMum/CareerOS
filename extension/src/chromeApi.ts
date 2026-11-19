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

export function openUrl(url: string): void {
  void chrome.tabs.create({ url });
}

// ---------------------------------------------------------------- vacancy URL → last analysis

const KEY = 'analysisByUrl';
const MAX_ENTRIES = 100;

/** Normalises a vacancy URL so the same vacancy maps to one key (no query, no hash). */
export const vacancyKey = (url: string) => {
  const u = new URL(url);
  return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`;
};

export async function getSavedAnalysisId(url: string): Promise<string | undefined> {
  const data = (await chrome.storage.local.get(KEY))[KEY] as Record<string, string> | undefined;
  return data?.[vacancyKey(url)];
}

export async function saveAnalysisId(url: string, analysisId: string): Promise<void> {
  const data = ((await chrome.storage.local.get(KEY))[KEY] as Record<string, string> | undefined) ?? {};
  delete data[vacancyKey(url)];
  data[vacancyKey(url)] = analysisId; // re-insert so the newest is last
  const keys = Object.keys(data);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete data[k];
  await chrome.storage.local.set({ [KEY]: data });
}

export async function clearSavedAnalyses(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}
