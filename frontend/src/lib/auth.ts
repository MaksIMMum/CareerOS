import { Amplify } from 'aws-amplify';

export const userPoolId = import.meta.env.VITE_USER_POOL_ID || '';
export const userPoolClientId = import.meta.env.VITE_USER_POOL_CLIENT_ID || '';

export const isAuthConfigured = Boolean(userPoolId && userPoolClientId);

if (isAuthConfigured) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  });
}
