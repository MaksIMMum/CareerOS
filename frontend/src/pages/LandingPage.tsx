import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';

export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex-1 flex flex-col justify-between">
      <main className="max-w-5xl mx-auto px-4 py-12 sm:py-16 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold mb-6">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            {t('status')}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            {t('tagline')}
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {user ? (
              <Link
                to="/app"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors text-center"
              >
                {t('nav.dashboard')} →
              </Link>
            ) : (
              <>
                <Link
                  to="/signup"
                  className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors text-center"
                >
                  {t('landing.ctaStart')}
                </Link>
                <Link
                  to="/signin"
                  className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors text-center"
                >
                  {t('landing.ctaSignIn')}
                </Link>
              </>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-500">
            {t('landing.freeNotice')}
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-4">
              📄
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-2">
              {t('landing.features.analysisTitle')}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {t('landing.features.analysisDesc')}
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-2xl mb-4">
              📊
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-2">
              {t('landing.features.trackerTitle')}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {t('landing.features.trackerDesc')}
            </p>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl mb-4">
              💬
            </div>
            <h3 className="font-bold text-lg text-slate-900 mb-2">
              {t('landing.features.interviewTitle')}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {t('landing.features.interviewDesc')}
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-slate-500">
          CareerOS — AWS Serverless (Cognito, DynamoDB, API Gateway, CloudFront) & Google Gemini.
        </div>
      </footer>
    </div>
  );
};
