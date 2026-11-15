import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { listAnalyses, listCvs, type AnalysisSummary, type CvSummary } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { ErrorAlert, Icon, scoreColor } from '../components/ui.js';

export const DashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, profile, signOut } = useAuth();
  const [cvs, setCvs] = useState<CvSummary[] | null>(null);
  const [analyses, setAnalyses] = useState<AnalysisSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCvs()
      .then(setCvs)
      .catch((err) => {
        setCvs([]);
        setError(apiErrorMessage(err, t));
      });
    listAnalyses()
      .then(setAnalyses)
      .catch(() => setAnalyses([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locale = i18n.language === 'en' ? 'en-GB' : 'uk-UA';
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const email = profile?.email || user?.signInDetails?.loginId || user?.username || '';

  return (
    <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <p className="eyebrow mb-2">{t('dashboard.eyebrow')}</p>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title mb-2">{t('dashboard.title')}</h1>
          <p className="text-[17px] text-ink-soft max-w-[620px]">{t('dashboard.lead')}</p>
        </div>
        <Link to="/app/analyses/new" className="btn-primary btn-lg self-start sm:self-auto">
          {t('dashboard.startCta')} <Icon.arrowRight className="w-[18px] h-[18px]" />
        </Link>
      </div>

      {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        {/* Latest analyses */}
        <section className="card">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="section-title">{t('dashboard.historyTitle')}</h2>
            <Link to="/app/analyses" className="text-sm link">{t('dashboard.seeAll')} →</Link>
          </div>
          {analyses === null ? (
            <p className="text-sm text-ink-muted">{t('common.loading')}</p>
          ) : analyses.length === 0 ? (
            <p className="text-[15px] text-ink-muted">{t('dashboard.historyEmpty')}</p>
          ) : (
            <ul className="divide-y divide-line -mx-2">
              {analyses.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link to={`/app/analyses/${a.id}`} className="flex items-center gap-4 px-2 py-3 rounded-lg no-underline text-ink hover:bg-canvas hover:text-ink">
                    <span className={`w-12 text-center font-mono font-bold text-2xl ${scoreColor(a.matchScore)}`}>{a.matchScore}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold truncate">
                        {a.vacancyTitle}
                        {a.company && <span className="text-ink-muted font-normal"> · {a.company}</span>}
                      </span>
                      <span className="block text-[13px] text-ink-muted truncate">
                        {a.cvName} · {fmt(a.createdAt)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          {/* CVs */}
          <section className="card">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="section-title">{t('dashboard.cvsTitle')}</h2>
              <Link to="/app/cvs" className="text-sm link">{t('dashboard.manage')} →</Link>
            </div>
            {cvs === null ? (
              <p className="text-sm text-ink-muted">{t('common.loading')}</p>
            ) : cvs.length === 0 ? (
              <p className="text-[15px] text-ink-muted">{t('dashboard.cvsEmpty')}</p>
            ) : (
              <>
                <p className="mb-3 font-mono text-[13px] text-ink-muted">{t('dashboard.cvsCount', { count: cvs.length })}</p>
                <div className="flex flex-wrap gap-2">
                  {cvs.slice(0, 6).map((cv) => (
                    <span key={cv.id} className="chip-neutral max-w-full truncate">{cv.name}</span>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Account */}
          <section className="card">
            <p className="eyebrow mb-3">{t('dashboard.account')}</p>
            <p className="font-semibold break-all">{email}</p>
            {profile?.createdAt && <p className="mt-1 text-sm text-ink-muted">{t('dashboard.joined', { date: fmt(profile.createdAt) })}</p>}
            <button type="button" onClick={() => void signOut()} className="btn-danger mt-4">
              {t('nav.signOut')}
            </button>
          </section>
        </div>
      </div>

      {/* Coming next */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {(
          [
            [<Icon.columns className="w-8 h-8" />, t('dashboard.trackerTitle'), t('dashboard.trackerText')],
            [<Icon.chat className="w-8 h-8" />, t('dashboard.interviewTitle'), t('dashboard.interviewText')],
          ] as const
        ).map(([icon, title, text]) => (
          <section key={title} className="p-6 rounded-2xl border border-dashed border-line-dashed bg-subtle">
            <div className="mb-4 flex items-start justify-between gap-3 text-ink-faint">
              {icon}
              <span className="chip-neutral font-mono text-xs uppercase tracking-wider">{t('common.soon')}</span>
            </div>
            <h2 className="mb-1.5 font-display font-bold text-lg text-ink-soft">{title}</h2>
            <p className="text-[15px] text-ink-muted">{text}</p>
          </section>
        ))}
      </div>
    </main>
  );
};
