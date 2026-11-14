// Where a user came from, kept in localStorage until their first sign-in:
//  - SRC: the ?src= URL parameter (campaign tag, e.g. ?src=poster from a QR code)
//  - ANSWER: the optional sign-up answer to "Where did you hear about CareerOS?"
// Both are sent to POST /me after the first sign-in and then cleared.
const SRC_STORAGE_KEY = 'careeros_src';
const ANSWER_STORAGE_KEY = 'careeros_source_answer';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Ignore environments where localStorage is unavailable (private mode, blocked storage)
  }
}

export function captureSourceParam(): void {
  try {
    const src = new URLSearchParams(window.location.search).get('src')?.trim();
    if (src) write(SRC_STORAGE_KEY, src.slice(0, 64));
  } catch {
    // Ignore
  }
}

export function getStoredSource(): string | null {
  return read(SRC_STORAGE_KEY);
}

export function setSourceAnswer(answer: string): void {
  write(ANSWER_STORAGE_KEY, answer || null);
}

export function getSourceAnswer(): string | null {
  return read(ANSWER_STORAGE_KEY);
}

export function clearStoredSource(): void {
  write(SRC_STORAGE_KEY, null);
  write(ANSWER_STORAGE_KEY, null);
}
