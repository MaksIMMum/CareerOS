import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  createAnalysis,
  getVacancy,
  importVacancy,
  listCvs,
  listVacancies,
  type CvSummary,
  type VacancySummary,
} from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { downloadVacancyPdf } from '../lib/download.js';
import { LIMITS } from '../lib/limits.js';
import { ErrorAlert, Icon, PageHero } from '../components/ui.js';

const STEPS = ['reading', 'comparing', 'rewriting', 'checking'] as const;

/** Shown while the AI works (~5–20 s): a dark card, a yellow bar that never reaches 100 early, step checklist. */
const Progress: React.FC<{ seconds: number }> = ({ seconds }) => {
  const { t } = useTranslation();
  const current = Math.min(STEPS.length - 1, Math.floor(seconds / 4));
  const pct = Math.min(95, Math.round(100 * (1 - Math.exp(-seconds / 8))));
  return (
    <section role="status" aria-live="polite" className="mt-6 rounded-3xl bg-night text-white px-6 py-7 sm:px-8 flex flex-wrap gap-7 items-center">
      <div className="flex items-center gap-3.5 shrink-0">
        <span className="w-3 h-3 rounded-full bg-sun animate-blink" />
        <p className="font-display font-extrabold text-xl leading-tight">
          {t('analysis.progress.title')}{' '}
          <span className="font-mono font-medium text-[13px] text-night-muted">{t('analysis.progress.elapsed', { seconds })}</span>
        </p>
      </div>
      <div className="flex-[1_1_420px] min-w-0">
        <div className="h-2.5 rounded-full bg-night-line overflow-hidden mb-3.5">
          <div className="h-full bg-sun rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <ul className="flex flex-wrap gap-x-[22px] gap-y-2 text-sm">
          {STEPS.map((step, i) => (
            <li key={step} className={`inline-flex items-center gap-1.5 ${i < current ? 'text-sun font-semibold' : i === current ? 'text-white font-semibold' : 'text-ink-faint'}`}>
              {i < current && <Icon.check className="w-4 h-4" />}
              {t(`analysis.progress.${step}`)}
              {i === current && '…'}
            </li>
          ))}
        </ul>
      </div>
    </section>
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
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
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

  /** Keep the link only if it is the one the fields were filled from. */
  const importedUrl = imported && url.trim() === imported ? imported : '';

  const doImport = async () => {
    const link = url.trim();
    if (!link || importing) return;
    setError(null);
    setImported(null);
    setImporting(true);
    try {
      const v = await importVacancy(link);
      setTitle(v.title);
      setCompany(v.company);
      setText(v.text);
      setUrl(v.url);
      setImported(v.url);
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setImporting(false);
    }
  };

  const canDownload = usingSaved || (title.trim() !== '' && chars > 0);
  const downloadPdf = async () => {
    setError(null);
    setDownloading(true);
    try {
      const v = usingSaved
        ? await getVacancy(vacancyId)
        : { title: title.trim(), company: company.trim(), url: importedUrl, text: text.trim() };
      await downloadVacancyPdf(v);
    } catch {
      setError(t('cvs.downloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

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
          : { cvId, lang, vacancy: { title: title.trim(), company: company.trim(), url: importedUrl, text: text.trim() } },
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
    <div className="flex-1">
      <PageHero
        overlap
        title={
          <>
            {t('analysis.newTitleA')}
            <span className="mark-sun">{t('analysis.newTitleMark')}</span>
          </>
        }
        lead={t('analysis.newLead')}
        aside={
          <div className="flex flex-col items-start gap-3">
            <Link to="/app/analyses" className="text-[15px] font-semibold text-white hover:text-sun no-underline">
              {t('analysis.history')} →
            </Link>
            <div className="px-[18px] py-3.5 rounded-2xl bg-white/15">
              <p className="mb-1.5 font-mono text-xs text-white">{t('analysis.quotaLabel')}</p>
              <p className="font-mono font-bold text-base">{t('analysis.quotaValue', { limit: 10 })}</p>
            </div>
          </div>
        }
      />

      <main className="relative max-w-[1240px] mx-auto -mt-16 sm:-mt-20 px-4 sm:px-6 pb-16">
        {error && <ErrorAlert className="mb-6 shadow-lift">{error}</ErrorAlert>}

        {cvs === null ? (
          <div className="card shadow-lift"><p className="text-sm text-ink-muted">{t('analysis.loading')}</p></div>
        ) : cvs.length === 0 ? (
          <div className="card shadow-lift text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-sun-wash text-ink flex items-center justify-center">
              <Icon.doc className="w-7 h-7" />
            </div>
            <p className="mb-5 text-[17px] text-ink-soft">{t('analysis.noCvs')}</p>
            <Link to="/app/cvs" className="btn-primary btn-lg">{t('analysis.addCv')}</Link>
          </div>
        ) : (
          <form onSubmit={run}>
            <fieldset disabled={running} className="flex flex-wrap gap-6 items-start min-w-0">
              {/* 1. CV */}
              <section aria-labelledby="cvh" className="card shadow-lift flex-[1_1_340px] min-w-0">
                <div className="flex items-center gap-3 mb-5">
                  <span className="num-badge" aria-hidden="true">1</span>
                  <h2 id="cvh" className="font-display font-extrabold text-[21px]">{t('analysis.step1')}</h2>
                </div>
                <div role="radiogroup" aria-labelledby="cvh" className="flex flex-col gap-2.5 mb-[18px]">
                  {cvs.map((cv) => {
                    const on = cv.id === cvId;
                    return (
                      <button
                        key={cv.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setCvId(cv.id)}
                        className={`flex items-center gap-3.5 w-full text-left p-4 rounded-2xl border-2 ${on ? 'border-accent bg-accent-wash' : 'border-line bg-white hover:bg-canvas'}`}
                      >
                        <span aria-hidden="true" className={`w-10 h-12 rounded-lg shrink-0 flex justify-center pt-2 ${on ? 'bg-accent-ring' : 'bg-[#F1F2F5]'}`}>
                          <span className={`w-[22px] h-1 rounded-sm ${on ? 'bg-accent' : 'bg-line-dashed'}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-display font-bold text-base leading-snug truncate">{cv.name}</span>
                          <span className="block text-[13px] text-ink-muted">{t('analysis.cvMeta', { date: fmt(cv.updatedAt) })}</span>
                        </span>
                        <span aria-hidden="true" className={`w-[22px] h-[22px] rounded-full border-2 shrink-0 ${on ? 'border-accent bg-accent shadow-[inset_0_0_0_3px_#fff]' : 'border-line-dashed bg-white'}`} />
                      </button>
                    );
                  })}
                </div>
                <div className="relative p-[22px] border-2 border-dashed border-line-dashed rounded-2xl text-center bg-subtle overflow-hidden">
                  <span aria-hidden="true" className="absolute right-4 top-3.5 px-[7px] py-[3px] rounded-[5px] bg-warn-strong text-white font-mono font-bold text-[10px] -rotate-[4deg] animate-float-a">PDF</span>
                  <Icon.upload className="w-[30px] h-[30px] mx-auto text-accent" />
                  <p className="mt-2 mb-1 font-display font-bold text-base">{t('analysis.dropTitle')}</p>
                  <p className="mb-3.5 text-[13px] text-ink-muted">{t('analysis.dropHint')}</p>
                  <Link to="/app/cvs" className="btn-outline btn-sm min-h-[44px] px-[18px]">{t('analysis.addCv')}</Link>
                </div>
              </section>

              {/* 2. Vacancy */}
              <section aria-labelledby="vh" className="card shadow-lift flex-[2_1_520px] min-w-0">
                <div className="flex items-center gap-3 mb-5">
                  <span className="num-badge" aria-hidden="true">2</span>
                  <h2 id="vh" className="font-display font-extrabold text-[21px]">{t('analysis.step2')}</h2>
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
                    <div className="mb-5 p-4 rounded-2xl bg-subtle border border-line">
                      <label htmlFor="vurl" className="lbl">
                        {t('vacancyImport.label')} <span className="lbl-optional">{t('common.optional')}</span>
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          id="vurl"
                          type="url"
                          inputMode="url"
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault(); // don't submit the analysis form
                              void doImport();
                            }
                          }}
                          placeholder={t('vacancyImport.placeholder')}
                          className="field flex-1 min-w-0"
                        />
                        <button type="button" onClick={() => void doImport()} disabled={importing || url.trim() === ''} className="btn-outline shrink-0">
                          <Icon.link className="w-4 h-4" /> {importing ? t('vacancyImport.importing') : t('vacancyImport.button')}
                        </button>
                      </div>
                      <p className="hint" aria-live="polite">
                        {imported ? t('vacancyImport.done', { site: new URL(imported).hostname.replace(/^www\./, '') }) : t('vacancyImport.hint')}
                      </p>
                    </div>
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
                    <label htmlFor="vtext" className="lbl">{t('analysis.textLabel')}</label>
                    <textarea id="vtext" value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={t('analysis.textPlaceholder')} className="field min-h-[12rem] resize-y leading-normal" />
                    <div className="flex items-center gap-3 mt-2.5">
                      <div className="flex-1 h-1.5 rounded-full bg-[#ECEEF2] overflow-hidden" aria-hidden="true">
                        <div className={`h-full ${over > 0 ? 'bg-warn-strong' : 'bg-accent'}`} style={{ width: `${Math.min(100, (chars / LIMITS.VACANCY_TEXT_MAX) * 100)}%` }} />
                      </div>
                      <span className={`font-mono text-[13px] font-semibold ${over > 0 ? 'text-warn-strong' : 'text-ink-soft'}`}>
                        {t('cvs.chars', { count: chars, max: LIMITS.VACANCY_TEXT_MAX })}
                      </span>
                    </div>
                  </>
                )}

                {canDownload && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <button type="button" onClick={() => void downloadPdf()} disabled={downloading || running} className="btn-secondary btn-sm min-h-[40px]">
                      <Icon.download className="w-4 h-4" /> {downloading ? t('vacancyImport.downloading') : t('vacancyImport.downloadPdf')}
                    </button>
                    <span className="text-[13px] text-ink-muted">{t('vacancyImport.downloadPdfHint')}</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 items-center justify-between mt-6 pt-6 border-t border-line">
                  <p className="flex items-center gap-2 text-sm text-ink-soft max-w-[400px]">
                    <Icon.shield className="w-[18px] h-[18px] shrink-0 text-accent" />
                    {t('analysis.runHint')}
                  </p>
                  <button type="submit" disabled={!canRun} className="btn-primary btn-lg w-full sm:w-auto">
                    {t('analysis.analyse')} <Icon.arrowRight className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </section>
            </fieldset>
            {running && <Progress seconds={seconds} />}
          </form>
        )}
      </main>
    </div>
  );
};
