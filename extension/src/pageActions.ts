/**
 * Functions that run INSIDE the job-site tab via chrome.scripting.executeScript, only when the
 * user acts in the side panel. Each must be self-contained: no imports, no outer variables.
 */

export type InsertResult = { status: 'inserted'; where: 'focused' | 'djinni' | 'textarea' } | { status: 'not_found' };

/**
 * Puts the cover letter into the site's application message field:
 *  1. the text field the user last clicked into on the page, if any;
 *  2. Djinni: the "Відгукнутися" form's #message (opening the form if it is still hidden);
 *  3. otherwise the visible textarea that looks most like a cover-letter / message field.
 * The value is set the way frameworks expect (native setter + input/change events).
 */
export function insertCoverLetter(letter: string): InsertResult {
  type Field = HTMLTextAreaElement | HTMLInputElement | HTMLElement;
  const visible = (el: Element) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const isTextField = (el: Element | null): el is Field =>
    !!el &&
    (el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLInputElement && el.type === 'text') ||
      (el instanceof HTMLElement && el.isContentEditable));

  const fill = (el: Field) => {
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, letter);
    } else {
      el.textContent = letter;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus();
    const prev = el.style.outline;
    el.style.outline = '3px solid #FFD84D';
    setTimeout(() => (el.style.outline = prev), 2500);
  };

  // 1. The field the user clicked into last.
  const active = document.activeElement;
  if (isTextField(active) && visible(active)) {
    fill(active);
    return { status: 'inserted', where: 'focused' };
  }

  // 2. Djinni's apply form.
  if (location.hostname.endsWith('djinni.co')) {
    const field = document.querySelector<HTMLTextAreaElement>('#apply_form textarea[name="message"], #apply_form #message');
    if (field) {
      if (!visible(field)) document.querySelector<HTMLElement>('.js-inbox-toggle-reply-form')?.click();
      fill(field);
      return { status: 'inserted', where: 'djinni' };
    }
  }

  // 3. The best-looking visible textarea.
  const HINT = /cover|letter|message|motivation|лист|повідомлен|супровід|сопровод|коментар|comment|про себе/i;
  const areas = [...document.querySelectorAll('textarea')].filter(visible);
  const scored = areas
    .map((a) => {
      const label = a.id ? document.querySelector(`label[for="${CSS.escape(a.id)}"]`)?.textContent ?? '' : '';
      const text = [a.name, a.id, a.placeholder, a.getAttribute('aria-label') ?? '', label].join(' ');
      return { a, score: HINT.test(text) ? 2 : 0 };
    })
    .sort((x, y) => y.score - x.score);
  const best = scored[0];
  if (best && (best.score > 0 || areas.length === 1)) {
    fill(best.a);
    return { status: 'inserted', where: 'textarea' };
  }
  return { status: 'not_found' };
}

/**
 * Watches for clicks on the site's "apply" buttons and tells the extension, which then offers
 * to add the vacancy to the CareerOS tracker (the user confirms; nothing is added silently).
 * Installed once per page while the side panel reads it.
 */
export function installApplyWatcher(): void {
  const w = window as unknown as { __careerosApplyWatcher?: boolean };
  if (w.__careerosApplyWatcher) return;
  w.__careerosApplyWatcher = true;

  const APPLY = /відгукнутис|надіслати відгук|відправити відгук|откликнуться|отправить отклик|подати заявку|надіслати резюме|відправити резюме|^apply|send application|submit application/i;
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest('button, a, input[type="submit"], [role="button"]');
      if (!el) return;
      // Djinni: "Відгукнутися" only opens the form; the real application is "Надіслати відгук" (#job_apply).
      if (el.matches('.js-inbox-toggle-reply-form')) return;
      const text = ((el as HTMLElement).innerText || (el as HTMLInputElement).value || '').trim();
      if (el.id !== 'job_apply' && !APPLY.test(text)) return;
      try {
        void chrome.runtime.sendMessage({ type: 'careeros:apply', url: location.href });
      } catch {
        // the extension was reloaded or removed: ignore
      }
    },
    true,
  );
}
