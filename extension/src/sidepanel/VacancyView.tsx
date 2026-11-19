import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createAnalysis, getAnalysis, listCvs, type Analysis, type CvSummary } from '../../../frontend/src/lib/api.js';
import { apiErrorMessage } from '../../../frontend/src/lib/apiErrors.js';
import { ErrorAlert, Icon } from '../../../frontend/src/components/ui.js';
import { getActiveTab, getSavedAnalysisId, openUrl, readTab, saveAnalysisId } from '../chromeApi.js';
import { isVacancyUrl, readVacancy, siteOf, vacancyFromSelection, type PageVacancy } from '../sites.js';
import { ResultView } from './ResultView.js';
import { siteLink } from './siteUrl.js';

type PageState =
  | { status: 'reading' }
  | { status: 'unsupported' }
  | { status: 'notVacancy'; tabId: number; url: string }
  | { status: 'failed'; tabId: number; url: string }
  | { status: 'ready'; tabId: number; vacancy: PageVacancy };

const SITE_NAME = { 'djinni.co': 'Djinni', 'jobs.dou.ua': 'DOU', 'work.ua': 'Work.ua' } as const;

/** The vacancy in the current tab → pick a CV → analysis result, all in the side panel. */
export const VacancyView: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState<PageState>({ status: 'reading' });
  const [cvs, setCvs] = useState<CvSummary[] | null>(null);
  const [cvId, setCvId] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectionHint, setSelectionHint] = useState(false);
  const readId = useRef(0); // ignores results of older reads when the user switches tabs quickly

  /** Shows the last analysis made from this extension for the vacancy URL, if any. */
  const loadSaved = async (url: string, id: number) => {
    const savedId = await getSavedAnalysisId(url).catch(() => undefined);
    if (!savedId) return;
    try {
      const a = await getAnalysis(savedId);
      if (readId.current === id) {
        setAnalysis(a);
        setFromCache(true);
      }
    } catch {
      // deleted or another account: just start fresh
    }
  };

  const readCurrentTab = useCallback(async () => {
    const id = ++readId.current;
    setError(null);
    setSelectionHint(false);
    setAnalysis(null);
    setFromCache(false);
    setPage({ status: 'reading' });

    const tab = await getActiveTab().catch(() => undefined);
    if (readId.current !== id) return;
    if (!tab?.id || !tab.url || !siteOf(tab.url)) return setPage({ status: 'unsupported' });
    if (!isVacancyUrl(tab.url)) return setPage({ status: 'notVacancy', tabId: tab.id, url: tab.url });

    try {
      const html = await readTab(tab.id);
      if (readId.current !== id) return;
      const vacancy = readVacancy(html);
      if (!vacancy) return setPage({ status: 'failed', tabId: tab.id, url: tab.url });
      setPage({ status: 'ready', tabId: tab.id, vacancy });
      await loadSaved(vacancy.url, id);
    } catch {
      if (readId.current === id) setPage({ status: 'failed', tabId: tab.id, url: tab.url });
    }
  }, []);

  // Read the page now, and again whenever the user switches tabs or the tab navigates.
  useEffect(() => {
    void readCurrentTab();
    const onActivated = () => void readCurrentTab();
    const onUpdated = (_id: number, info: { status?: string; url?: string }, tab: chrome.tabs.Tab) => {
      if (tab.active && (info.url || info.status === 'complete')) void readCurrentTab();
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [readCurrentTab]);

  useEffect(() => {
    listCvs()
      .then((list) => {
        setCvs(list);
        if (list[0]) setCvId(list[0].id); // newest first
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

  const takeSelection = async () => {
    if (page.status !== 'failed' && page.status !== 'ready' && page.status !== 'notVacancy') return;
    setSelectionHint(false);
    try {
      const raw = await readTab(page.tabId);
      const vacancy = vacancyFromSelection(raw);
      if (!vacancy) return setSelectionHint(true);
      setAnalysis(null);
      setFromCache(false);
      setPage({ status: 'ready', tabId: page.tabId, vacancy });
    } catch {
      setSelectionHint(true);
    }
  };

  const analyse = async () => {
    if (page.status !== 'ready' || !cvId || running) return;
    setError(null);
    setRunning(true);
    try {
      const { title, company, url, text } = page.vacancy;
      const a = await createAnalysis({
        cvId,
        lang: i18n.language === 'en' ? 'en' : 'uk',
        vacancy: { title, company, url, text },
      });
      setAnalysis(a);
      setFromCache(false);
      await saveAnalysisId(url, a.id).catch(() => undefined);
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setRunning(false);
    }
  };

  const canUseSelection = page.status === 'failed' || page.status === 'ready' || page.status === 'notVacancy';

  return (
    <>
      {/* 1. Vacancy from the page */}
      <section className="card" aria-labelledby="vac-h">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p id="vac-h" className="eyebrow">{t('ext.vacancy')}</p>
          {page.status !== 'reading' && page.status !== 'unsupported' && (
            <button type="button" onClick={() => void readCurrentTab()} className="text-[13px] link">
              {t('ext.reread')}
            </button>
          )}
        </div>

        {page.status === 'reading' && <p className="text-sm text-ink-muted">{t('ext.reading')}</p>}
        {page.status === 'unsupported' && <p className="text-[15px] text-ink-soft">{t('ext.notSupported')}</p>}
        {page.status === 'notVacancy' && <p className="text-[15px] text-ink-soft">{t('ext.notVacancy')}</p>}
        {page.status === 'failed' && <p className="text-[15px] text-ink-soft">{t('ext.readFailed')}</p>}
        {page.status === 'ready' && (
          <div>
            <p className="font-display font-extrabold text-[18px] leading-snug break-words">{page.vacancy.title}</p>
            <p className="text-[14px] text-ink-muted">
              {[page.vacancy.company, SITE_NAME[page.vacancy.site]].filter(Boolean).join(' · ')} ·{' '}
              {t('ext.chars', { count: page.vacancy.text.length })}
            </p>
            <details className="mt-2">
              <summary className="text-[13px] link cursor-pointer">{t('ext.showText')}</summary>
              <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft bg-canvas rounded-xl p-3">
                {page.vacancy.text}
              </p>
            </details>
          </div>
        )}

        {canUseSelection && (
          <div className="mt-3">
            <button type="button" onClick={() => void takeSelection()} className="btn-secondary btn-sm min-h-[36px]">
              {t('ext.useSelection')}
            </button>
            {selectionHint && <p className="hint">{t('ext.selectionTooShort')}</p>}
          </div>
        )}
      </section>

      {/* 2. CV + analyse */}
      {page.status === 'ready' && (
        <section className="card" aria-labelledby="cv-h">
          <label id="cv-h" htmlFor="cv" className="lbl">{t('ext.cvLabel')}</label>
          {cvs === null ? (
            <p className="text-sm text-ink-muted">{t('common.loading')}</p>
          ) : cvs.length === 0 ? (
            <div>
              <p className="mb-2.5 text-[15px] text-ink-soft">{t('ext.noCvs')}</p>
              <button type="button" onClick={() => openUrl(siteLink('/app/cvs'))} className="btn-accent btn-sm">
                <Icon.plus className="w-4 h-4" /> {t('ext.addCv')}
              </button>
            </div>
          ) : (
            <>
              <select id="cv" value={cvId} onChange={(e) => setCvId(e.target.value)} disabled={running} className="field appearance-auto mb-3">
                {cvs.map((cv) => (
                  <option key={cv.id} value={cv.id}>{cv.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => void analyse()} disabled={running || !cvId} className="btn-primary w-full">
                {running ? t('ext.analysing', { seconds }) : analysis ? t('ext.reanalyse') : t('ext.analyse')}
              </button>
              {!analysis && !running && <p className="hint">{t('ext.privacy')}</p>}
            </>
          )}
        </section>
      )}

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {/* 3. Result */}
      {page.status === 'ready' && analysis && !running && (
        <ResultView key={analysis.id} analysis={analysis} fromCache={fromCache} />
      )}
    </>
  );
};
