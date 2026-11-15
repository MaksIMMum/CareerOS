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

const inputClass =
  'w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white';

const STEPS = ['reading', 'comparing', 'rewriting', 'checking'] as const;

/** Progress shown while the AI works (~5–20 s): elapsed seconds, a bar and rotating steps. */
const Progress: React.FC<{ seconds: number }> = ({ seconds }) => {
  const { t } = useTranslation();
  const step = STEPS[Math.min(STEPS.length - 1, Math.floor(seconds / 4))]!;
  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-seconds / 8)))); // never "done" early
  return (
    <div role="status" aria-live="polite" className="p-4 rounded-2xl border border-blue-200 bg-blue-50">
      <p className="font-medium text-blue-900">{t(`analysis.progress.${step}`)}</p>
      <div className="mt-3 h-2 rounded-full bg-blue-100 overflow-hidden">
        <div className="h-full bg-blue-600 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-blue-800">{t('analysis.progress.elapsed', { seconds })}</p>
    </div>
  );
};

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

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t('analysis.newTitle')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('analysis.newSubtitle')}</p>
        </div>
        <Link to="/app/analyses" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          {t('analysis.history')} →
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      {cvs === null ? (
        <p className="text-sm text-slate-500">{t('analysis.loading')}</p>
      ) : cvs.length === 0 ? (
        <div className="p-6 bg-white rounded-2xl border border-slate-200 text-center">
          <p className="text-slate-700">{t('analysis.noCvs')}</p>
          <Link to="/app/cvs" className="mt-3 inline-block font-semibold text-blue-600">
            {t('analysis.addCv')}
          </Link>
        </div>
      ) : (
        <form onSubmit={run} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
          <fieldset disabled={running} className="space-y-4">
            <div>
              <label htmlFor="cv" className="block text-sm font-medium text-slate-700 mb-1">
                {t('analysis.cvLabel')}
              </label>
              <select id="cv" value={cvId} onChange={(e) => setCvId(e.target.value)} className={inputClass}>
                {cvs.map((cv) => (
                  <option key={cv.id} value={cv.id}>
                    {cv.name}
                  </option>
                ))}
              </select>
            </div>

            {vacancies.length > 0 && (
              <div>
                <label htmlFor="saved" className="block text-sm font-medium text-slate-700 mb-1">
                  {t('analysis.savedVacancyLabel')}
                </label>
                <select id="saved" value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} className={inputClass}>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
                      {t('analysis.titleLabel')}
                    </label>
                    <input id="title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} placeholder={t('analysis.titlePlaceholder')} className={inputClass} />
                  </div>
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-1">
                      {t('analysis.companyLabel')}
                    </label>
                    <input id="company" value={company} maxLength={120} onChange={(e) => setCompany(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label htmlFor="vtext" className="block text-sm font-medium text-slate-700 mb-1">
                    {t('analysis.textLabel')}
                  </label>
                  <textarea id="vtext" value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={t('analysis.textPlaceholder')} className={`${inputClass} min-h-[12rem]`} />
                  <p className={`mt-1 text-right text-xs ${over > 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                    {t('cvs.chars', { count: chars, max: LIMITS.VACANCY_TEXT_MAX })}
                  </p>
                </div>
              </>
            )}
          </fieldset>

          {running ? (
            <Progress seconds={seconds} />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{t('analysis.quotaHint', { limit: 10 })}</p>
              <button type="submit" disabled={!canRun} className="px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm">
                ⚡ {t('analysis.analyse')}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
