import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  captureSourceParam,
  getStoredSource,
  clearStoredSource,
  setSourceAnswer,
  getSourceAnswer,
} from './source.js';

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

  it('keeps the ?src= value and the sign-up answer separately', () => {
    vi.stubGlobal('window', { location: { search: '?src=poster' } });
    captureSourceParam();
    setSourceAnswer('telegram');

    expect(getStoredSource()).toBe('poster');
    expect(getSourceAnswer()).toBe('telegram');
  });

  it('clears both values after they were sent', () => {
    storage['careeros_src'] = 'poster';
    setSourceAnswer('dou');
    clearStoredSource();
    expect(getStoredSource()).toBeNull();
    expect(getSourceAnswer()).toBeNull();
  });

  it('does not throw when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => setSourceAnswer('dou')).not.toThrow();
    expect(getSourceAnswer()).toBeNull();
  });
});
