import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createCv, getAnalysis, shareAnalysis, type Analysis } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { activeFlags, highlight } from '../lib/flagged.js';
import { LIMITS } from '../lib/limits.js';
import { ErrorAlert, Icon, OkAlert, ScoreRing, scoreColor } from '../components/ui.js';

const Chips: React.FC<{ items: string[]; cls: string; empty: string }> = ({ items, cls, empty }) =>
  items.length === 0 ? (
    <p className="text-[15px] text-ink-muted">{empty}</p>
  ) : (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <span key={s} className={cls}>{s}</span>
      ))}
    </div>
  );

export const AnalysisResultPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const location = useLocation();
  const fromState = (location.state as { analysis?: Analysis } | null)?.analysis;

  const [analysis, setAnalysis] = useState<Analysis | null>(fromState?.id === id ? fromState : null);
  const [improved, setImproved] = useState(fromState?.id === id ? fromState.result.improvedCv : '');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<null | 'cv' | 'link'>(null);
  const [busy, setBusy] = useState<null | 'saving' | 'sharing'>(null);
  const [share, setShare] = useState<{ shareId: string; scores: { before: number; after: number } } | null>(null);

  useEffect(() => {
    if (analysis) return;
    getAnalysis(id)
      .then((a) => {
        setAnalysis(a);
        setImproved(a.result.improvedCv);
      })
      .catch((err) => setError(apiErrorMessage(err, t)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (analysis?.shareId && analysis.shareScores) setShare({ shareId: analysis.shareId, scores: analysis.shareScores });
  }, [analysis]);

  const flags = useMemo(() => (analysis ? activeFlags(improved, analysis.flagged) : []), [improved, analysis]);

  if (!analysis) {
    return (
      <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-10">
        {error ? <ErrorAlert>{error}</ErrorAlert> : <p className="text-sm text-ink-muted">{t('analysis.loading')}</p>}
      </main>
    );
  }

  const r = analysis.result;
  const shareUrl = share ? `${window.location.origin}/s/${share.shareId}` : '';
  const shareText = share ? t('analysis.shareText', { title: analysis.vacancyTitle, before: share.scores.before, after: share.scores.after }) : '';

  const copyText = async (text: string, what: 'cv' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError(t('errors.generic'));
    }
  };

  const saveAsCv = async () => {
    setError(null);
    setNotice(null);
    setBusy('saving');
    try {
      const name = `${analysis.cvName} → ${analysis.vacancyTitle}`.slice(0, LIMITS.CV_NAME_MAX);
      const cv = await createCv({ name, text: improved.trim().slice(0, LIMITS.CV_TEXT_MAX) });
      setNotice(t('analysis.savedAsCv', { name: cv.name }));
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const doShare = async () => {
    setError(null);
    setBusy('sharing');
    try {
      setShare(await shareAnalysis(analysis.id));
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const date = new Date(analysis.createdAt).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <main className="flex-1 max-w-[1240px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <Link to="/app/analyses/new" className="inline-flex items-center gap-1.5 min-h-[44px] mb-3 text-[15px] text-accent no-underline hover:text-accent-hover">
        <Icon.arrowLeft className="w-4 h-4" /> {t('analysis.backToNew')}
      </Link>

      {/* Header: score + title + actions */}
      <section className="card sm:p-8 flex flex-wrap gap-8 items-center mb-6">
        <div className="flex-none flex items-center gap-5 sm:gap-6 mx-auto sm:mx-0">
          <ScoreRing score={r.matchScore} size={136} />
          {share && (
            <div className="px-4 py-3.5 rounded-xl bg-accent-wash text-center">
              <p className="mb-1 text-xs text-ink-soft">{t('analysis.improvedScore')}</p>
              <p className={`font-mono font-bold text-[32px] leading-none ${scoreColor(share.scores.after)}`}>{share.scores.after}</p>
            </div>
          )}
        </div>
        <div className="flex-[1_1_420px] min-w-0">
          <p className="eyebrow mb-3.5 break-words">
            {analysis.cvName}
            {analysis.company ? ` → ${analysis.company}` : ''} · {date}
          </p>
          <h1 className="mb-3 font-display font-extrabold text-[26px] sm:text-[32px] leading-[1.15] tracking-[-0.02em] break-words">{analysis.vacancyTitle}</h1>
          <p className="mb-5 text-base sm:text-[17px] leading-[1.55] text-ink-soft">{r.summary}</p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
            <button type="button" onClick={() => void saveAsCv()} disabled={busy !== null || improved.trim() === ''} className="btn-primary">
              <Icon.plus className="w-4 h-4" /> {busy === 'saving' ? t('cvs.saving') : t('analysis.saveAsCv')}
            </button>
            {!share && (
              <button type="button" onClick={() => void doShare()} disabled={busy !== null} className="btn-secondary">
                <Icon.share className="w-4 h-4" /> {busy === 'sharing' ? t('analysis.sharing') : t('analysis.share')}
              </button>
            )}
            <button type="button" disabled title={t('common.soon')} className="btn-secondary">
              {t('analysis.addToTracker')} <span className="font-mono text-[11px] uppercase text-ink-muted">{t('common.soon')}</span>
            </button>
            <button type="button" disabled title={t('common.soon')} className="btn-secondary">
              {t('analysis.practise')} <span className="font-mono text-[11px] uppercase text-ink-muted">{t('common.soon')}</span>
            </button>
          </div>
        </div>
      </section>

      {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}
      {notice && (
        <OkAlert className="mb-6">
          {notice}{' '}
          <Link to="/app/cvs" className="font-semibold underline text-accent-ink">{t('nav.cvs')} →</Link>
        </OkAlert>
      )}

      {/* Share link */}
      {share && (
        <section className="card mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
            <h2 className="section-title">{t('analysis.shareTitle')}</h2>
            <p className="font-mono font-bold text-2xl">
              <span className="text-ink-faint">{share.scores.before}</span>
              <span className="text-ink-faint mx-2">→</span>
              <span className={scoreColor(share.scores.after)}>{share.scores.after}</span>
            </p>
          </div>
          <p className="mb-4 text-[15px] text-ink-muted">{t('analysis.shareHint')}</p>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} aria-label={t('analysis.shareTitle')} className="field flex-1 min-w-0 bg-canvas font-mono text-sm" />
            <button type="button" onClick={() => void copyText(shareUrl, 'link')} className="btn-secondary min-h-[52px]">
              <Icon.copy className="w-4 h-4" /> {copied === 'link' ? t('analysis.copied') : t('analysis.copyLink')}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              {t('analysis.shareTelegram')}
            </a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              {t('analysis.shareLinkedIn')}
            </a>
          </div>
        </section>
      )}

      {/* Skills */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-6 mb-6">
        <section className="card">
          <p className="eyebrow mb-3.5">{t('analysis.matched', { count: r.matchedSkills.length })}</p>
          <Chips items={r.matchedSkills} cls="chip-ok" empty={t('analysis.none')} />
        </section>
        <section className="card">
          <p className="eyebrow mb-3.5">{t('analysis.missing', { count: r.missingSkills.length })}</p>
          <div className="mb-5">
            <Chips items={r.missingSkills.map((m) => m.skill)} cls="chip-miss" empty={t('analysis.none')} />
          </div>
          <p className="eyebrow mb-2.5">{t('analysis.keywords')}</p>
          <Chips items={r.missingKeywords} cls="chip-kw" empty={t('analysis.none')} />
        </section>
      </div>

      {/* How to close the gaps */}
      {r.missingSkills.length > 0 && (
        <section className="card mb-6">
          <h2 className="section-title mb-1.5">{t('analysis.gapsTitle')}</h2>
          <p className="mb-5 text-ink-muted">{t('analysis.gapsLead')}</p>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
            {r.missingSkills.map((m) => (
              <div key={m.skill} className="p-5 rounded-xl bg-warn-wash border border-warn-line">
                <p className="mb-2 font-display font-bold text-base text-warn">{m.skill}</p>
                <p className="text-[15px] leading-normal text-ink-soft">{m.advice}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stronger wording */}
      {r.weakBullets.length > 0 && (
        <section className="card mb-6">
          <h2 className="section-title mb-5">{t('analysis.weakBullets')}</h2>
          <div className="flex flex-col gap-4">
            {r.weakBullets.map((b, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-2 border border-line rounded-xl overflow-hidden">
                <div className="p-5 bg-subtle">
                  <p className="eyebrow mb-2">{t('analysis.before')}</p>
                  <p className="text-base leading-normal text-ink-muted">{b.original}</p>
                </div>
                <div className="p-5 bg-accent-wash">
                  <p className="eyebrow mb-2 text-accent-ink">{t('analysis.after')}</p>
                  <p className="mb-2.5 text-base leading-normal">{b.rewritten}</p>
                  <p className="text-sm text-ink-muted">{t('analysis.why', { why: b.why })}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Improved CV + post-check */}
      <section className="card">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
          <h2 className="section-title">{t('analysis.improvedCv')}</h2>
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => void copyText(improved, 'cv')} className="btn-secondary">
              <Icon.copy className="w-4 h-4" /> {copied === 'cv' ? t('analysis.copied') : t('analysis.copy')}
            </button>
            <button type="button" onClick={() => void saveAsCv()} disabled={busy !== null || improved.trim() === ''} className="btn-dark">
              {busy === 'saving' ? t('cvs.saving') : t('analysis.saveAsCv')}
            </button>
          </div>
        </div>

        {flags.length > 0 ? (
          <div role="alert" className="alert-warn mb-4">
            <Icon.warn className="w-5 h-5 shrink-0 mt-px" />
            <p>
              <strong>{t('analysis.flaggedTitle')}</strong> {t('analysis.flaggedText', { terms: flags.map((f) => `«${f}»`).join(', ') })}
            </p>
          </div>
        ) : (
          <div className="alert-ok mb-4">
            <Icon.shield className="w-5 h-5 shrink-0 mt-px" />
            <p>{t('analysis.noFlags')}</p>
          </div>
        )}

        <label htmlFor="improved" className="block mb-2 text-sm text-ink-muted">{t('analysis.improvedHint')}</label>
        <textarea
          id="improved"
          value={improved}
          onChange={(e) => setImproved(e.target.value)}
          rows={16}
          className="w-full p-5 sm:p-6 rounded-xl bg-canvas border border-line font-mono text-[14px] sm:text-[15px] leading-[1.65] text-ink-2 resize-y focus:outline-none focus:ring-2 focus:ring-accent"
        />
        {flags.length > 0 && (
          <div className="mt-3 p-5 rounded-xl bg-white border border-warn-line font-mono text-[13px] leading-relaxed whitespace-pre-wrap max-h-72 overflow-auto text-ink-2">
            {highlight(improved, flags).map((seg, i) =>
              seg.flagged ? (
                <mark key={i} className="bg-warn-chip text-warn rounded px-0.5">{seg.text}</mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  );
};
