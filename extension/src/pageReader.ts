/**
 * Runs INSIDE the job-site tab (chrome.scripting.executeScript) when the user opens the panel.
 * It must be self-contained: no imports, no outer variables. It only reads the page.
 */
export function readPage(): { url: string; title: string; html: string; selection: string } {
  const MAX_HTML = 3_000_000;
  return {
    url: location.href,
    title: document.title,
    html: document.documentElement.outerHTML.slice(0, MAX_HTML),
    selection: String(window.getSelection() ?? '').slice(0, 20_000),
  };
}
