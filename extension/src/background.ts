/**
 * Service worker: clicking the toolbar icon opens the CareerOS side panel next to the page.
 * Everything else happens in the side panel (sidepanel.html).
 */
const openOnClick = () =>
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err: unknown) => console.error(err));

chrome.runtime.onInstalled.addListener(() => void openOnClick());
chrome.runtime.onStartup.addListener(() => void openOnClick());
