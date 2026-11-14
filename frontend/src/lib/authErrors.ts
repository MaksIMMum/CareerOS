// Maps Amplify/Cognito error names to i18n keys, so users never see raw English SDK messages.
const ERROR_KEYS: Record<string, string> = {
  UsernameExistsException: 'auth.errors.userExists',
  UserNotFoundException: 'auth.errors.userNotFound',
  NotAuthorizedException: 'auth.errors.incorrectPassword',
  CodeMismatchException: 'auth.errors.codeMismatch',
  ExpiredCodeException: 'auth.errors.expiredCode',
  InvalidPasswordException: 'auth.errors.passwordLength',
  LimitExceededException: 'auth.errors.limitExceeded',
  TooManyRequestsException: 'auth.errors.limitExceeded',
  TooManyFailedAttemptsException: 'auth.errors.limitExceeded',
  CodeDeliveryFailureException: 'auth.errors.codeDelivery',
  NetworkError: 'auth.errors.network',
};

export function authErrorKey(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? '';
  return ERROR_KEYS[name] ?? 'auth.errors.general';
}
