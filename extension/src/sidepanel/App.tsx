import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { isAuthConfigured } from '../../../frontend/src/lib/auth.js';
import { setUnauthorizedHandler } from '../../../frontend/src/lib/api.js';
import { ErrorAlert, LangSwitch, LogoMark } from '../../../frontend/src/components/ui.js';
import { clearSavedAnalyses, openUrl } from '../chromeApi.js';
import { siteLink } from './siteUrl.js';
import { SignInView } from './SignInView.js';
import { VacancyView } from './VacancyView.js';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut'; expired?: boolean }
  | { status: 'signedIn'; email: string };

export const App: React.FC = () => {
  const { t } = useTranslation();
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });
  const [menuOpen, setMenuOpen] = useState(false);

  const checkUser = async () => {
    try {
      const user = await getCurrentUser();
      setAuth({ status: 'signedIn', email: user.signInDetails?.loginId ?? user.username });
    } catch {
      setAuth({ status: 'signedOut' });
    }
  };

  useEffect(() => {
    void checkUser();
    // The session expired or was revoked (e.g. the account was deleted on the website): sign in again.
    setUnauthorizedHandler(() => {
      void signOut().catch(() => undefined);
      setAuth({ status: 'signedOut', expired: true });
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const doSignOut = async () => {
    setMenuOpen(false);
    await signOut().catch(() => undefined);
    await clearSavedAnalyses().catch(() => undefined);
    setAuth({ status: 'signedOut' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <header className="sticky top-0 z-10 bg-accent text-white px-4 py-2.5 flex items-center gap-2.5">
        <LogoMark size={26} light />
        <div className="min-w-0 flex-1">
          <p className="font-display font-extrabold text-[17px] leading-tight">CareerOS</p>
          <p className="text-[12px] text-accent-on leading-tight truncate">{t('ext.tagline')}</p>
        </div>
        <LangSwitch compact onBlue />
        {auth.status === 'signedIn' && (
          <div className="relative">
            <button
              type="button"
              aria-label={t('ext.menu')}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-white/10"
            >
              <span className="w-7 h-7 rounded-full bg-sun text-ink font-display font-extrabold text-sm flex items-center justify-center">
                {auth.email.charAt(0).toUpperCase()}
              </span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white text-ink shadow-lift border border-line p-1.5">
                <p className="px-3 py-2 text-[13px] text-ink-muted break-all">{auth.email}</p>
                <button type="button" onClick={() => openUrl(siteLink('/app'))} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-canvas text-[15px]">
                  {t('ext.openSite')}
                </button>
                <button type="button" onClick={() => void doSignOut()} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-canvas text-[15px]">
                  {t('nav.signOut')}
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 p-3 flex flex-col gap-3">
        {!isAuthConfigured ? (
          <ErrorAlert>{t('auth.errors.notConfigured')}</ErrorAlert>
        ) : auth.status === 'loading' ? (
          <p className="p-4 text-sm text-ink-muted">{t('common.loading')}</p>
        ) : auth.status === 'signedOut' ? (
          <SignInView expired={auth.expired} onSignedIn={() => void checkUser()} />
        ) : (
          <VacancyView />
        )}
      </main>
    </div>
  );
};
