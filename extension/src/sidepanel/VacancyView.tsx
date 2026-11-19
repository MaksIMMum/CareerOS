import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createAnalysis, createCv, getAnalysis, listCvs, type Analysis, type CvSummary } from '../../../frontend/src/lib/api.js';
import { apiErrorMessage } from '../../../frontend/src/lib/apiErrors.js';
import { LIMITS } from '../../../frontend/src/lib/limits.js';
import { extractPdfText, PdfExtractError } from '../../../frontend/src/lib/pdf.js';
import { ErrorAlert, Icon, OkAlert } from '../../../frontend/src/components/ui.js';
import {
  getActiveTab,
  getSavedAnalysis,
  getTracked,
  insertLetterIntoTab,
  isApplyMessage,
  openUrl,
  readTab,
  saveAnalysis,
  setScoreBadge,
  takePendingApply,
  vacancyKey,
  watchApplies,
} from '../chromeApi.js';
import { isVacancyUrl, readVacancy, siteOf, vacancyFromSelection, type PageVacancy } from '../sites.js';
import { ResultView } from './ResultView.js';
import { siteLink } from './siteUrl.js';
import { TrackerCard } from './TrackerCard.js';

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
  /** The CV version saved from the improved text here — the one the user will actually send. */
  const [savedCv, setSavedCv] = useState<{ id: string; name: string } | null>(null);
  const [trackedId, setTrackedId] = useState<string | undefined>();
  /** The user just clicked the site's apply button: ask about the tracker. */
  const [applyAsked, setApplyAsked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const readId = useRef(0); // ignores results of older reads when the user switches tabs quickly
  const pageRef = useRef<PageState>(page);
  pageRef.current = page;

  /** Last analysis made from this extension for the vacancy URL, tracker state, pending apply. */
  const loadSaved = async (url: string, tabId: number, id: number) => {
    const [saved, tracked, pending] = await Promise.all([
      getSavedAnalysis(url).catch(() => undefined),
      getTracked(url).catch(() => undefined),
      takePendingApply(url).catch(() => false),
    ]);
    if (readId.current !== id) return;
    setTrackedId(tracked);
    setApplyAsked(pending && !tracked);
    void setScoreBadge(tabId, saved?.score).catch(() => undefined);
    if (!saved) return;
    try {
      const a = await getAnalysis(saved.id);
      if (readId.current === id) {
        setAnalysis(a);
        setFromCache(true);
        if (!Number.isFinite(saved.score)) {
          void saveAnalysis(url, { id: a.id, score: a.result.matchScore }).catch(() => undefined);
          void setScoreBadge(tabId, a.result.matchScore).catch(() => undefined);
        }
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
    setSavedCv(null);
    setTrackedId(undefined);
    setApplyAsked(false);
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
      void watchApplies(tab.id).catch(() => undefined);
      await loadSaved(vacancy.url, tab.id, id);
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
    // The page's apply watcher: an "apply" click on the vacancy shown here → ask about the tracker.
    const onMessage = (message: unknown, sender: chrome.runtime.MessageSender) => {
      const current = pageRef.current;
      if (sender.id !== chrome.runtime.id || !isApplyMessage(message) || current.status !== 'ready') return;
      if (vacancyKey(message.url) !== vacancyKey(current.vacancy.url)) return;
      setApplyAsked(true);
      // Handled here, so drop the copy the background keeps for a closed panel (it writes it at the same time).
      window.setTimeout(() => void takePendingApply(message.url).catch(() => undefined), 800);
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.runtime.onMessage.addListener(onMessage);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.runtime.onMessage.removeListener(onMessage);
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

  /** A CV PDF chosen in the panel: extract the text locally, save it as a CV version, select it. */
  const onPdfChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file) return;
    setError(null);
    setUploadNotice(null);
    setUploading(true);
    try {
      const { text } = await extractPdfText(file);
      if (text.length > LIMITS.CV_TEXT_MAX) {
        setError(t('cvs.tooLong', { over: text.length - LIMITS.CV_TEXT_MAX, max: LIMITS.CV_TEXT_MAX }));
        return;
      }
      const name = file.name.replace(/\.pdf$/i, '').trim().slice(0, LIMITS.CV_NAME_MAX) || 'CV';
      const cv = await createCv({ name, text });
      setCvs((list) => [cv, ...(list ?? []).filter((c) => c.id !== cv.id)]);
      setCvId(cv.id);
      setUploadNotice(t('ext.uploadedPdf', { name: cv.name }));
    } catch (err) {
      setError(err instanceof PdfExtractError ? t(`cvs.pdfErrors.${err.code}`) : apiErrorMessage(err, t));
    } finally {
      setUploading(false);
    }
  };

  const uploadButton = (
    <>
      <input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void onPdfChosen(e)} />
      <button
        type="button"
        onClick={() => pdfInput.current?.click()}
        disabled={uploading || running}
        className="btn-secondary btn-sm min-h-[36px]"
      >
        <Icon.plus className="w-4 h-4" /> {uploading ? t('ext.uploadingPdf') : t('ext.uploadPdf')}
      </button>
    </>
  );

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
      setSavedCv(null);
      await saveAnalysis(url, { id: a.id, score: a.result.matchScore }).catch(() => undefined);
      void setScoreBadge(page.tabId, a.result.matchScore).catch(() => undefined);
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
              <div className="flex flex-wrap gap-2">
                {uploadButton}
                <button type="button" onClick={() => openUrl(siteLink('/app/cvs'))} className="link text-[14px]">
                  {t('ext.addCv')}
                </button>
              </div>
              <p className="hint">{t('ext.uploadHint')}</p>
            </div>
          ) : (
            <>
              <select id="cv" value={cvId} onChange={(e) => setCvId(e.target.value)} disabled={running || uploading} className="field appearance-auto mb-2">
                {cvs.map((cv) => (
                  <option key={cv.id} value={cv.id}>{cv.name}</option>
                ))}
              </select>
              <div className="mb-3">{uploadButton}</div>
              {uploadNotice && <div className="mb-3"><OkAlert>{uploadNotice}</OkAlert></div>}
              <button type="button" onClick={() => void analyse()} disabled={running || !cvId} className="btn-primary w-full">
                {running ? t('ext.analysing', { seconds }) : analysis ? t('ext.reanalyse') : t('ext.analyse')}
              </button>
              {!analysis && !running && <p className="hint">{t('ext.privacy')}</p>}
            </>
          )}
        </section>
      )}

      {error && <ErrorAlert>{error}</ErrorAlert>}

      {/* Tracker: asked right after an "apply" click on the page, otherwise once there is a result. */}
      {page.status === 'ready' && (applyAsked || trackedId || (analysis && !running)) && (
        <TrackerCard
          vacancy={page.vacancy}
          cv={savedCv ?? (analysis ? { id: analysis.cvId, name: analysis.cvName } : cvs?.find((c) => c.id === cvId))}
          vacancyId={analysis?.vacancyId ?? null}
          trackedId={trackedId}
          asked={applyAsked}
          onTracked={(id) => {
            setTrackedId(id);
            setApplyAsked(false);
          }}
          onDismiss={() => setApplyAsked(false)}
        />
      )}

      {/* 3. Result */}
      {page.status === 'ready' && analysis && !running && (
        <ResultView
          key={analysis.id}
          analysis={analysis}
          fromCache={fromCache}
          onSavedCv={setSavedCv}
          onInsertLetter={async (letter) => (await insertLetterIntoTab(page.tabId, letter)).status === 'inserted'}
        />
      )}
    </>
  );
};
