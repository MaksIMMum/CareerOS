import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listInterviews, type InterviewSummary } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { ErrorAlert, Icon, PageHero, scoreColor } from '../components/ui.js';

/** Interview history: finished ones with their score, unfinished ones can be continued. */
export const InterviewsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<InterviewSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listInterviews()
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
        eyebrow={t('interview.eyebrow')}
        title={t('interview.historyTitle')}
        lead={t('interview.historyLead')}
        aside={<Link to="/app/interviews/new" className="btn-primary btn-lg">{t('interview.newBtn')}</Link>}
      />
      <main className="relative max-w-[1240px] w-full mx-auto -mt-16 sm:-mt-20 px-4 sm:px-6 pb-16">
        {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}

        {items === null ? (
          <div className="card shadow-lift"><p className="text-sm text-ink-muted">{t('common.loading')}</p></div>
        ) : items.length === 0 ? (
          <div className="card shadow-lift p-10 text-center">
            <p className="mb-5 text-[15px] text-ink-muted">{t('interview.historyEmpty')}</p>
            <Link to="/app/interviews/new" className="btn-primary">{t('interview.start')}</Link>
          </div>
        ) : (
          <ul className="bg-white rounded-3xl border border-line divide-y divide-line overflow-hidden shadow-lift">
            {items.map((iv) => {
              const done = iv.status === 'DONE' && iv.overallScore !== undefined;
              return (
                <li key={iv.id}>
                  <Link to={`/app/interviews/${iv.id}`} className="flex items-center gap-4 px-4 sm:px-6 py-4 no-underline text-ink hover:bg-canvas hover:text-ink">
                    <span className="w-14 text-center shrink-0">
                      {done ? (
                        <span className={`block font-mono font-bold text-[26px] leading-none ${scoreColor(iv.overallScore! * 10)}`}>
                          {iv.overallScore!.toFixed(1)}
                        </span>
                      ) : (
                        <span className="block font-mono font-semibold text-[15px] text-ink-muted">
                          {iv.answeredCount}/{iv.questionCount}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold truncate">
                        {iv.vacancyTitle}
                        {iv.company && <span className="text-ink-muted font-normal"> · {iv.company}</span>}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-muted">
                        <span className="truncate max-w-full">{iv.cvName} · {fmt(iv.createdAt)}</span>
                        {!done && <span className="chip-neutral py-0.5 px-2 text-[12px]">{t('interview.inProgress')}</span>}
                      </span>
                    </span>
                    <span className="sr-only">{done ? t('interview.openResult') : t('interview.continue')}</span>
                    <Icon.arrowRight className="w-5 h-5 shrink-0 text-ink-faint" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
};
