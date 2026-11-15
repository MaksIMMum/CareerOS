import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUp } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { setSourceAnswer } from '../lib/source.js';
import { authErrorKey } from '../lib/authErrors.js';
import { AuthSplit, SignUpAside } from '../components/AuthLayout.js';
import { ErrorAlert, Icon, PasswordChecklist, PasswordInput, useCountUp } from '../components/ui.js';

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
  const score = useCountUp(52, 79);

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
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  return (
    <AuthSplit aside={<SignUpAside score={score} />}>
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3 mb-7">
          <div className="flex-1 flex gap-1.5" aria-hidden="true">
            <span className="flex-1 h-1.5 rounded-full bg-accent" />
            <span className="flex-1 h-1.5 rounded-full bg-line-strong" />
            <span className="flex-1 h-1.5 rounded-full bg-line-strong" />
          </div>
          <span className="font-mono text-[13px] font-semibold text-ink-soft">{t('auth.stepOf', { n: 1 })}</span>
        </div>
        <h1 className="mb-2.5 font-display font-extrabold text-[34px] sm:text-[42px] leading-[1.05] tracking-[-0.035em]">
          {t('auth.signUpTitleA')}
          <br />
          {t('auth.signUpTitleB')}
        </h1>
        <p className="mb-8 text-[17px] text-ink-soft">{t('auth.signUpLead')}</p>

        {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}

        <div className="mb-5">
          <label className="lbl" htmlFor="email">{t('auth.emailLabel')}</label>
          <div className="relative">
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} className={`field pr-12 ${emailOk ? 'border-accent-border' : ''}`} />
            {emailOk && (
              <span aria-hidden="true" className="absolute right-3.5 top-[15px] w-6 h-6 rounded-full bg-accent-chip text-accent-ink flex items-center justify-center">
                <Icon.check className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        </div>

        <div className="mb-5">
          <label className="lbl" htmlFor="password">{t('auth.passwordLabel')}</label>
          <PasswordInput id="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordChecklist password={password} />
        </div>

        <fieldset className="mb-6 border-0 p-0 m-0 min-w-0">
          <legend className="lbl p-0">
            {t('auth.sourceLabel')} <span className="lbl-optional">{t('common.optional')}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => {
              const on = source === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSource(on ? '' : s)}
                  className={`min-h-[44px] px-4 rounded-full border-[1.5px] text-sm font-semibold ${on ? 'bg-ink border-ink text-white' : 'bg-white border-line-strong text-ink-2 hover:bg-canvas'}`}
                >
                  {t(`auth.sourceOptions.${s}`)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className={`flex gap-3 items-start p-4 mb-5 border-[1.5px] rounded-[14px] cursor-pointer ${consent ? 'border-accent bg-accent-wash' : 'border-line-strong bg-white'}`}>
          <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="shrink-0 w-[22px] h-[22px] mt-px accent-accent" />
          <span className="text-sm leading-normal text-ink-2">{t('auth.consentLabel')}</span>
        </label>

        <button type="submit" disabled={loading || !consent} className="btn-primary btn-lg w-full">
          {loading ? t('common.loading') : t('auth.createAccountBtn')}
          {!loading && <Icon.arrowRight className="w-[18px] h-[18px]" />}
        </button>
        {!consent && <p className="mt-2.5 text-center text-[13px] text-ink-muted">{t('auth.consentNeeded')}</p>}

        <p className="mt-6 text-center text-[15px] text-ink-soft">
          {t('auth.hasAccountPrompt')} <Link to="/signin" className="link font-bold">{t('auth.signInLink')}</Link>
        </p>
      </form>
    </AuthSplit>
  );
};
