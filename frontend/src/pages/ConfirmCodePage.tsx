import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { authErrorKey } from '../lib/authErrors.js';
import { AuthCentered } from '../components/AuthLayout.js';
import { CodeInput } from '../components/CodeInput.js';
import { ErrorAlert, Icon, OkAlert } from '../components/ui.js';

const RESEND_COOLDOWN_S = 60;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const ConfirmCodePage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isConfigured } = useAuth();

  const emailFromLink = searchParams.get('email') || '';
  const [email, setEmail] = useState(emailFromLink);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!isConfigured) {
      setError(t('auth.errors.notConfigured'));
      return;
    }

    setLoading(true);
    try {
      await confirmSignUp({
        username: email.trim(),
        confirmationCode: code.trim(),
      });
      navigate(`/signin?confirmed=true&email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      console.error('Confirm code error', err);
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setSuccessMsg(null);

    if (!email) {
      setError(t('common.required'));
      return;
    }

    setResending(true);
    try {
      await resendSignUpCode({ username: email.trim() });
      setSuccessMsg(t('auth.resendSuccess'));
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err: any) {
      console.error('Resend error', err);
      setError(t(authErrorKey(err)));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCentered>
      <form onSubmit={handleConfirm} className="bg-white border border-line rounded-[20px] p-6 sm:p-10 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-accent-soft flex items-center justify-center text-accent">
          <Icon.mail className="w-8 h-8" />
        </div>
        <h1 className="mb-2.5 font-display font-extrabold text-[28px] sm:text-[30px] leading-[1.15] tracking-[-0.02em]">{t('auth.confirmTitle')}</h1>

        {emailFromLink ? (
          <p className="mb-8 text-base leading-normal text-ink-soft">
            {t('auth.confirmSentTo')}
            <br />
            <strong className="text-ink break-all">{emailFromLink}</strong>
          </p>
        ) : (
          <>
            <p className="mb-6 text-base leading-normal text-ink-soft">{t('auth.confirmDesc')}</p>
            <div className="mb-5 text-left">
              <label className="lbl" htmlFor="email">{t('auth.emailLabel')}</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} className="field" />
            </div>
          </>
        )}

        {error && <ErrorAlert className="mb-5 text-left">{error}</ErrorAlert>}
        {successMsg && <OkAlert className="mb-5 text-left">{successMsg}</OkAlert>}

        <div className="mb-3">
          <CodeInput value={code} onChange={setCode} legend={t('auth.codeLabel')} />
        </div>
        <p className="mb-7 text-[13px] text-ink-muted">{t('auth.codeHint')}</p>

        <button type="submit" disabled={loading || code.length !== 6} className="btn-primary btn-lg w-full">
          {loading ? t('common.loading') : t('auth.confirmBtn')}
        </button>

        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-1 mt-4 text-[15px]">
          {cooldown > 0 ? (
            <span className="text-ink-muted min-h-[44px] inline-flex items-center">
              {t('auth.resendIn', { time: mmss(cooldown) })}
            </span>
          ) : (
            <button type="button" onClick={() => void handleResend()} disabled={resending} className="btn-ghost px-2">
              {resending ? t('common.loading') : t('auth.resendBtn')}
            </button>
          )}
          <Link to="/signup" className="link min-h-[44px] inline-flex items-center">{t('auth.changeEmail')}</Link>
        </div>
      </form>
    </AuthCentered>
  );
};
