import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';

export const Navbar: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'uk' ? 'en' : 'uk';
    i18n.changeLanguage(nextLang);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to={user ? '/app' : '/'} className="flex items-center space-x-2 shrink-0">
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-blue-600">CareerOS</span>
          <span className="hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
            v0.2
          </span>
        </Link>

        <div className="flex items-center space-x-2.5 sm:space-x-4">
          <button
            onClick={toggleLanguage}
            className="px-2.5 py-1 text-xs sm:text-sm font-medium border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            title={t('nav.toggleLanguage')}
          >
            🌐 {i18n.language === 'uk' ? 'EN' : 'UA'}
          </button>

          {user ? (
            <>
              <Link
                to="/app"
                className="hidden sm:inline text-xs sm:text-sm font-medium text-slate-700 hover:text-blue-600"
              >
                {t('nav.dashboard')}
              </Link>
              <Link
                to="/app/analyses/new"
                className="text-xs sm:text-sm font-semibold text-blue-700 hover:text-blue-800 whitespace-nowrap"
              >
                {t('nav.analysesShort')}
              </Link>
              <Link
                to="/app/cvs"
                className="text-xs sm:text-sm font-medium text-slate-700 hover:text-blue-600 whitespace-nowrap"
              >
                {t('nav.cvsShort')}
              </Link>
              <span className="hidden md:inline-block text-xs text-slate-400">|</span>
              <span className="hidden md:inline-block text-xs text-slate-600 truncate max-w-[150px]">
                {profile?.email || user.username}
              </span>
              <button
                onClick={handleSignOut}
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
              >
                {t('nav.signOut')}
              </button>
            </>
          ) : (
            <>
              <Link
                to="/signin"
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {t('nav.signIn')}
              </Link>
              <Link
                to="/signup"
                className="px-3.5 py-1.5 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                {t('nav.signUp')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
