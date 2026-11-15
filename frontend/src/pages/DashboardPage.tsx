import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuth();

  const email = profile?.email || user?.username || '—';
  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString()
    : new Date().toLocaleDateString();
  const source = profile?.source || 'direct';

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:py-12">
      {/* Header banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {t('dashboard.activeSession')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {t('dashboard.welcome')}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {email}
            </p>
          </div>

          <button
            onClick={signOut}
            className="self-start sm:self-auto px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded-xl transition-colors"
          >
            {t('nav.signOut')}
          </button>
        </div>

        {/* Profile metadata chips */}
        <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
            <span className="text-xs text-slate-500 font-medium block mb-1">
              {t('dashboard.email')}
            </span>
            <span className="text-sm font-semibold text-slate-800 break-all">{email}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
            <span className="text-xs text-slate-500 font-medium block mb-1">
              {t('dashboard.source')}
            </span>
            <span className="text-sm font-semibold text-slate-800 capitalize">{source}</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60">
            <span className="text-xs text-slate-500 font-medium block mb-1">
              {t('dashboard.joined')}
            </span>
            <span className="text-sm font-semibold text-slate-800">{joinedDate}</span>
          </div>
        </div>
      </div>

      {/* Empty State Banner (Criterion 2 met: see an empty /app page) */}
      <div className="p-4 sm:p-5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-sm mb-8 flex items-center gap-3">
        <span className="text-2xl">🚀</span>
        <div>
          <span className="font-semibold">{t('dashboard.emptyNotice')}</span>
        </div>
      </div>

      {/* Feature module placeholders for upcoming steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link
          to="/app/cvs"
          className="block bg-white p-6 rounded-2xl border border-blue-200 shadow-sm hover:border-blue-400 hover:shadow transition"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📄</span>
            <h3 className="font-semibold text-slate-900">{t('dashboard.modules.cvsTitle')}</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t('dashboard.modules.cvsDesc')}
          </p>
          <span className="mt-3 inline-block text-sm font-semibold text-blue-600">
            {t('dashboard.open')}
          </span>
        </Link>

        <Link
          to="/app/analyses/new"
          className="block bg-white p-6 rounded-2xl border border-blue-200 shadow-sm hover:border-blue-400 hover:shadow transition"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">⚡</span>
            <h3 className="font-semibold text-slate-900">{t('dashboard.modules.analysisTitle')}</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t('dashboard.modules.analysisDesc')}
          </p>
          <span className="mt-3 inline-block text-sm font-semibold text-blue-600">
            {t('dashboard.open')}
          </span>
        </Link>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm opacity-90">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📊</span>
            <h3 className="font-semibold text-slate-900">{t('dashboard.modules.trackerTitle')}</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t('dashboard.modules.trackerDesc')}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm opacity-90">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">💬</span>
            <h3 className="font-semibold text-slate-900">{t('dashboard.modules.interviewTitle')}</h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t('dashboard.modules.interviewDesc')}
          </p>
        </div>
      </div>
    </div>
  );
};
