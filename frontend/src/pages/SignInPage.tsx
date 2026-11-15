import React, { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { signIn } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { authErrorKey } from '../lib/authErrors.js';
import { AuthSplit, SignInAside } from '../components/AuthLayout.js';
import { ErrorAlert, Icon, OkAlert, PasswordInput } from '../components/ui.js';

export const SignInPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isConfigured, onPostLogin, user, isLoading } = useAuth();

  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [badCredentials, setBadCredentials] = useState(false);
  const [loading, setLoading] = useState(false);

  const isConfirmed = searchParams.get('confirmed') === 'true';
  const isReset = searchParams.get('reset') === 'true';
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/app';

  const finishSignIn = async () => {
    // Synchronize user profile in DynamoDB (creates it + logs SIGNUP on the first sign-in)
    await onPostLogin();
    navigate(from, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBadCredentials(false);

    if (!isConfigured) {
      setError(t('auth.errors.notConfigured'));
      return;
    }

    setLoading(true);
    try {
      const res = await signIn({
        username: email.trim(),
        password,
      });

      if (res.isSignedIn) {
        await finishSignIn();
      } else if (res.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        navigate(`/confirm?email=${encodeURIComponent(email.trim())}`);
      } else {
        console.error('Unsupported sign-in step', res.nextStep.signInStep);
        setError(t('auth.errors.general'));
      }
    } catch (err: any) {
      console.error('Sign in error', err);
      if (err.name === 'UserAlreadyAuthenticatedException') {
        // A session already exists in this browser (e.g. another tab): just continue.
        await finishSignIn();
      } else if (err.name === 'UserNotFoundException' || err.name === 'NotAuthorizedException') {
        setError(t('auth.errors.incorrectPassword'));
        setBadCredentials(true);
      } else if (err.name === 'UserNotConfirmedException') {
        navigate(`/confirm?email=${encodeURIComponent(email.trim())}`);
      } else {
        setError(t(authErrorKey(err)));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isLoading && user) {
    return <Navigate to={from} replace />;
  }

  const hour = new Date().getHours();
  const greeting = t(`auth.greeting.${hour < 12 ? 'morning' : hour < 18 ? 'day' : 'evening'}`);

  return (
    <AuthSplit aside={<SignInAside />}>
      <form onSubmit={handleSubmit}>
        <p className="mb-4 inline-flex items-center gap-2 px-3 py-[7px] rounded-full bg-sun-wash text-sun-badge text-[13px] font-semibold leading-none">
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {greeting}
        </p>
        <h1 className="mb-2.5 font-display font-extrabold text-[36px] sm:text-[44px] leading-[1.05] tracking-[-0.035em]">{t('auth.signInTitle')}</h1>
        <p className="mb-7 text-[17px] text-ink-soft">{t('auth.signInLead')}</p>

        {(isConfirmed || isReset) && !error && (
          <OkAlert className="mb-6">{isReset ? t('auth.resetSuccess') : t('auth.confirmedNotice')}</OkAlert>
        )}
        {error && (
          <ErrorAlert className="mb-6">
            {error}
            {badCredentials && (
              <>
                {' '}
                <Link to="/forgot-password" className="font-bold text-warn-ink underline">{t('auth.forgotPasswordLink')}</Link>
              </>
            )}
          </ErrorAlert>
        )}

        <div className="mb-5">
          <label className="lbl" htmlFor="email">{t('auth.emailLabel')}</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} className="field" />
        </div>
        <div className="mb-7">
          <div className="flex justify-between items-baseline gap-3">
            <label className="lbl" htmlFor="password">{t('auth.passwordLabel')}</label>
            <Link to="/forgot-password" className="text-sm link">{t('auth.forgotPasswordLink')}</Link>
          </div>
          <PasswordInput id="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={badCredentials} />
        </div>

        <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
          {loading ? t('common.loading') : t('auth.signInBtn')}
          {!loading && <Icon.arrowRight className="w-[18px] h-[18px]" />}
        </button>

        <div className="flex items-center gap-3.5 my-7 text-[13px] text-ink-muted">
          <span className="flex-1 h-px bg-line" />
          {t('auth.firstTime')}
          <span className="flex-1 h-px bg-line" />
        </div>
        <Link to="/signup" className="btn-outline w-full min-h-[54px] rounded-[14px] text-base">
          {t('auth.createFreeAccount')}
        </Link>
      </form>
    </AuthSplit>
  );
};
