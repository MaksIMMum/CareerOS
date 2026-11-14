import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { getStoredSource } from '../lib/source.js';

export const SignUpPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [source, setSource] = useState(getStoredSource() || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!consent) {
      setError(t('auth.errors.consentRequired'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.errors.passwordLength'));
      return;
    }

    if (!isConfigured) {
      setError('AWS Cognito is not configured. Please deploy the stack or check .env.production.');
      return;
    }

    setLoading(true);
    try {
      await signUp({
        username: email.trim(),
        password,
        options: {
          userAttributes: {
            email: email.trim(),
          },
        },
      });

      // Save selected source temporarily for post-login sync
      if (source) {
        try {
          localStorage.setItem('careeros_src', source);
        } catch {
          // ignore
        }
      }

      navigate(`/confirm?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      console.error('Sign up error', err);
      if (err.name === 'UsernameExistsException') {
        setError(t('auth.errors.userExists'));
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
            {t('auth.signUpTitle')}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t('auth.hasAccountPrompt')}{' '}
            <Link to="/signin" className="font-semibold text-blue-600 hover:text-blue-500">
              {t('auth.signInLink')}
            </Link>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.emailLabel')} <span className="text-red-500">*</span>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.passwordLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPlaceholder')}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">{t('auth.passwordHint')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.sourceLabel')}
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white"
            >
              <option value="">{t('auth.sourcePlaceholder')}</option>
              <option value="university_chat">{t('auth.sourceOptions.university_chat')}</option>
              <option value="poster">{t('auth.sourceOptions.poster')}</option>
              <option value="dou">{t('auth.sourceOptions.dou')}</option>
              <option value="telegram">{t('auth.sourceOptions.telegram')}</option>
              <option value="linkedin">{t('auth.sourceOptions.linkedin')}</option>
              <option value="friend">{t('auth.sourceOptions.friend')}</option>
              <option value="other">{t('auth.sourceOptions.other')}</option>
            </select>
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-600 leading-snug">
                {t('auth.consentLabel')} <span className="text-red-500">*</span>
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors mt-4"
          >
            {loading ? t('common.loading') : t('auth.createAccountBtn')}
          </button>
        </form>
      </div>
    </div>
  );
};
