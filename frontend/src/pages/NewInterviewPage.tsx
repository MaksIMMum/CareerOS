import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  createInterview,
  createVacancy,
  listCvs,
  listVacancies,
  type CvSummary,
  type VacancySummary,
} from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { LIMITS } from '../lib/limits.js';
import { ErrorAlert, Icon, PageHero } from '../components/ui.js';

/** Pre-selects the CV and vacancy, e.g. from an analysis or a tracker card. */
export interface InterviewPrefill {
  cvId?: string;
  vacancyId?: string | null;
}

export const NewInterviewPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const prefill = (useLocation().state as { prefill?: InterviewPrefill } | null)?.prefill;

  const [cvs, setCvs] = useState<CvSummary[] | null>(null);
  const [vacancies, setVacancies] = useState<VacancySummary[]>([]);
  const [cvId, setCvId] = useState('');
  const [vacancyId, setVacancyId] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [text, setText] = useState('');
  // A pasted vacancy is saved once; a retry after an AI error reuses it instead of a duplicate.
  const [pastedId, setPastedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCvs(), listVacancies().catch(() => [])])
      .then(([c, v]) => {
        setCvs(c);
        setVacancies(v);
        const cv = c.find((x) => x.id === prefill?.cvId) ?? c[0];
        if (cv) setCvId(cv.id);
        if (prefill?.vacancyId && v.some((x) => x.id === prefill.vacancyId)) setVacancyId(prefill.vacancyId);
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
  const usingSaved = vacancyId !== '';
  const canRun =
    !running &&
    cvId !== '' &&
    (usingSaved || (title.trim() !== '' && chars > 0 && chars <= LIMITS.VACANCY_TEXT_MAX));

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canRun) return;
    setError(null);
    setRunning(true);
    try {
      let vid = vacancyId;
      if (!usingSaved) {
        vid =
          pastedId ??
          (await createVacancy({ title: title.trim(), company: company.trim(), url: '', text: text.trim() })).id;
        setPastedId(vid);
      }
      const interview = await createInterview({ cvId, vacancyId: vid, lang: i18n.language === 'en' ? 'en' : 'uk' });
      navigate(`/app/interviews/${interview.id}`, { state: { interview } });
    } catch (err) {
      setError(apiErrorMessage(err, t));
      setRunning(false);
    }
  };

  return (
    <div className="flex-1">
      <PageHero
        overlap
        eyebrow={t('interview.eyebrow')}
        title={t('interview.newTitle')}
        lead={t('interview.newLead')}
        aside={
          <div className="flex flex-col items-start gap-3">
            <Link to="/app/interviews" className="text-[15px] font-semibold text-white hover:text-sun no-underline">
              {t('interview.historyLink')} →
            </Link>
            <div className="px-[18px] py-3.5 rounded-2xl bg-white/15">
              <p className="mb-1.5 font-mono text-xs text-white">{t('analysis.quotaLabel')}</p>
              <p className="font-mono font-bold text-base">{t('interview.quotaValue', { limit: LIMITS.INTERVIEWS_PER_DAY })}</p>
            </div>
          </div>
        }
      />

      <main className="relative max-w-[920px] mx-auto -mt-16 sm:-mt-20 px-4 sm:px-6 pb-16">
        {error && <ErrorAlert className="mb-6 shadow-lift">{error}</ErrorAlert>}

        {cvs === null ? (
          <div className="card shadow-lift"><p className="text-sm text-ink-muted">{t('common.loading')}</p></div>
        ) : cvs.length === 0 ? (
          <div className="card shadow-lift text-center">
            <p className="mb-5 text-[17px] text-ink-soft">{t('interview.noCvs')}</p>
            <Link to="/app/cvs" className="btn-primary btn-lg">{t('analysis.addCv')}</Link>
          </div>
        ) : (
          <form onSubmit={run} className="card shadow-lift">
            <fieldset disabled={running} className="min-w-0">
              <label htmlFor="cv" className="lbl">{t('interview.cvLabel')}</label>
              <select id="cv" value={cvId} onChange={(e) => setCvId(e.target.value)} className="field appearance-auto mb-5">
                {cvs.map((cv) => (
                  <option key={cv.id} value={cv.id}>{cv.name}</option>
                ))}
              </select>

              <label htmlFor="vac" className="lbl">{t('interview.vacancyLabel')}</label>
              <select id="vac" value={vacancyId} onChange={(e) => setVacancyId(e.target.value)} className="field appearance-auto mb-5">
                <option value="">{t('analysis.pasteNew')}</option>
                {vacancies.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                    {v.company ? ` — ${v.company}` : ''}
                  </option>
                ))}
              </select>

              {!usingSaved && (
                <>
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 mb-4">
                    <div>
                      <label htmlFor="title" className="lbl">{t('analysis.titleLabel')}</label>
                      <input
                        id="title"
                        value={title}
                        maxLength={LIMITS.VACANCY_TITLE_MAX}
                        onChange={(e) => { setTitle(e.target.value); setPastedId(null); }}
                        placeholder={t('analysis.titlePlaceholder')}
                        className="field"
                      />
                    </div>
                    <div>
                      <label htmlFor="company" className="lbl">
                        {t('analysis.companyLabel')} <span className="lbl-optional">{t('common.optional')}</span>
                      </label>
                      <input
                        id="company"
                        value={company}
                        maxLength={LIMITS.VACANCY_COMPANY_MAX}
                        onChange={(e) => { setCompany(e.target.value); setPastedId(null); }}
                        className="field"
                      />
                    </div>
                  </div>
                  <label htmlFor="vtext" className="lbl">{t('analysis.textLabel')}</label>
                  <textarea
                    id="vtext"
                    value={text}
                    onChange={(e) => { setText(e.target.value); setPastedId(null); }}
                    rows={7}
                    placeholder={t('analysis.textPlaceholder')}
                    className="field min-h-[10rem] resize-y leading-normal"
                  />
                  <p className={`mt-2 font-mono text-[13px] font-semibold ${chars > LIMITS.VACANCY_TEXT_MAX ? 'text-warn-strong' : 'text-ink-soft'}`}>
                    {t('cvs.chars', { count: chars, max: LIMITS.VACANCY_TEXT_MAX })}
                  </p>
                </>
              )}

              <div className="flex flex-wrap gap-4 items-center justify-between mt-6 pt-6 border-t border-line">
                <p className="flex items-center gap-2 text-sm text-ink-soft max-w-[440px]">
                  <Icon.shield className="w-[18px] h-[18px] shrink-0 text-accent" />
                  {t('interview.startHint')}
                </p>
                <button type="submit" disabled={!canRun} className="btn-primary btn-lg w-full sm:w-auto">
                  {running ? t('interview.preparing', { seconds }) : t('interview.start')}
                  {!running && <Icon.arrowRight className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </fieldset>
            {running && (
              <p role="status" aria-live="polite" className="mt-4 flex items-center gap-2.5 text-sm text-ink-soft">
                <span className="w-2.5 h-2.5 rounded-full bg-sun animate-blink" aria-hidden="true" />
                {t('interview.preparingHint')}
              </p>
            )}
          </form>
        )}
      </main>
    </div>
  );
};
