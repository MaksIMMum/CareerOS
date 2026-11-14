const SRC_STORAGE_KEY = 'careeros_src';

export function captureSourceParam(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const src = params.get('src');
    if (src) {
      localStorage.setItem(SRC_STORAGE_KEY, src.trim());
    }
  } catch {
    // Ignore environments where localStorage is unavailable
  }
}

export function getStoredSource(): string | null {
  try {
    return localStorage.getItem(SRC_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredSource(): void {
  try {
    localStorage.removeItem(SRC_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
