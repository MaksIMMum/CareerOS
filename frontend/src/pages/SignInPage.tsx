import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { signIn } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';

export const SignInPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isConfigured, onPostLogin } = useAuth();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isConfirmed = searchParams.get('confirmed') === 'true';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isConfigured) {
      setError('AWS Cognito is not configured.');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn({
        username: email.trim(),
        password,
      });

      if (res.isSignedIn) {
        // Synchronize user profile in DynamoDB and log SIGNUP / session
        await onPostLogin();

        const from = (location.state as any)?.from?.pathname || '/app';
        navigate(from, { replace: true });
      } else if (res.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        navigate(`/confirm?email=${encodeURIComponent(email.trim())}`);
      } else {
        setError(`Unexpected authentication step: ${res.nextStep.signInStep}`);
      }
    } catch (err: any) {
      console.error('Sign in error', err);
      if (err.name === 'UserNotFoundException' || err.name === 'NotAuthorizedException') {
        setError(t('auth.errors.incorrectPassword'));
      } else if (err.name === 'UserNotConfirmedException') {
        navigate(`/confirm?email=${encodeURIComponent(email.trim())}`);
      } else {
        setError(err.message || t('auth.errors.general'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {t('auth.signInTitle')}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t('auth.noAccountPrompt')}{' '}
            <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-500">
              {t('auth.signUpLink')}
            </Link>
          </p>
        </div>

        {isConfirmed && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg">
            {t('auth.confirmDesc')}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.emailLabel')}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">
                {t('auth.passwordLabel')}
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-blue-600 hover:text-blue-500"
              >
                {t('auth.forgotPasswordLink')}
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors mt-2"
          >
            {loading ? t('common.loading') : t('auth.signInBtn')}
          </button>
        </form>
      </div>
    </div>
  );
};
