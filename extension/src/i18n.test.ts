import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resources } from '../../frontend/src/i18n.js';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(name) && !name.endsWith('.test.ts') ? [p] : [];
  });
}

describe('extension i18n', () => {
  it('has a uk and en translation for every literal t("…") key used in the extension', () => {
    const uk = keys(resources.uk.translation);
    const en = keys(resources.en.translation);
    const used = new Set<string>();
    for (const file of sourceFiles(__dirname)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) used.add(m[1]!);
    }
    expect(used.size).toBeGreaterThan(20);
    expect([...used].filter((k) => !uk.includes(k) || !en.includes(k))).toEqual([]);
  });
});
