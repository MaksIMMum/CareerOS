import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createCoverLetter, type Analysis, type CoverLetter } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { downloadLetterPdf } from '../lib/download.js';
import { activeFlags, highlight } from '../lib/flagged.js';
import { LIMITS } from '../lib/limits.js';
import { ErrorAlert, Icon } from './ui.js';

type Lang = 'uk' | 'en';

/** Cover letter for one analysis: write / rewrite with AI, edit, copy, download as PDF. */
export const CoverLetterCard: React.FC<{ analysis: Analysis; className?: string }> = ({ analysis, className = '' }) => {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<CoverLetter | undefined>(analysis.coverLetter);
  const [text, setText] = useState(analysis.coverLetter?.letter ?? '');
  const [lang, setLang] = useState<Lang>(analysis.coverLetter?.lang ?? analysis.lang);
  const [busy, setBusy] = useState<null | 'writing' | 'downloading'>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flags = useMemo(() => (saved ? activeFlags(text, saved.flagged) : []), [text, saved]);
  const edited = saved !== undefined && text !== saved.letter;

  const write = async () => {
    if (saved && edited && !window.confirm(t('coverLetter.regenerateConfirm'))) return;
    setError(null);
    setBusy('writing');
    try {
      const letter = await createCoverLetter(analysis.id, lang);
      setSaved(letter);
      setText(letter.letter);
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('errors.generic'));
    }
  };

  const download = async () => {
    setError(null);
    setBusy('downloading');
    try {
      const title = t('coverLetter.fileName', {
        title: [analysis.vacancyTitle, analysis.company].filter(Boolean).join(', '),
      });
      await downloadLetterPdf({ title, text });
    } catch {
      setError(t('cvs.downloadFailed'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={`card ${className}`} aria-labelledby="cover-letter-title">
      <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <h2 id="cover-letter-title" className="section-title mb-1">{t('coverLetter.title')}</h2>
          <p className="text-[15px] text-ink-muted">{t('coverLetter.lead')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2.5">
          <div>
            <label htmlFor="cover-letter-lang" className="lbl">{t('coverLetter.langLabel')}</label>
            <select
              id="cover-letter-lang"
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              disabled={busy !== null}
              className="field min-h-[44px] py-2"
            >
              <option value="uk">{t('coverLetter.langUk')}</option>
              <option value="en">{t('coverLetter.langEn')}</option>
            </select>
          </div>
          <button type="button" onClick={() => void write()} disabled={busy !== null} className={saved ? 'btn-outline' : 'btn-accent'}>
            <Icon.edit className="w-4 h-4" />{' '}
            {busy === 'writing' ? t('coverLetter.generating') : saved ? t('coverLetter.regenerate') : t('coverLetter.generate')}
          </button>
        </div>
      </div>

      {error && <ErrorAlert className="mb-4">{error}</ErrorAlert>}

      {!saved ? (
        <p className="text-[13px] text-ink-muted">{t('coverLetter.limitHint', { limit: LIMITS.COVER_LETTERS_PER_DAY })}</p>
      ) : (
        <>
          {flags.length > 0 ? (
            <div role="alert" className="alert-warn mb-4 rounded-[14px]">
              <Icon.warn className="w-5 h-5 shrink-0 mt-px" />
              <p>
                <strong>{t('analysis.flaggedTitle')}</strong> {t('coverLetter.flaggedText', { terms: flags.map((f) => `«${f}»`).join(', ') })}
              </p>
            </div>
          ) : (
            <div className="alert-ok mb-4 rounded-[14px]">
              <Icon.shield className="w-5 h-5 shrink-0 mt-px" />
              <p>{t('coverLetter.noFlags')}</p>
            </div>
          )}

          <label htmlFor="cover-letter-text" className="block mb-2 text-sm text-ink-muted">{t('coverLetter.editHint')}</label>
          <textarea
            id="cover-letter-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            className="w-full p-5 sm:p-6 rounded-2xl bg-canvas border-[1.5px] border-transparent text-[15px] sm:text-base leading-[1.7] text-ink-2 resize-y focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent-ring"
          />
          {flags.length > 0 && (
            <div className="mt-3 p-5 rounded-2xl bg-white border border-warn-line text-[14px] leading-relaxed whitespace-pre-wrap max-h-72 overflow-auto text-ink-2">
              {highlight(text, flags).map((seg, i) =>
                seg.flagged ? (
                  <mark key={i} className="bg-warn-chip text-warn rounded px-0.5">{seg.text}</mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5 justify-end">
            <button type="button" onClick={() => void copy()} disabled={text.trim() === ''} className="btn-outline">
              <Icon.copy className="w-4 h-4" /> {copied ? t('analysis.copied') : t('coverLetter.copy')}
            </button>
            <button type="button" onClick={() => void download()} disabled={busy !== null || text.trim() === ''} className="btn-accent">
              <Icon.download className="w-4 h-4" /> {busy === 'downloading' ? t('coverLetter.downloading') : t('coverLetter.download')}
            </button>
          </div>
        </>
      )}
    </section>
  );
};
