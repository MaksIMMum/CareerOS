import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSkillInsights, type SkillGapReport } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { ErrorAlert } from './ui.js';

const COLLAPSED = 6;

/** "What the market wants from you": skills missing most often across the user's analyses. */
export const SkillGapsCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [report, setReport] = useState<SkillGapReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getSkillInsights()
      .then(setReport)
      .catch((err) => setError(apiErrorMessage(err, t)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skills = report?.skills ?? [];
  const shown = expanded ? skills : skills.slice(0, COLLAPSED);

  return (
    <section className={`card ${className}`} aria-labelledby="skill-gaps-title">
      <div className="flex flex-wrap items-baseline justify-between gap-3 mb-1">
        <h2 id="skill-gaps-title" className="section-title">{t('skills.title')}</h2>
        {report && report.analyses > 0 && (
          <span className="font-mono text-[13px] text-ink-muted">{t('skills.basedOn', { count: report.analyses })}</span>
        )}
      </div>
      <p className="mb-5 text-[15px] text-ink-muted">{t('skills.lead')}</p>

      {error ? (
        <ErrorAlert>{error}</ErrorAlert>
      ) : report === null ? (
        <p className="text-sm text-ink-muted">{t('common.loading')}</p>
      ) : report.analyses === 0 ? (
        <p className="text-[15px] text-ink-muted">
          {t('skills.empty')}{' '}
          <Link to="/app/analyses/new" className="link">{t('dashboard.startCta')} →</Link>
        </p>
      ) : skills.length === 0 ? (
        <p className="text-[15px] text-ink-muted">{t('skills.noGaps')}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {shown.map((s) => {
              const pct = Math.round((s.count / report.analyses) * 100);
              const closed = s.inCvs.length > 0;
              return (
                <li key={s.skill}>
                  <details className="group rounded-2xl border border-line open:bg-subtle">
                    <summary className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 min-h-[52px] cursor-pointer list-none rounded-2xl hover:bg-canvas [&::-webkit-details-marker]:hidden">
                      <span className="font-display font-bold text-[16px] min-w-0 flex-[1_1_140px] break-words">
                        {s.skill}
                      </span>
                      {closed && (
                        <span className="chip-ok text-[13px] py-1" title={t('skills.inCvTitle', { names: s.inCvs.join(', ') })}>
                          {t('skills.inCv')}
                        </span>
                      )}
                      <span className="flex items-center gap-3 flex-[0_1_220px] min-w-[160px]">
                        <span className="h-2 flex-1 rounded-full bg-[#F1F2F5] overflow-hidden" aria-hidden="true">
                          <span className={`block h-full rounded-full ${closed ? 'bg-accent-bar' : 'bg-warn-dashed'}`} style={{ width: `${pct}%` }} />
                        </span>
                        <span className="font-mono font-bold text-sm whitespace-nowrap" aria-label={t('skills.ratioAria', { count: s.count, total: report.analyses })}>
                          {t('skills.ratio', { count: s.count, total: report.analyses })}
                        </span>
                      </span>
                    </summary>
                    <div className="px-4 pb-4 pt-1">
                      <p className="mb-2 text-[13px] font-semibold text-ink-muted">{t('skills.vacancies')}</p>
                      <ul className="flex flex-col gap-1">
                        {s.vacancies.map((v) => (
                          <li key={v.analysisId}>
                            <Link to={`/app/analyses/${v.analysisId}`} className="link text-[15px] font-medium break-words">
                              {v.title}
                              {v.company && <span className="text-ink-muted font-normal"> · {v.company}</span>}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          {skills.length > COLLAPSED && (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="btn-secondary btn-sm mt-4">
              {expanded ? t('skills.showLess') : t('skills.showAll', { count: skills.length })}
            </button>
          )}
        </>
      )}
    </section>
  );
};
