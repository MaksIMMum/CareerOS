import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createCv, getAnalysis, shareAnalysis, type Analysis } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { activeFlags, highlight } from '../lib/flagged.js';
import { LIMITS } from '../lib/limits.js';

export const scoreColor = (s: number) =>
  s >= 75 ? 'text-emerald-600' : s >= 50 ? 'text-amber-500' : 'text-red-500';
const ringColor = (s: number) => (s >= 75 ? '#059669' : s >= 50 ? '#f59e0b' : '#ef4444');

export const ScoreRing: React.FC<{ score: number; label: string; size?: number }> = ({ score, label, size = 132 }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={ringColor(score)} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-extrabold ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
    </div>
  );
};

const Chips: React.FC<{ items: string[]; tone: 'green' | 'amber' | 'slate'; empty: string }> = ({ items, tone, empty }) => {
  const cls = {
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  }[tone];
  if (items.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <span key={s} className={`px-2.5 py-1 text-xs font-medium rounded-full border ${cls}`}>
          {s}
        </span>
      ))}
    </div>
  );
};

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
    <h2 className="text-base font-semibold text-slate-900 mb-3">{title}</h2>
    {children}
  </section>
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
  const [copied, setCopied] = useState(false);
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
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-10">
        {error ? <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div> : <p className="text-sm text-slate-500">{t('analysis.loading')}</p>}
      </div>
    );
  }

  const r = analysis.result;
  const shareUrl = share ? `${window.location.origin}/s/${share.shareId}` : '';
  const shareText = share ? t('analysis.shareText', { title: analysis.vacancyTitle, before: share.scores.before, after: share.scores.after }) : '';

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
  const btn = 'px-4 py-2.5 text-sm font-semibold rounded-xl border transition-colors disabled:opacity-50';

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-10 space-y-5">
      <Link to="/app/analyses" className="text-sm text-blue-600 hover:text-blue-700">← {t('analysis.history')}</Link>

      {/* Header with the big score */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <ScoreRing score={r.matchScore} label={t('analysis.score')} />
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('analysis.resultTitle')}</p>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 break-words">
            {analysis.vacancyTitle}
            {analysis.company && <span className="text-slate-500 font-medium"> · {analysis.company}</span>}
          </h1>
          <p className="mt-1 text-xs text-slate-500">{t('analysis.cvUsed', { name: analysis.cvName })} · {date}</p>
          <p className="mt-3 text-sm text-slate-700 leading-relaxed">{r.summary}</p>
        </div>
      </section>

      {error && <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}
      {notice && <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">{notice}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card title={`✅ ${t('analysis.matched')}`}>
          <Chips items={r.matchedSkills} tone="green" empty={t('analysis.none')} />
        </Card>
        <Card title={`🔑 ${t('analysis.keywords')}`}>
          <Chips items={r.missingKeywords} tone="slate" empty={t('analysis.none')} />
        </Card>
      </div>

      <Card title={`🎯 ${t('analysis.missing')}`}>
        {r.missingSkills.length === 0 ? (
          <p className="text-sm text-slate-500">{t('analysis.none')}</p>
        ) : (
          <ul className="space-y-3">
            {r.missingSkills.map((m) => (
              <li key={m.skill} className="flex flex-col sm:flex-row gap-1 sm:gap-3">
                <span className="self-start px-2.5 py-1 text-xs font-semibold rounded-full border bg-amber-50 text-amber-900 border-amber-200 shrink-0">{m.skill}</span>
                <span className="text-sm text-slate-700">{m.advice}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {r.weakBullets.length > 0 && (
        <Card title={`✍️ ${t('analysis.weakBullets')}`}>
          <ul className="space-y-4">
            {r.weakBullets.map((b, i) => (
              <li key={i} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-red-50/60 border border-red-100">
                  <p className="text-[11px] font-semibold uppercase text-red-700 mb-1">{t('analysis.before')}</p>
                  <p className="text-sm text-slate-700">{b.original}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <p className="text-[11px] font-semibold uppercase text-emerald-700 mb-1">{t('analysis.after')}</p>
                  <p className="text-sm text-slate-800">{b.rewritten}</p>
                </div>
                <p className="md:col-span-2 text-xs text-slate-500">💡 {b.why}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Improved CV + post-check */}
      <Card title={`📄 ${t('analysis.improvedCv')}`}>
        {flags.length > 0 ? (
          <div role="alert" className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-sm text-amber-900">
            <p className="font-semibold">⚠️ {t('analysis.flaggedTitle')}</p>
            <p className="mt-1">{t('analysis.flaggedText', { terms: flags.join(', ') })}</p>
          </div>
        ) : (
          <p className="mb-3 text-xs text-emerald-700">🛡️ {t('analysis.noFlags')}</p>
        )}
        <p className="mb-2 text-xs text-slate-500">{t('analysis.improvedHint')}</p>
        <textarea value={improved} onChange={(e) => setImproved(e.target.value)} rows={16} className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono text-[13px] leading-relaxed" />
        {flags.length > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[13px] leading-relaxed whitespace-pre-wrap max-h-64 overflow-auto">
            {highlight(improved, flags).map((seg, i) =>
              seg.flagged ? <mark key={i} className="bg-amber-200 rounded px-0.5">{seg.text}</mark> : <span key={i}>{seg.text}</span>,
            )}
          </div>
        )}
        <div className="mt-3 flex flex-col sm:flex-row flex-wrap gap-2">
          <button onClick={copy} className={`${btn} border-slate-300 text-slate-800 hover:bg-slate-50`}>
            📋 {copied ? t('analysis.copied') : t('analysis.copy')}
          </button>
          <button onClick={saveAsCv} disabled={busy !== null || improved.trim() === ''} className={`${btn} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`}>
            💾 {t('analysis.saveAsCv')}
          </button>
        </div>
      </Card>

      {/* Next steps */}
      <section className="flex flex-col sm:flex-row flex-wrap gap-2">
        <button disabled title={t('analysis.soon')} className={`${btn} border-slate-200 text-slate-500 bg-white cursor-not-allowed`}>
          📊 {t('analysis.addToTracker')} <span className="text-[10px] uppercase ml-1">({t('analysis.soon')})</span>
        </button>
        <button disabled title={t('analysis.soon')} className={`${btn} border-slate-200 text-slate-500 bg-white cursor-not-allowed`}>
          💬 {t('analysis.practise')} <span className="text-[10px] uppercase ml-1">({t('analysis.soon')})</span>
        </button>
        {!share && (
          <button onClick={doShare} disabled={busy !== null} className={`${btn} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}>
            🔗 {busy === 'sharing' ? t('analysis.sharing') : t('analysis.share')}
          </button>
        )}
      </section>

      {share && (
        <Card title={`🔗 ${t('analysis.shareTitle')}`}>
          <p className="text-3xl font-extrabold text-slate-900">
            <span className={scoreColor(share.scores.before)}>{share.scores.before}</span>
            <span className="text-slate-400 mx-2">→</span>
            <span className={scoreColor(share.scores.after)}>{share.scores.after}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">{t('analysis.shareHint')}</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-xl text-sm bg-slate-50" />
            <button onClick={() => void navigator.clipboard.writeText(shareUrl)} className={`${btn} border-slate-300 text-slate-800 hover:bg-slate-50`}>
              📋 {t('analysis.copy')}
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className={`${btn} border-sky-500 text-sky-700 hover:bg-sky-50`}>
              ✈️ {t('analysis.shareTelegram')}
            </a>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer" className={`${btn} border-blue-700 text-blue-800 hover:bg-blue-50`}>
              in {t('analysis.shareLinkedIn')}
            </a>
          </div>
        </Card>
      )}
    </div>
  );
};
