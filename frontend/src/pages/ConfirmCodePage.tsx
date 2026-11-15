import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { authErrorKey } from '../lib/authErrors.js';
import { AuthBlue } from '../components/AuthLayout.js';
import { CodeInput } from '../components/CodeInput.js';
import { ErrorAlert, LangSwitch, OkAlert } from '../components/ui.js';

const RESEND_COOLDOWN_S = 45;
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
  // Arriving from sign-up means a code was just sent, so wait before offering another.
  const [cooldown, setCooldown] = useState(emailFromLink ? RESEND_COOLDOWN_S : 0);

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
    <AuthBlue
      topRight={
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline font-mono text-[13px] font-semibold text-accent-on">{t('auth.stepOf', { n: 2 })}</span>
          <LangSwitch onBlue compact />
        </div>
      }
    >
      <form onSubmit={handleConfirm} className="bg-white rounded-[28px] px-5 pb-8 pt-2 sm:px-10 sm:pb-11 text-center shadow-deep">
        <svg width="120" height="104" viewBox="0 0 120 104" aria-hidden="true" className="block mx-auto -mt-[84px] mb-5">
          <rect x="10" y="38" width="100" height="62" rx="10" fill="#111318" />
          <g className="animate-letter">
            <rect x="24" y="14" width="72" height="56" rx="6" fill="#fff" stroke="#E3E5EA" strokeWidth="2" />
            <rect x="34" y="26" width="34" height="5" rx="2.5" fill="#2346D8" />
            <rect x="34" y="37" width="48" height="4" rx="2" fill="#E3E5EA" />
            <rect x="34" y="46" width="40" height="4" rx="2" fill="#E3E5EA" />
          </g>
          <path d="M10 48l50 30 50-30v42a10 10 0 0 1-10 10H20a10 10 0 0 1-10-10z" fill="#23262E" />
          <circle cx="8" cy="20" r="5" fill="#FFD84D" className="animate-blink" />
          <circle cx="112" cy="14" r="4" fill="#FFD84D" className="animate-blink [animation-delay:.8s]" />
          <circle cx="104" cy="40" r="3" fill="#FFD84D" className="animate-blink [animation-delay:1.6s]" />
        </svg>
        <h1 className="mb-2.5 font-display font-extrabold text-[28px] sm:text-[32px] leading-[1.1] tracking-[-0.03em]">{t('auth.confirmTitle')}</h1>

        {emailFromLink ? (
          <p className="mb-7 text-base leading-normal text-ink-soft">
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

        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-1 mt-5 text-[15px]">
          {cooldown > 0 ? (
            <span className="text-ink-muted min-h-[44px] inline-flex items-center">
              {t('auth.resendIn', { time: '' })}
              <span className="ml-1 font-mono text-ink">{mmss(cooldown)}</span>
            </span>
          ) : (
            <button type="button" onClick={() => void handleResend()} disabled={resending} className="min-h-[44px] px-1 font-bold text-accent hover:text-accent-hover">
              {resending ? t('common.loading') : t('auth.resendBtn')}
            </button>
          )}
          <Link to="/signup" className="link min-h-[44px] inline-flex items-center">{t('auth.changeEmail')}</Link>
        </div>
      </form>
    </AuthBlue>
  );
};
