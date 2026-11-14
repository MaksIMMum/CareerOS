import { describe, expect, it } from 'vitest';
import { resources } from './i18n.js';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n resources', () => {
  it('has exactly the same keys in uk and en', () => {
    expect(keys(resources.en.translation).sort()).toEqual(keys(resources.uk.translation).sort());
  });

  it('has a translation for every auth error key used by authErrorKey', async () => {
    const errorKeys = keys(resources.uk.translation.auth.errors).map((k) => `auth.errors.${k}`);
    for (const k of [
      'auth.errors.expiredCode',
      'auth.errors.limitExceeded',
      'auth.errors.codeDelivery',
      'auth.errors.network',
      'auth.errors.notConfigured',
    ]) {
      expect(errorKeys).toContain(k);
    }
  });
});
