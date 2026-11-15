import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { authErrorKey } from '../lib/authErrors.js';
import { AuthCentered } from '../components/AuthLayout.js';
import { ErrorAlert, Icon, PasswordInput } from '../components/ui.js';

const titleCls = 'mb-2 font-display font-extrabold text-[28px] sm:text-[30px] leading-[1.15] tracking-[-0.02em]';

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

  return (
    <AuthCentered>
      <div className="flex flex-col gap-4">
        <Link to="/signin" className="self-start inline-flex items-center gap-1.5 min-h-[44px] text-[15px] text-accent no-underline hover:text-accent-hover">
          <Icon.arrowLeft className="w-4 h-4" /> {t('auth.backToSignIn')}
        </Link>

        {step === 'request' ? (
          <form onSubmit={handleRequestCode} className="bg-white border border-line rounded-[20px] p-6 sm:p-9">
            <p className="eyebrow mb-2">{t('auth.resetStep1')}</p>
            <h1 className={titleCls}>{t('auth.resetTitle')}</h1>
            <p className="mb-7 text-base text-ink-soft">{t('auth.resetDesc')}</p>
            {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}
            <div className="mb-7">
              <label className="lbl" htmlFor="email">{t('auth.emailLabel')}</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} className="field" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
              {loading ? t('common.loading') : t('auth.sendResetCodeBtn')}
            </button>
          </form>
        ) : (
          <>
            <section className="bg-white border border-line rounded-2xl px-5 sm:px-6 py-4 sm:py-5 flex items-center gap-3.5">
              <span className="shrink-0 w-7 h-7 rounded-full bg-accent-chip text-accent-ink flex items-center justify-center">
                <Icon.check className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold leading-snug">{t('auth.resetCodeSent')}</p>
                <p className="mt-0.5 text-sm text-ink-muted truncate">{email}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep('request');
                }}
                className="btn-ghost px-3 text-sm"
              >
                {t('auth.change')}
              </button>
            </section>

            <form onSubmit={handleConfirmReset} className="bg-white border border-line rounded-[20px] p-6 sm:p-9">
              <p className="eyebrow mb-2">{t('auth.resetStep2')}</p>
              <h1 className={titleCls}>{t('auth.newPasswordTitle')}</h1>
              <p className="mb-7 text-base text-ink-soft">{t('auth.newPasswordLead')}</p>
              {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}
              <div className="mb-5">
                <label className="lbl" htmlFor="code">{t('auth.codeFromEmail')}</label>
                <input id="code" required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} className="field font-mono tracking-[0.2em]" />
              </div>
              <div className="mb-5">
                <label className="lbl" htmlFor="p1">{t('auth.newPasswordLabel')}</label>
                <PasswordInput id="p1" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <p className="hint">{t('auth.passwordHint')}</p>
              </div>
              <div className="mb-7">
                <label className="lbl" htmlFor="p2">{t('auth.repeatPasswordLabel')}</label>
                <PasswordInput id="p2" required autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} invalid={repeat !== '' && repeat !== newPassword} />
              </div>
              <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
                {loading ? t('common.loading') : t('auth.resetPasswordBtn')}
              </button>
            </form>
          </>
        )}
      </div>
    </AuthCentered>
  );
};
