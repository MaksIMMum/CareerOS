import { describe, expect, it } from 'vitest';
import { buildManifest } from '../manifest.js';

describe('buildManifest', () => {
  it('adds the API host to host_permissions and keeps the job sites', () => {
    const m = buildManifest('https://abc123.execute-api.us-east-1.amazonaws.com');
    expect(m.host_permissions).toEqual([
      'https://djinni.co/*',
      'https://jobs.dou.ua/*',
      'https://www.work.ua/*',
      'https://work.ua/*',
      'https://abc123.execute-api.us-east-1.amazonaws.com/*',
    ]);
    expect(m.manifest_version).toBe(3);
    expect(m.side_panel.default_path).toBe('sidepanel.html');
  });

  it('keeps the development key, and drops it in the store package', () => {
    expect(buildManifest(undefined).key).toMatch(/^MIIB/);
    expect(buildManifest('https://a.example.com', { store: true })).not.toHaveProperty('key');
  });

  it('is localised (uk default) and versioned', () => {
    const m = buildManifest(undefined);
    expect(m.name).toBe('__MSG_extName__');
    expect(m.default_locale).toBe('uk');
    expect(m.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('builds without an API url (CI) and refuses plain http', () => {
    expect(buildManifest(undefined).host_permissions).toHaveLength(4);
    expect(() => buildManifest('http://example.com')).toThrow();
  });
});
