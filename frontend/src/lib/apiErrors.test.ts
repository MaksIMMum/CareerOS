import { describe, expect, it } from 'vitest';
import i18n from '../i18n.js';
import { ApiError } from './api.js';
import { apiErrorMessage } from './apiErrors.js';

describe('apiErrorMessage', () => {
  it('shows the translated friendly quota message with the limit', async () => {
    const err = new ApiError('quota_exceeded', 429, 'quota_exceeded', { kind: 'interview', limit: 5 });
    await i18n.changeLanguage('en');
    expect(apiErrorMessage(err, i18n.t)).toContain('5');
    expect(apiErrorMessage(err, i18n.t)).toMatch(/mock interviews/);
    await i18n.changeLanguage('uk');
    expect(apiErrorMessage(err, i18n.t)).toMatch(/мок-інтерв/);
  });

  it('maps validation, limit and network errors', async () => {
    await i18n.changeLanguage('en');
    expect(apiErrorMessage(new ApiError('x', 400, 'validation_error'), i18n.t)).toBe(i18n.t('errors.validation'));
    expect(
      apiErrorMessage(new ApiError('x', 409, 'limit_reached', { details: { max: 20 } }), i18n.t),
    ).toContain('20');
    expect(apiErrorMessage(new TypeError('Failed to fetch'), i18n.t)).toBe(i18n.t('auth.errors.network'));
    expect(apiErrorMessage(new Error('?'), i18n.t)).toBe(i18n.t('errors.generic'));
  });
});
