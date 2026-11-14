import { describe, expect, it } from 'vitest';
import { authErrorKey } from './authErrors.js';

const named = (name: string) => Object.assign(new Error('raw sdk message'), { name });

describe('authErrorKey', () => {
  it('maps known Cognito errors to translation keys', () => {
    expect(authErrorKey(named('CodeMismatchException'))).toBe('auth.errors.codeMismatch');
    expect(authErrorKey(named('LimitExceededException'))).toBe('auth.errors.limitExceeded');
    expect(authErrorKey(named('NotAuthorizedException'))).toBe('auth.errors.incorrectPassword');
  });

  it('falls back to the generic message instead of the raw SDK text', () => {
    expect(authErrorKey(named('SomethingNewException'))).toBe('auth.errors.general');
    expect(authErrorKey(undefined)).toBe('auth.errors.general');
  });
});
