import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  createAnalysis,
  listCvs,
  listVacancies,
  type CvSummary,
  type VacancySummary,
} from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { LIMITS } from '../lib/limits.js';
import { ErrorAlert, Icon } from '../components/ui.js';

const STEPS = ['reading', 'comparing', 'rewriting', 'checking'] as const;

/** Shown while the AI works (~5–20 s): a bar that never reaches 100 early and a checklist of steps. */
const Progress: React.FC<{ seconds: number }> = ({ seconds }) => {
  const { t } = useTranslation();
  const current = Math.min(STEPS.length - 1, Math.floor(seconds / 4));
  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-seconds / 8))));
  return (
    <div role="status" aria-live="polite" className="w-full">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="eyebrow">{t('analysis.progress.title')}</p>
        <p className="font-mono text-[13px] text-ink-muted">{t('analysis.progress.elapsed', { seconds })}</p>
      </div>
      <div className="h-2 rounded-full bg-line overflow-hidden mb-3">
        <div className="h-full bg-accent transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {STEPS.map((step, i) => (
          <li
            key={step}
            className={`inline-flex items-center gap-1.5 ${i < current ? 'text-accent-ink font-semibold' : i === current ? 'text-ink font-semibold' : 'text-ink-muted'}`}
          >
            {i < current && <Icon.check className="w-4 h-4" />}
            {t(`analysis.progress.${step}`)}
            {i === current && '…'}
          </li>
        ))}
      </ul>
    </div>
  );
};

const StepBadge: React.FC<{ n: number }> = ({ n }) => (
  <span className="w-8 h-8 shrink-0 rounded-full bg-accent text-white inline-flex items-center justify-center font-mono font-bold text-sm" aria-hidden="true">
    {n}
  </span>
);

