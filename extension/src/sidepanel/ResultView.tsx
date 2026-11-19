import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createCv, type Analysis } from '../../../frontend/src/lib/api.js';
import { apiErrorMessage } from '../../../frontend/src/lib/apiErrors.js';
import { downloadCvPdf } from '../../../frontend/src/lib/download.js';
import { activeFlags } from '../../../frontend/src/lib/flagged.js';
import { LIMITS } from '../../../frontend/src/lib/limits.js';
import { ErrorAlert, Icon, OkAlert, ScoreRing } from '../../../frontend/src/components/ui.js';
import { CoverLetterCard } from '../../../frontend/src/components/CoverLetterCard.js';
import { openUrl } from '../chromeApi.js';
import { siteLink } from './siteUrl.js';

const Chips: React.FC<{ items: string[]; cls: string; empty: string }> = ({ items, cls, empty }) =>
  items.length === 0 ? (
    <p className="text-[14px] text-ink-muted">{empty}</p>
  ) : (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <span key={s} className={`${cls} text-[13px] py-1`}>{s}</span>
      ))}
    </div>
  );

/** A compact analysis result for the side panel; the full page stays one click away. */
export const ResultView: React.FC<{ analysis: Analysis; fromCache: boolean }> = ({ analysis, fromCache }) => {
  const { t } = useTranslation();
  const r = analysis.result;
  const [improved, setImproved] = useState(r.improvedCv);
  const [busy, setBusy] = useState<null | 'pdf' | 'saving'>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const flags = useMemo(() => activeFlags(improved, analysis.flagged), [improved, analysis.flagged]);
  const cvName = `${analysis.cvName} → ${analysis.vacancyTitle}`.slice(0, LIMITS.CV_NAME_MAX);

  const downloadPdf = async () => {
    setError(null);
    setBusy('pdf');
    try {
      await downloadCvPdf({ name: cvName, text: improved });
    } catch {
      setError(t('cvs.downloadFailed'));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(improved);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('errors.generic'));
    }
  };

  const saveAsCv = async () => {
    setError(null);
    setNotice(null);
    setBusy('saving');
    try {
      const cv = await createCv({ name: cvName, text: improved.trim().slice(0, LIMITS.CV_TEXT_MAX) });
      setNotice(t('analysis.savedAsCv', { name: cv.name }));
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section className="card" aria-labelledby="res-h">
        {fromCache && <p className="eyebrow mb-2">{t('ext.lastResult')}</p>}
        <div className="flex items-center gap-4 mb-3">
          <ScoreRing score={r.matchScore} size={96} />
          <p id="res-h" className="text-[14px] leading-normal text-ink-soft min-w-0">{r.summary}</p>
        </div>
        <p className="mb-1.5 text-[13px] font-semibold text-ink-muted">{t('analysis.matchedTitle')}</p>
        <div className="mb-3">
          <Chips items={r.matchedSkills} cls="chip-ok" empty={t('analysis.none')} />
        </div>
        <p className="mb-1.5 text-[13px] font-semibold text-ink-muted">{t('analysis.missingTitle')}</p>
        <Chips items={r.missingSkills.map((m) => m.skill)} cls="chip-miss" empty={t('analysis.none')} />
        {r.missingSkills.length > 0 && (
          <details className="mt-3">
            <summary className="text-[13px] link cursor-pointer">{t('ext.gaps')}</summary>
            <ul className="mt-2 flex flex-col gap-2">
              {r.missingSkills.map((m) => (
                <li key={m.skill} className="p-3 rounded-xl bg-sun-wash text-[13px] leading-normal">
                  <strong className="font-display">{m.skill}.</strong> {m.advice}
                </li>
              ))}
            </ul>
          </details>
        )}
        <button type="button" onClick={() => openUrl(siteLink(`/app/analyses/${analysis.id}`))} className="mt-3 text-[13px] link">
          {t('ext.openFull')} →
        </button>
      </section>

      <section className="card" aria-labelledby="cv-res-h">
        <h2 id="cv-res-h" className="font-display font-extrabold text-[18px] mb-2">{t('analysis.improvedCv')}</h2>
        {flags.length > 0 ? (
          <div role="alert" className="alert-warn mb-3 rounded-[14px] text-[14px]">
            <Icon.warn className="w-5 h-5 shrink-0 mt-px" />
            <p>
              <strong>{t('analysis.flaggedTitle')}</strong> {t('analysis.flaggedText', { terms: flags.map((f) => `«${f}»`).join(', ') })}
            </p>
          </div>
        ) : (
          <div className="alert-ok mb-3 rounded-[14px] text-[14px]">
            <Icon.shield className="w-5 h-5 shrink-0 mt-px" />
            <p>{t('analysis.noFlags')}</p>
          </div>
        )}
        <label htmlFor="improved" className="block mb-1.5 text-[13px] text-ink-muted">{t('analysis.improvedHint')}</label>
        <textarea
          id="improved"
          value={improved}
          onChange={(e) => setImproved(e.target.value)}
          rows={10}
          className="w-full p-3 rounded-xl bg-canvas border-[1.5px] border-transparent font-mono text-[12.5px] leading-[1.6] text-ink-2 resize-y focus:outline-none focus:border-accent"
        />
        {error && <ErrorAlert className="mt-3">{error}</ErrorAlert>}
        {notice && <OkAlert className="mt-3">{notice}</OkAlert>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void downloadPdf()} disabled={busy !== null || !improved.trim()} className="btn-accent btn-sm min-h-[40px]">
            <Icon.download className="w-4 h-4" /> {busy === 'pdf' ? t('cvs.downloading') : t('ext.downloadCv')}
          </button>
          <button type="button" onClick={() => void copy()} disabled={!improved.trim()} className="btn-outline btn-sm min-h-[40px]">
            <Icon.copy className="w-4 h-4" /> {copied ? t('analysis.copied') : t('analysis.copy')}
          </button>
          <button type="button" onClick={() => void saveAsCv()} disabled={busy !== null || !improved.trim()} className="btn-secondary btn-sm min-h-[40px] col-span-2">
            <Icon.plus className="w-4 h-4" /> {busy === 'saving' ? t('cvs.saving') : t('analysis.saveAsCv')}
          </button>
        </div>
      </section>

      <CoverLetterCard analysis={analysis} />
    </>
  );
};
