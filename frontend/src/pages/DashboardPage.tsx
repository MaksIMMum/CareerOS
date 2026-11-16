import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { listAnalyses, listCvs, type AnalysisSummary, type CvSummary } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { ErrorAlert, Icon, PageHero, scoreColor } from '../components/ui.js';

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
    <div className="flex-1">
      <PageHero
        overlap
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        lead={t('dashboard.lead')}
        aside={
          <Link to="/app/analyses/new" className="btn-primary btn-lg">
            {t('dashboard.startCta')} <Icon.arrowRight className="w-[18px] h-[18px]" />
          </Link>
        }
      />
    <main className="relative max-w-[1240px] w-full mx-auto -mt-16 sm:-mt-20 px-4 sm:px-6 pb-16">
      {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-6">
        {/* Latest analyses */}
        <section className="card shadow-lift">
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
          <section className="card shadow-lift">
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
          <section className="card bg-night border-night text-white">
            <p className="eyebrow mb-3 text-night-muted">{t('dashboard.account')}</p>
            <p className="font-semibold break-all">{email}</p>
            {profile?.createdAt && <p className="mt-1 text-sm text-night-muted">{t('dashboard.joined', { date: fmt(profile.createdAt) })}</p>}
            <button type="button" onClick={() => void signOut()} className="btn mt-4 bg-transparent text-white border-[1.5px] border-white/40 rounded-xl hover:bg-white/10 hover:text-white">
              {t('nav.signOut')}
            </button>
          </section>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <section className="card flex flex-col">
          <div className="mb-4 text-accent"><Icon.columns className="w-8 h-8" /></div>
          <h2 className="mb-1.5 font-display font-bold text-lg">{t('dashboard.trackerTitle')}</h2>
          <p className="mb-5 text-[15px] text-ink-muted">{t('dashboard.trackerText')}</p>
          <Link to="/app/tracker" className="btn-accent mt-auto self-start">
            {t('dashboard.trackerCta')} <Icon.arrowRight className="w-4 h-4" />
          </Link>
        </section>
        {/* Coming next */}
        <section className="p-6 rounded-3xl border-2 border-dashed border-line-dashed bg-subtle">
          <div className="mb-4 flex items-start justify-between gap-3 text-ink-faint">
            <Icon.chat className="w-8 h-8" />
            <span className="chip-neutral font-mono text-xs uppercase tracking-wider">{t('common.soon')}</span>
          </div>
          <h2 className="mb-1.5 font-display font-bold text-lg text-ink-soft">{t('dashboard.interviewTitle')}</h2>
          <p className="text-[15px] text-ink-muted">{t('dashboard.interviewText')}</p>
        </section>
      </div>
    </main>
    </div>
  );
};
