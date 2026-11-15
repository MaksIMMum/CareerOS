import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listAnalyses, type AnalysisSummary } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { ErrorAlert, Icon, PageHero, scoreColor } from '../components/ui.js';

export const HistoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<AnalysisSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAnalyses()
      .then(setItems)
      .catch((err) => {
        setItems([]);
        setError(apiErrorMessage(err, t));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex-1">
      <PageHero
        overlap
        eyebrow={t('analysis.eyebrow')}
        title={t('analysis.history')}
        lead={t('analysis.historySubtitle')}
        aside={<Link to="/app/analyses/new" className="btn-primary btn-lg">{t('analysis.newBtn')}</Link>}
      />
    <main className="relative max-w-[1240px] w-full mx-auto -mt-16 sm:-mt-20 px-4 sm:px-6 pb-16">
      {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}

      {items === null ? (
        <div className="card shadow-lift"><p className="text-sm text-ink-muted">{t('analysis.loading')}</p></div>
      ) : items.length === 0 ? (
        <div className="card shadow-lift p-10 text-center text-[15px] text-ink-muted">
          {t('analysis.historyEmpty')}
        </div>
      ) : (
        <ul className="bg-white rounded-3xl border border-line divide-y divide-line overflow-hidden shadow-lift">
          {items.map((a) => (
            <li key={a.id}>
              <Link to={`/app/analyses/${a.id}`} className="flex items-center gap-4 px-4 sm:px-6 py-4 no-underline text-ink hover:bg-canvas hover:text-ink">
                <span className={`w-12 text-center font-mono font-bold text-[28px] leading-none ${scoreColor(a.matchScore)}`}>{a.matchScore}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold truncate">
                    {a.vacancyTitle}
                    {a.company && <span className="text-ink-muted font-normal"> · {a.company}</span>}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
                    <span className="truncate max-w-full">{a.cvName} · {fmt(a.createdAt)}</span>
                    {a.shareScores && (
                      <span className="font-mono">
                        {a.shareScores.before} → {a.shareScores.after}
                      </span>
                    )}
                    {a.flaggedCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-warn">
                        <Icon.warn className="w-3.5 h-3.5" /> {t('analysis.flaggedBadge')}
                      </span>
                    )}
                  </span>
                </span>
                <Icon.arrowRight className="w-5 h-5 shrink-0 text-ink-faint" />
                <span className="sr-only">{t('analysis.open')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
    </div>
  );
};
