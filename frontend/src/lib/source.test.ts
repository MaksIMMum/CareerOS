import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureSourceParam, getStoredSource, clearStoredSource } from './source.js';

describe('source tracking', () => {
  let storage: Record<string, string> = {};

  beforeEach(() => {
    storage = {};
    const mockStorage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
      clear: () => {
        storage = {};
      },
    };

    vi.stubGlobal('localStorage', mockStorage);
    vi.restoreAllMocks();
  });

  it('captures ?src parameter into localStorage', () => {
    vi.stubGlobal('window', {
      location: { search: '?src=poster' },
    });

    captureSourceParam();
    expect(getStoredSource()).toBe('poster');
  });

  it('leaves stored source untouched if no ?src is in URL', () => {
    vi.stubGlobal('window', {
      location: { search: '' },
    });

    captureSourceParam();
    expect(getStoredSource()).toBeNull();
  });

  it('clears stored source', () => {
    storage['careeros_src'] = 'telegram';
    expect(getStoredSource()).toBe('telegram');
    clearStoredSource();
    expect(getStoredSource()).toBeNull();
  });
});
