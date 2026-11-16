import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createCv, getAnalysis, shareAnalysis, type Analysis } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { activeFlags, highlight } from '../lib/flagged.js';
import { LIMITS } from '../lib/limits.js';
import { ErrorAlert, Icon, OkAlert, Rings, ScoreRing } from '../components/ui.js';
import type { ApplicationPrefill } from '../components/ApplicationDialog.js';
import type { InterviewPrefill } from './NewInterviewPage.js';

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
  const navigate = useNavigate();
  const fromState = (location.state as { analysis?: Analysis } | null)?.analysis;

  const [analysis, setAnalysis] = useState<Analysis | null>(fromState?.id === id ? fromState : null);
  const [improved, setImproved] = useState(fromState?.id === id ? fromState.result.improvedCv : '');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<null | 'cv' | 'link'>(null);
  const [busy, setBusy] = useState<null | 'saving' | 'sharing'>(null);
  const [bullet, setBullet] = useState(0);
  const [share, setShare] = useState<{ shareId: string; scores: { before: number; after: number } } | null>(null);
  /** The improved CV saved as a new version here — that is the one the user will send. */
  const [savedCvId, setSavedCvId] = useState<string | null>(null);

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
      <div className="flex-1">
        <div className="bg-accent h-40" />
        <main className="max-w-[1240px] w-full mx-auto -mt-24 px-4 sm:px-6 pb-10">
          <div className="card shadow-lift">{error ? <ErrorAlert>{error}</ErrorAlert> : <p className="text-sm text-ink-muted">{t('analysis.loading')}</p>}</div>
        </main>
      </div>
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
      setSavedCvId(cv.id);
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

  const addToTracker = () => {
    const prefill: ApplicationPrefill = {
      cvId: savedCvId ?? analysis.cvId,
      vacancyId: analysis.vacancyId,
      company: analysis.company,
      title: analysis.vacancyTitle,
    };
    navigate('/app/tracker', { state: { prefill } });
  };

  const practise = () => {
    const prefill: InterviewPrefill = { cvId: savedCvId ?? analysis.cvId, vacancyId: analysis.vacancyId };
    navigate('/app/interviews/new', { state: { prefill } });
  };

  const date = new Date(analysis.createdAt).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });

  const wb = r.weakBullets[Math.min(bullet, r.weakBullets.length - 1)];
  const onBlueBtn = 'btn bg-transparent text-white border-[1.5px] border-white/50 rounded-xl hover:bg-white/10 hover:text-white';

  return (
    <div className="flex-1">
      {/* Blue header: score, title, summary, actions */}
      <div className="bg-accent text-white relative overflow-hidden">
        <div aria-hidden="true" className="absolute w-[360px] h-[360px] rounded-full bg-sun opacity-[0.18] -right-[100px] -bottom-[180px]" />
        <Rings className="hidden sm:block w-[420px] h-[420px] -left-[160px] -top-[200px]" />
        <div className="relative max-w-[1240px] mx-auto px-4 sm:px-6 pt-5 pb-12 sm:pb-14">
          <Link to="/app/analyses" className="inline-flex items-center gap-1.5 min-h-[44px] mb-3 text-[15px] text-accent-on no-underline hover:text-white">
            <Icon.arrowLeft className="w-4 h-4" /> {t('analysis.history')}
          </Link>
          <div className="flex flex-wrap gap-8 sm:gap-10 items-center">
            <div className="flex items-center gap-[22px] mx-auto sm:mx-0">
              <ScoreRing score={r.matchScore} size={168} onBlue />
              {share && (
                <div className="px-[18px] py-4 rounded-[18px] bg-sun text-ink text-center rotate-3">
                  <p className="mb-1 text-xs font-semibold">{t('analysis.improvedScore')}</p>
                  <p className="font-mono font-bold text-[38px] leading-none">{share.scores.after}</p>
                  {share.scores.after !== share.scores.before && (
                    <p className="mt-1 font-mono font-bold text-xs">
                      {share.scores.after > share.scores.before ? '+' : ''}
                      {share.scores.after - share.scores.before}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex-[1_1_440px] min-w-0">
              <p className="mb-2.5 font-mono text-[13px] text-accent-on break-words">
                {analysis.cvName}
                {analysis.company ? ` → ${analysis.company}` : ''} · {date}
              </p>
              <h1 className="mb-3 font-display font-extrabold text-[28px] sm:text-[40px] leading-[1.08] tracking-[-0.03em] break-words">{analysis.vacancyTitle}</h1>
              <p className="mb-6 text-base sm:text-lg leading-[1.55] text-accent-on max-w-[620px]">{r.summary}</p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
                <button type="button" onClick={() => void saveAsCv()} disabled={busy !== null || improved.trim() === ''} className="btn-primary min-h-[52px] px-[22px] text-base">
                  <Icon.plus className="w-4 h-4" /> {busy === 'saving' ? t('cvs.saving') : t('analysis.saveAsCv')}
                </button>
                {!share && (
                  <button type="button" onClick={() => void doShare()} disabled={busy !== null} className={`${onBlueBtn} min-h-[52px]`}>
                    <Icon.share className="w-4 h-4" /> {busy === 'sharing' ? t('analysis.sharing') : t('analysis.share')}
                  </button>
                )}
                <button type="button" onClick={addToTracker} disabled={busy !== null} className={`${onBlueBtn} min-h-[52px]`}>
                  <Icon.columns className="w-4 h-4" /> {t('analysis.addToTracker')}
                </button>
                <button type="button" onClick={practise} disabled={busy !== null} className={`${onBlueBtn} min-h-[52px]`}>
                  <Icon.chat className="w-4 h-4" /> {t('analysis.practise')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-[1240px] mx-auto px-4 sm:px-6 py-8 pb-16">
        {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}
        {notice && (
          <OkAlert className="mb-6">
            {notice}{' '}
            <Link to="/app/cvs" className="font-semibold underline text-accent-ink">{t('nav.cvs')} →</Link>
          </OkAlert>
        )}

        {/* Share link */}
        {share && (
          <section className="mb-6 rounded-3xl bg-night text-white p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
              <h2 className="font-display font-extrabold text-[22px] sm:text-[26px] leading-tight">{t('analysis.shareTitle')}</h2>
              <p className="font-mono font-bold text-2xl">
                <span className="text-ink-faint">{share.scores.before}</span>
                <span className="text-ink-faint mx-2">→</span>
                <span className="text-sun">{share.scores.after}</span>
              </p>
            </div>
            <p className="mb-5 text-[15px] text-night-text">{t('analysis.shareHint')}</p>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} aria-label={t('analysis.shareTitle')} className="field flex-1 min-w-0 font-mono text-sm" />
              <button type="button" onClick={() => void copyText(shareUrl, 'link')} className="btn-primary min-h-[54px]">
                <Icon.copy className="w-4 h-4" /> {copied === 'link' ? t('analysis.copied') : t('analysis.copyLink')}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className={onBlueBtn}>
                {t('analysis.shareTelegram')}
              </a>
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className={onBlueBtn}>
                {t('analysis.shareLinkedIn')}
              </a>
            </div>
          </section>
        )}

        {/* Skills */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-6 mb-6">
          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <p className="eyebrow">{t('analysis.matchedTitle')}</p>
              <span className="font-mono font-bold text-[22px] text-accent-ink">{r.matchedSkills.length}</span>
            </div>
            <Chips items={r.matchedSkills} cls="chip-ok" empty={t('analysis.none')} />
          </section>
          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <p className="eyebrow">{t('analysis.missingTitle')}</p>
              <span className="font-mono font-bold text-[22px] text-warn">{r.missingSkills.length}</span>
            </div>
            <div className="mb-4">
              <Chips items={r.missingSkills.map((m) => m.skill)} cls="chip-miss" empty={t('analysis.none')} />
            </div>
            <p className="mb-2.5 text-[13px] font-semibold text-ink-muted">{t('analysis.keywords')}</p>
            <Chips items={r.missingKeywords} cls="chip-kw" empty={t('analysis.none')} />
          </section>
        </div>

        {/* How to close the gaps */}
        {r.missingSkills.length > 0 && (
          <section className="mb-6 rounded-3xl bg-sun-wash p-6 sm:p-8">
            <h2 className="section-title mb-1.5">{t('analysis.gapsTitle')}</h2>
            <p className="mb-[22px] text-sun-deep">{t('analysis.gapsLead')}</p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
              {r.missingSkills.map((m) => (
                <div key={m.skill} className="p-[22px] rounded-[18px] bg-white">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="w-9 h-9 rounded-[10px] bg-ink text-sun flex items-center justify-center shrink-0">
                      <Icon.check className="w-[18px] h-[18px]" />
                    </span>
                    <p className="font-display font-extrabold text-[17px] leading-snug">{m.skill}</p>
                  </div>
                  <p className="text-[15px] leading-normal text-ink-soft">{m.advice}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stronger wording: one bullet at a time */}
        {wb && (
          <section className="card mb-6">
            <div className="flex flex-wrap justify-between items-center gap-4 mb-5">
              <h2 className="section-title">{t('analysis.weakBullets')}</h2>
              {r.weakBullets.length > 1 && (
                <div className="flex items-center gap-2">
                  <button type="button" aria-label={t('analysis.bulletPrev')} onClick={() => setBullet((b) => (b - 1 + r.weakBullets.length) % r.weakBullets.length)} className="w-11 h-11 rounded-xl border-[1.5px] border-line-strong bg-white hover:bg-canvas flex items-center justify-center">
                    <Icon.arrowLeft className="w-[18px] h-[18px]" />
                  </button>
                  <span className="font-mono font-semibold text-sm min-w-[48px] text-center" aria-live="polite">
                    {Math.min(bullet, r.weakBullets.length - 1) + 1} / {r.weakBullets.length}
                  </span>
                  <button type="button" aria-label={t('analysis.bulletNext')} onClick={() => setBullet((b) => (b + 1) % r.weakBullets.length)} className="w-11 h-11 rounded-xl border-[1.5px] border-line-strong bg-white hover:bg-canvas flex items-center justify-center">
                    <Icon.arrowRight className="w-[18px] h-[18px]" />
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4 items-stretch">
              <div className="p-6 rounded-[18px] bg-canvas">
                <p className="eyebrow mb-3">{t('analysis.before')}</p>
                <p className="text-base sm:text-lg leading-[1.55] text-ink-muted">«{wb.original}»</p>
              </div>
              <div className="p-6 rounded-[18px] bg-night text-white">
                <p className="eyebrow mb-3 text-sun">{t('analysis.after')}</p>
                <p className="mb-3.5 text-base sm:text-lg leading-[1.55]">«{wb.rewritten}»</p>
                <p className="text-sm text-night-muted">{t('analysis.why', { why: wb.why })}</p>
              </div>
            </div>
          </section>
        )}

        {/* Improved CV + post-check */}
        <section className="card">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
            <h2 className="section-title">{t('analysis.improvedCv')}</h2>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={() => void copyText(improved, 'cv')} className="btn-outline">
                <Icon.copy className="w-4 h-4" /> {copied === 'cv' ? t('analysis.copied') : t('analysis.copy')}
              </button>
              <button type="button" onClick={() => void saveAsCv()} disabled={busy !== null || improved.trim() === ''} className="btn-accent">
                {busy === 'saving' ? t('cvs.saving') : t('analysis.saveAsCv')}
              </button>
            </div>
          </div>

          {flags.length > 0 ? (
            <div role="alert" className="alert-warn mb-4 rounded-[14px]">
              <Icon.warn className="w-5 h-5 shrink-0 mt-px" />
              <p>
                <strong>{t('analysis.flaggedTitle')}</strong> {t('analysis.flaggedText', { terms: flags.map((f) => `«${f}»`).join(', ') })}
              </p>
            </div>
          ) : (
            <div className="alert-ok mb-4 rounded-[14px]">
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
            className="w-full p-5 sm:p-6 rounded-2xl bg-canvas border-[1.5px] border-transparent font-mono text-[14px] sm:text-[15px] leading-[1.7] text-ink-2 resize-y focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent-ring"
          />
          {flags.length > 0 && (
            <div className="mt-3 p-5 rounded-2xl bg-white border border-warn-line font-mono text-[13px] leading-relaxed whitespace-pre-wrap max-h-72 overflow-auto text-ink-2">
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
    </div>
  );
};
