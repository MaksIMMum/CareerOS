import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { setSourceAnswer } from '../lib/source.js';
import { authErrorKey } from '../lib/authErrors.js';
import { AuthSplit } from '../components/AuthLayout.js';
import { ErrorAlert, PasswordInput, StrengthBar } from '../components/ui.js';

export const SignUpPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [source, setSource] = useState('');
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
      setError(t('auth.errors.notConfigured'));
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

      // Kept until the first sign-in, then sent to POST /me together with the ?src= tag.
      setSourceAnswer(source);

      navigate(`/confirm?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      console.error('Sign up error', err);
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  };

  const sources = ['university_chat', 'poster', 'dou', 'telegram', 'linkedin', 'friend', 'other'] as const;

  return (
    <AuthSplit asideTitle={t('auth.aside.signUpTitle')}>
      <form onSubmit={handleSubmit} noValidate={false}>
        <h1 className="mb-2 font-display font-extrabold text-[32px] sm:text-[36px] leading-[1.1] tracking-[-0.03em]">{t('auth.signUpTitle')}</h1>
        <p className="mb-8 text-base text-ink-soft">{t('auth.signUpLead')}</p>

        {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}

        <div className="mb-5">
          <label className="lbl" htmlFor="email">{t('auth.emailLabel')}</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} className="field" />
        </div>

        <div className="mb-5">
          <label className="lbl" htmlFor="password">{t('auth.passwordLabel')}</label>
          <PasswordInput id="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="pw-hint" />
          <StrengthBar password={password} />
          <p id="pw-hint" className="hint">{t('auth.passwordHint')}</p>
        </div>

        <div className="mb-6">
          <label className="lbl" htmlFor="source">
            {t('auth.sourceLabel')} <span className="lbl-optional">{t('common.optional')}</span>
          </label>
          <select id="source" value={source} onChange={(e) => setSource(e.target.value)} className="field appearance-auto">
            <option value="">{t('auth.sourcePlaceholder')}</option>
            {sources.map((s) => (
              <option key={s} value={s}>{t(`auth.sourceOptions.${s}`)}</option>
            ))}
          </select>
        </div>

        <label className="flex gap-3 items-start p-4 mb-6 border border-line-strong rounded-xl bg-white cursor-pointer">
          <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="shrink-0 w-5 h-5 mt-0.5 accent-accent" />
          <span className="text-sm leading-normal text-ink-2">{t('auth.consentLabel')}</span>
        </label>

        <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
          {loading ? t('common.loading') : t('auth.createAccountBtn')}
        </button>
        <p className="mt-6 text-center text-[15px] text-ink-soft">
          {t('auth.hasAccountPrompt')} <Link to="/signin" className="link">{t('auth.signInLink')}</Link>
        </p>
      </form>
    </AuthSplit>
  );
};