export const NewAnalysisPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [cvs, setCvs] = useState<CvSummary[] | null>(null);
  const [vacancies, setVacancies] = useState<VacancySummary[]>([]);
  const [cvId, setCvId] = useState('');
  const [vacancyId, setVacancyId] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCvs(), listVacancies().catch(() => [])])
      .then(([c, v]) => {
        setCvs(c);
        setVacancies(v);
        if (c[0]) setCvId(c[0].id); // newest first
      })
      .catch((err) => {
        setCvs([]);
        setError(apiErrorMessage(err, t));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running) return;
    setSeconds(0);
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const chars = text.trim().length;
  const over = chars - LIMITS.VACANCY_TEXT_MAX;
  const usingSaved = vacancyId !== '';
  const canRun =
    !running && cvId !== '' && (usingSaved || (title.trim() !== '' && chars > 0 && over <= 0));

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRun) return;
    setError(null);
    setRunning(true);
    try {
      const lang = i18n.language === 'en' ? 'en' : 'uk';
      const analysis = await createAnalysis(
        usingSaved
          ? { cvId, vacancyId, lang }
          : { cvId, lang, vacancy: { title: title.trim(), company: company.trim(), text: text.trim() } },
      );
      navigate(`/app/analyses/${analysis.id}`, { state: { analysis } });
    } catch (err) {
      setError(apiErrorMessage(err, t));
      setRunning(false);
    }
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'uk-UA', { day: 'numeric', month: 'long' });

  return (
    <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <p className="eyebrow mb-2">{t('analysis.eyebrow')}</p>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8 sm:mb-9">
        <div>
          <h1 className="page-title mb-2">{t('analysis.newTitle')}</h1>
          <p className="text-[17px] text-ink-soft">{t('analysis.newSubtitle')}</p>
        </div>
        <Link to="/app/analyses" className="text-[15px] link">
          {t('analysis.history')} →
        </Link>
      </div>

      {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}

      {cvs === null ? (
        <p className="text-sm text-ink-muted">{t('analysis.loading')}</p>
      ) : cvs.length === 0 ? (
        <div className="card text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
            <Icon.doc className="w-7 h-7" />
          </div>
          <p className="mb-4 text-[17px] text-ink-soft">{t('analysis.noCvs')}</p>
          <Link to="/app/cvs" className="btn-primary">{t('analysis.addCv')}</Link>
        </div>
      ) : (
        <form onSubmit={run}>
          <fieldset disabled={running} className="flex flex-wrap gap-6 items-start min-w-0">
            {/* 1. CV */}
            <section aria-labelledby="cvh" className="card flex-[1_1_340px] min-w-0">
              <div className="flex items-center gap-3 mb-5">
                <StepBadge n={1} />
                <h2 id="cvh" className="font-display font-bold text-xl">{t('analysis.step1')}</h2>
              </div>
              <div className="flex flex-col gap-2.5 mb-5">
                {cvs.map((cv) => {
                  const on = cv.id === cvId;
                  return (
                    <label
                      key={cv.id}
                      className={`flex items-center gap-3.5 p-4 rounded-xl cursor-pointer ${on ? 'border-2 border-accent bg-accent-wash' : 'border border-line-strong hover:bg-canvas'}`}
                    >
                      <input type="radio" name="cv" value={cv.id} checked={on} onChange={() => setCvId(cv.id)} className="w-5 h-5 shrink-0 accent-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold leading-snug truncate">{cv.name}</span>
                        <span className="block text-[13px] text-ink-muted">{t('analysis.cvMeta', { date: fmt(cv.updatedAt) })}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="p-5 border-[1.5px] border-dashed border-line-dashed rounded-xl text-center bg-subtle">
                <Icon.upload className="w-7 h-7 mx-auto text-ink-muted" />
                <p className="mt-2 mb-1 font-semibold">{t('analysis.addCvTitle')}</p>
                <p className="mb-3.5 text-[13px] text-ink-muted">{t('analysis.addCvHint')}</p>
                <Link to="/app/cvs" className="btn-secondary">{t('analysis.addCv')}</Link>
              </div>
            </section>

            {/* 2. Vacancy */}
            <section aria-labelledby="vh" className="card flex-[2_1_520px] min-w-0">
              <div className="flex items-center gap-3 mb-5">
                <StepBadge n={2} />
                <h2 id="vh" className="font-display font-bold text-xl">{t('analysis.step2')}</h2>
              </div>

              {vacancies.length > 0 && (
                <div className="mb-4">
                  <label htmlFor="saved" className="lbl">
                    {t('analysis.savedVacancyLabel')} <span className="lbl-optional">{t('common.optional')}</span>
                  </label>
                  <select id="saved" value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} className="field appearance-auto">
                    <option value="">{t('analysis.pasteNew')}</option>
                    {vacancies.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                        {v.company ? ` — ${v.company}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!usingSaved && (
                <>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 mb-4">
                    <div>
                      <label htmlFor="title" className="lbl">{t('analysis.titleLabel')}</label>
                      <input id="title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder={t('analysis.titlePlaceholder')} className="field" />
                    </div>
                    <div>
                      <label htmlFor="company" className="lbl">
                        {t('analysis.companyLabel')} <span className="lbl-optional">{t('common.optional')}</span>
                      </label>
                      <input id="company" value={company} maxLength={120} onChange={(e) => setCompany(e.target.value)} className="field" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="vtext" className="lbl">{t('analysis.textLabel')}</label>
                    <textarea id="vtext" value={text} onChange={(e) => setText(e.target.value)} rows={9} placeholder={t('analysis.textPlaceholder')} className="field min-h-[13rem] resize-y leading-normal" />
                    <p className={`mt-2 text-right font-mono text-[13px] ${over > 0 ? 'text-warn-strong font-bold' : 'text-ink-muted'}`}>
                      {t('cvs.chars', { count: chars, max: LIMITS.VACANCY_TEXT_MAX })}
                    </p>
                  </div>
                </>
              )}

              <div className="flex flex-wrap gap-4 items-center justify-between mt-6 pt-6 border-t border-line">
                {running ? (
                  <Progress seconds={seconds} />
                ) : (
                  <>
                    <div className="max-w-[420px]">
                      <p className="text-sm text-ink-muted">{t('analysis.runHint')}</p>
                      <p className="mt-1 font-mono text-xs text-ink-muted">{t('analysis.quotaHint', { limit: 10 })}</p>
                    </div>
                    <button type="submit" disabled={!canRun} className="btn-primary btn-lg w-full sm:w-auto">
                      {t('analysis.analyse')} <Icon.arrowRight className="w-[18px] h-[18px]" />
                    </button>
                  </>
                )}
              </div>
            </section>
          </fieldset>
        </form>
      )}
    </main>
  );
};
