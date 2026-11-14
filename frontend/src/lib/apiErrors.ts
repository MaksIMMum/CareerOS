import type { TFunction } from 'i18next';
import { ApiError } from './api.js';

/** Translates an API failure into a user-facing message in the current UI language. */
export function apiErrorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'quota_exceeded': {
        const kind = err.body?.kind === 'interview' ? 'interview' : 'analysis';
        return t(`errors.quotaExceeded.${kind}`, { limit: err.body?.limit ?? '' });
      }
      case 'validation_error':
        return t('errors.validation');
      case 'limit_reached':
        return t('errors.limitReached', { max: (err.body?.details as { max?: number })?.max ?? '' });
      case 'not_found':
        return t('errors.notFound');
      case 'payload_too_large':
        return t('errors.tooLarge');
    }
    if (err.status === 401) return t('errors.sessionExpired');
  }
  if (err instanceof TypeError) return t('auth.errors.network'); // fetch() network failure
  return t('errors.generic');
}
