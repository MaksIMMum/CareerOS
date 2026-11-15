import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { authErrorKey } from '../lib/authErrors.js';
import { AuthDark } from '../components/AuthLayout.js';
import { ErrorAlert, Icon, LangSwitch, PasswordInput, passwordRules } from '../components/ui.js';


export const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isConfigured } = useAuth();

  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isConfigured) {
      setError(t('auth.errors.notConfigured'));
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ username: email.trim() });
      setStep('confirm');
    } catch (err: any) {
      console.error('Reset request error', err);
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(t('auth.errors.passwordLength'));
      return;
    }
    if (newPassword !== repeat) {
      setError(t('auth.errors.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      await confirmResetPassword({
        username: email.trim(),
        confirmationCode: code.replace(/\s/g, ''),
        newPassword,
      });
      navigate(`/signin?reset=true&email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      console.error('Confirm reset error', err);
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  };

  const strong = passwordRules(newPassword).every((r) => r.ok);

  const KeyIcon = (
    <div className="w-[60px] h-[60px] rounded-[18px] bg-sun-wash flex items-center justify-center shrink-0">
      <svg viewBox="0 0 24 24" className="w-[30px] h-[30px] animate-wiggle origin-[50%_30%]" aria-hidden="true">
        <circle cx="8" cy="15" r="4.5" stroke="#111318" strokeWidth="2" fill="none" />
        <path d="M11.5 12L20 3.5M17 6.5l2.5 2.5M15 8.5l2 2" stroke="#111318" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );

  return (
    <AuthDark
      topRight={
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/signin" className="hidden sm:inline-flex items-center gap-1.5 min-h-[44px] text-[15px] text-accent-on no-underline hover:text-white">
            <Icon.arrowLeft className="w-4 h-4" /> {t('auth.backToSignIn')}
          </Link>
          <LangSwitch onBlue compact />
        </div>
      }
    >
      <div className="bg-white rounded-[28px] p-6 sm:p-10 shadow-deep">
        <div className="flex items-center gap-4 mb-6">
          {KeyIcon}
          <div>
            <p className="mb-1.5 font-mono text-[13px] font-semibold text-ink-muted">{step === 'request' ? t('auth.resetStep1') : t('auth.resetStep2')}</p>
            <h1 className="font-display font-extrabold text-[26px] sm:text-[30px] leading-[1.1] tracking-[-0.03em]">
              {step === 'request' ? t('auth.resetTitle') : t('auth.newPasswordTitle')}
            </h1>
          </div>
        </div>

        {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}

        {step === 'request' ? (
          <form onSubmit={handleRequestCode}>
            <p className="mb-6 text-base text-ink-soft">{t('auth.resetDesc')}</p>
            <div className="mb-7">
              <label className="lbl" htmlFor="email">{t('auth.emailLabel')}</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} className="field" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
              {loading ? t('common.loading') : t('auth.sendResetCodeBtn')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirmReset}>
            <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-accent-wash mb-6 text-sm text-accent-ink">
              <Icon.check className="w-[18px] h-[18px] shrink-0" />
              <span className="flex-1 min-w-0 truncate">
                {t('auth.codeSentTo')} <strong>{email}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep('request');
                }}
                className="min-h-[36px] px-1 font-semibold text-accent hover:text-accent-hover"
              >
                {t('auth.change')}
              </button>
            </div>
            <div className="mb-5">
              <label className="lbl" htmlFor="code">{t('auth.codeFromEmail')}</label>
              <input id="code" required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="field font-mono text-xl tracking-[0.25em]" />
            </div>
            <div className="mb-5">
              <label className="lbl" htmlFor="p1">{t('auth.newPasswordLabel')}</label>
              <PasswordInput id="p1" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              {strong ? (
                <p className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-accent-ink">
                  <Icon.check className="w-3.5 h-3.5" /> {t('auth.strongPassword')}
                </p>
              ) : (
                <p className="hint">{t('auth.rules.min8')}</p>
              )}
            </div>
            <div className="mb-7">
              <label className="lbl" htmlFor="p2">{t('auth.repeatPasswordLabel')}</label>
              <PasswordInput id="p2" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} invalid={repeat !== '' && repeat !== newPassword} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
              {loading ? t('common.loading') : t('auth.resetPasswordBtn')}
            </button>
          </form>
        )}
        <Link to="/signin" className="sm:hidden mt-5 flex items-center justify-center gap-1.5 min-h-[44px] text-[15px] link">
          <Icon.arrowLeft className="w-4 h-4" /> {t('auth.backToSignIn')}
        </Link>
      </div>
    </AuthDark>
  );
};
