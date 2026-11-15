import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resources } from './i18n.js';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'locales' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [p] : [];
  });
}

describe('i18n resources', () => {
  const ukKeys = keys(resources.uk.translation);

  it('has exactly the same keys in uk and en', () => {
    expect(keys(resources.en.translation).sort()).toEqual([...ukKeys].sort());
  });

  it('has a translation for every literal t("…") key used in the source', () => {
    const used = new Set<string>();
    for (const file of sourceFiles(join(__dirname))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(50);
    const missing = [...used].filter((k) => !ukKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('has a translation for every auth error key used by authErrorKey', () => {
    for (const k of ['expiredCode', 'limitExceeded', 'codeDelivery', 'network', 'notConfigured', 'passwordMismatch']) {
      expect(ukKeys).toContain(`auth.errors.${k}`);
    }
  });
});
