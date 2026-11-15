import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { LangSwitch, Logo } from './ui.js';

/** Header of the public landing page: anchor links, language, sign in / sign up. */
export const PublicHeader: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <header className="bg-white border-b border-line">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <Logo to="/" />
        <nav aria-label={t('nav.mainNav')} className="hidden lg:flex gap-7 text-[15px]">
          <a href="#how" className="text-ink-soft hover:text-ink no-underline">{t('nav.how')}</a>
          <a href="#features" className="text-ink-soft hover:text-ink no-underline">{t('nav.features')}</a>
          <a href="#privacy" className="text-ink-soft hover:text-ink no-underline">{t('nav.privacy')}</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitch compact />
          {user ? (
            <Link to="/app" className="btn-primary">{t('landing.ctaDashboard')}</Link>
          ) : (
            <>
              <Link to="/signin" className="btn bg-transparent text-ink hover:bg-canvas hover:text-ink px-3 sm:px-4">{t('nav.signIn')}</Link>
              <Link to="/signup" className="btn-primary hidden sm:inline-flex">{t('nav.signUp')}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

const initials = (email: string) => email.replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ]/g, '').slice(0, 2).toUpperCase() || '··';

/** Header of the signed-in app: section tabs, language and a profile menu with sign out. */
export const AppHeader: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [menuOpen]);

  const email = profile?.email || user?.signInDetails?.loginId || user?.username || '';
  const tabs: Array<{ to: string; label: string; active: boolean }> = [
    { to: '/app', label: t('nav.dashboard'), active: pathname === '/app' },
    { to: '/app/analyses/new', label: t('nav.newAnalysis'), active: pathname === '/app/analyses/new' },
    { to: '/app/cvs', label: t('nav.cvs'), active: pathname.startsWith('/app/cvs') },
    {
      to: '/app/analyses',
      label: t('nav.history'),
      active: pathname.startsWith('/app/analyses') && pathname !== '/app/analyses/new',
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="bg-white border-b border-line sticky top-0 z-20">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Logo to="/app" size={28} />
        <nav
          aria-label={t('nav.sections')}
          className="order-last md:order-none w-full md:w-auto md:flex-1 flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 md:pb-0"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={tab.active ? 'page' : undefined}
              className={`whitespace-nowrap px-3.5 py-2.5 rounded-lg text-[15px] leading-none no-underline ${
                tab.active ? 'bg-accent-soft text-accent-ink font-semibold' : 'text-ink-soft hover:bg-canvas hover:text-ink font-medium'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto md:ml-0 flex items-center gap-3">
          <LangSwitch compact />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label={t('nav.profileMenu')}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="w-10 h-10 rounded-full bg-ink text-white font-display font-bold text-sm"
            >
              {initials(email)}
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-64 bg-white border border-line rounded-xl shadow-float p-2 z-30">
                <div className="px-3 py-2.5 border-b border-line mb-1">
                  <p className="text-xs text-ink-muted">{t('nav.signedInAs')}</p>
                  <p className="text-sm font-semibold text-ink truncate">{email}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSignOut()}
                  className="w-full text-left px-3 min-h-[44px] rounded-lg text-[15px] font-medium text-warn hover:bg-warn-alert"
                >
                  {t('nav.signOut')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
