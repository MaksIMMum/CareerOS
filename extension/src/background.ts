import { getSavedAnalysis, isApplyMessage, addPendingApply, setScoreBadge } from './chromeApi.js';
import { isVacancyUrl } from './sites.js';

/**
 * Service worker:
 *  - clicking the toolbar icon opens the CareerOS side panel next to the page;
 *  - on a vacancy you already analysed, the icon shows your match score (no network call);
 *  - "apply" clicks seen while the panel is closed are kept for the panel to offer later.
 */
const openOnClick = () =>
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: unknown) => console.error(err));

chrome.runtime.onInstalled.addListener(() => void openOnClick());
chrome.runtime.onStartup.addListener(() => void openOnClick());

async function updateBadge(tabId: number, url: string | undefined) {
  try {
    const saved = url && isVacancyUrl(url) ? await getSavedAnalysis(url) : undefined;
    await setScoreBadge(tabId, saved?.score);
  } catch {
    // tab closed meanwhile
  }
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.url || info.status === 'complete') void updateBadge(tabId, tab.url);
});
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void chrome.tabs.get(tabId).then((tab) => updateBadge(tabId, tab.url)).catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, sender) => {
  // Only from our own watcher in a job-site tab.
  if (sender.id !== chrome.runtime.id || !sender.tab || !isApplyMessage(message)) return;
  if (isVacancyUrl(message.url)) void addPendingApply(message.url);
});
