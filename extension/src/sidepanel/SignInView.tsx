import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { signIn } from 'aws-amplify/auth';
import { authErrorKey } from '../../../frontend/src/lib/authErrors.js';
import { ErrorAlert, PasswordInput } from '../../../frontend/src/components/ui.js';
import { openUrl } from '../chromeApi.js';
import { siteLink } from './siteUrl.js';

/** Email + password sign-in with the website's Cognito accounts. Sign-up stays on the website. */
export const SignInView: React.FC<{ onSignedIn: () => void }> = ({ onSignedIn }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await signIn({ username: email.trim(), password });
      if (res.isSignedIn) onSignedIn();
      else setError(t('ext.finishOnSite'));
    } catch (err) {
      setError((err as { name?: string })?.name === 'UserNotConfirmedException' ? t('ext.finishOnSite') : t(authErrorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card shadow-lift space-y-4">
      <div>
        <h1 className="font-display font-extrabold text-[22px] leading-tight mb-1">{t('auth.signInTitle')}</h1>
        <p className="text-[15px] text-ink-muted">{t('ext.signInLead')}</p>
      </div>
      {error && <ErrorAlert>{error}</ErrorAlert>}
      <div>
        <label htmlFor="email" className="lbl">{t('auth.emailLabel')}</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} className="field" />
      </div>
      <div>
        <label htmlFor="password" className="lbl">{t('auth.passwordLabel')}</label>
        <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button type="submit" disabled={busy || !email.trim() || !password} className="btn-primary w-full">
        {busy ? t('common.loading') : t('auth.signInBtn')}
      </button>
      <div className="flex flex-col gap-1 text-[14px]">
        <button type="button" onClick={() => openUrl(siteLink('/forgot-password'))} className="link text-left">{t('ext.forgot')}</button>
        <p className="text-ink-muted">
          {t('ext.noAccount')}{' '}
          <button type="button" onClick={() => openUrl(siteLink('/signup'))} className="link">{t('ext.createAccount')}</button>
        </p>
      </div>
    </form>
  );
};
