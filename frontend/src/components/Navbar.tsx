import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { LangSwitch, Logo } from './ui.js';

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
    { to: '/app/tracker', label: t('nav.tracker'), active: pathname.startsWith('/app/tracker') },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="bg-accent text-white sticky top-0 z-20">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-3 sm:py-3.5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Logo to="/app" size={30} tone="onBlue" />
        <nav
          aria-label={t('nav.sections')}
          className="order-last md:order-none w-full md:w-auto md:flex-1 flex flex-wrap md:flex-nowrap gap-1 md:overflow-x-auto -mx-1 px-1 pb-1 md:pb-0"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={tab.active ? 'page' : undefined}
              className={`whitespace-nowrap inline-flex items-center min-h-[40px] px-2.5 sm:px-3.5 rounded-full text-[14px] sm:text-[15px] leading-none no-underline ${
                tab.active ? 'bg-sun text-ink font-bold hover:text-ink' : 'text-accent-on hover:bg-white/10 hover:text-white font-medium'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto md:ml-0 flex items-center gap-3">
          <LangSwitch compact onBlue />
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label={t('nav.profileMenu')}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="w-10 h-10 rounded-full bg-sun text-ink font-display font-extrabold text-sm"
            >
              {initials(email)}
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-64 bg-white text-ink border border-line rounded-2xl shadow-float p-2 z-30">
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
