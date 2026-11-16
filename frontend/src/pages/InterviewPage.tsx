import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  answerInterview,
  ApiError,
  getInterview,
  listApplications,
  QUESTION_TYPES,
  type Application,
  type Interview,
  type InterviewAnswer,
  type InterviewQuestion,
} from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { LIMITS } from '../lib/limits.js';
import type { ApplicationPrefill } from '../components/ApplicationDialog.js';
import type { InterviewPrefill } from './NewInterviewPage.js';
import { ErrorAlert, Icon, scoreColor } from '../components/ui.js';

// Browser storage is only a convenience here (timer preference, unsent draft): it may be
// unavailable (private mode), so every access is guarded and the page works without it.
const TIMER_KEY = 'careeros.interviewTimer';
const readStore = (s: () => Storage, k: string) => {
  try {
    return s().getItem(k);
  } catch {
    return null;
  }
};
const writeStore = (s: () => Storage, k: string, v: string | null) => {
  try {
    if (v === null) s().removeItem(k);
    else s().setItem(k, v);
  } catch {
    // ignore
  }
};
const session = () => window.sessionStorage;
const local = () => window.localStorage;

/** A suggested answer length: the timer turns yellow after this. */
const SUGGESTED_SECONDS = 120;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Shows [placeholders] in the example answer as yellow marks, so they are clearly not facts. */
const WithPlaceholders: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\[[^\]\n]{1,80}\])/g).map((part, i) =>
      /^\[.*\]$/.test(part) ? (
        <mark key={i} className="bg-sun-wash text-ink rounded px-1 font-semibold">{part}</mark>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </>
);

const TypeChip: React.FC<{ q: InterviewQuestion }> = ({ q }) => {
  const { t } = useTranslation();
  return (
    <span className="flex flex-wrap gap-1.5">
      <span className="chip-ok py-1 px-2.5 text-[13px]">{t(`interview.type.${q.type}`)}</span>
      <span className="chip-neutral py-1 px-2.5 text-[13px] max-w-full"><span className="truncate">{q.topic}</span></span>
    </span>
  );
};

const ScoreBadge: React.FC<{ score: number }> = ({ score }) => (
  <span className={`font-mono font-bold text-[28px] leading-none ${scoreColor(score * 10)}`}>
    {score}
    <span className="text-[15px] text-ink-muted">/10</span>
  </span>
);

/** Score, feedback and the example answer for one question. */
const AnswerReview: React.FC<{ a: InterviewAnswer; showAnswer?: boolean }> = ({ a, showAnswer }) => {
  const { t } = useTranslation();
  const flags = [...a.flagged.skills, ...a.flagged.numbers];
  return (
    <div className="flex flex-col gap-4">
      {showAnswer && (
        <div>
          <p className="mb-1 text-[13px] font-semibold text-ink-muted">{t('interview.yourAnswer')}</p>
          <p className="text-[15px] text-ink-soft whitespace-pre-line break-words">{a.answer}</p>
        </div>
      )}
      <div className="flex items-start gap-4">
        <ScoreBadge score={a.score} />
        <p className="flex-1 min-w-0 text-[15px] leading-normal break-words">{a.feedback}</p>
      </div>
      <div className="rounded-2xl bg-accent-wash border border-accent-chip p-4">
        <p className="mb-1.5 text-[13px] font-semibold text-accent-ink">{t('interview.betterAnswer')}</p>
        <p className="text-[15px] leading-relaxed whitespace-pre-line break-words">
          <WithPlaceholders text={a.betterAnswer} />
        </p>
        {/\[[^\]\n]+\]/.test(a.betterAnswer) && (
          <p className="mt-2 text-[13px] text-ink-muted">{t('interview.placeholdersHint')}</p>
        )}
      </div>
      {flags.length > 0 && (
        <p className="alert-warn text-sm">
          <Icon.warn className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{t('interview.flagged', { terms: flags.map((f) => `«${f}»`).join(', ') })}</span>
        </p>
      )}
    </div>
  );
};

export const InterviewPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const fromState = (useLocation().state as { interview?: Interview } | null)?.interview;

  const [iv, setIv] = useState<Interview | null>(fromState?.id === id ? fromState : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Index of the answer whose feedback is shown right after sending it. */
  const [review, setReview] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [timerOn, setTimerOn] = useState(() => readStore(local, TIMER_KEY) === '1');
  const [seconds, setSeconds] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);

  const current = iv?.answeredCount ?? 0;
  const draftKey = `careeros.iv.${id}.${current}`;
  const asking = iv !== null && iv.status !== 'DONE' && review === null;

  useEffect(() => {
    if (iv) return;
    getInterview(id)
      .then(setIv)
      .catch((err) => setLoadError(apiErrorMessage(err, t)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // A new question: restore an unsent draft (e.g. after the phone reloaded the tab), restart the timer.
  useEffect(() => {
    if (!asking) return;
    setDraft(readStore(session, draftKey) ?? '');
    setSeconds(0);
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [asking, draftKey]);

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const toggleTimer = () => {
    setTimerOn((on) => {
      writeStore(local, TIMER_KEY, on ? '0' : '1');
      return !on;
    });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!iv || sending || draft.trim() === '') return;
    setError(null);
    setSending(true);
    try {
      const next = await answerInterview(iv.id, {
        index: current,
        answer: draft.trim(),
        ...(timerOn ? { seconds } : {}),
      });
      writeStore(session, draftKey, null);
      setIv(next);
      setReview(current);
      scrollTop();
    } catch (err) {
      // Answered in another tab, or a double submit: reload and carry on from the right question.
      if (err instanceof ApiError && (err.code === 'wrong_question' || err.code === 'interview_finished')) {
        setIv(await getInterview(iv.id).catch(() => iv));
        setError(t('interview.outOfSync'));
      } else {
        setError(apiErrorMessage(err, t));
      }
    } finally {
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <main className="max-w-[860px] w-full mx-auto px-4 sm:px-6 py-10">
        <ErrorAlert>{loadError}</ErrorAlert>
        <Link to="/app/interviews" className="link mt-6 inline-block">← {t('interview.historyLink')}</Link>
      </main>
    );
  }
  if (!iv) {
    return <main className="max-w-[860px] w-full mx-auto px-4 sm:px-6 py-10 text-ink-muted">{t('common.loading')}</main>;
  }

  const total = iv.questionCount;
  const progressDone = review !== null ? review + 1 : current;

  return (
    <div className="flex-1" ref={topRef}>
      {/* Blue header: vacancy and progress */}
      <div className="bg-accent text-white">
        <div className="max-w-[860px] mx-auto px-4 sm:px-6 pt-5 pb-8">
          <Link to="/app/interviews" className="inline-flex items-center gap-1.5 min-h-[44px] mb-2 text-[15px] text-accent-on no-underline hover:text-white">
            <Icon.arrowLeft className="w-4 h-4" /> {t('interview.historyLink')}
          </Link>
          <p className="mb-1.5 font-mono text-[13px] text-accent-on break-words">
            {iv.cvName}
            {iv.company ? ` → ${iv.company}` : ''}
          </p>
          <h1 className="font-display font-extrabold text-[26px] sm:text-[34px] leading-[1.1] tracking-[-0.02em] break-words">{iv.vacancyTitle}</h1>
          {iv.status !== 'DONE' || review !== null ? (
            <div className="mt-5">
              <p className="mb-2 font-mono text-[13px] text-accent-on">{t('interview.progress', { n: Math.min(progressDone + (asking ? 1 : 0), total), total })}</p>
              <div className="h-2 rounded-full bg-white/20 overflow-hidden" aria-hidden="true">
                <div className="h-full bg-sun rounded-full transition-all duration-500" style={{ width: `${(progressDone / total) * 100}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <main className="max-w-[860px] mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-16">
        {error && <ErrorAlert className="mb-5">{error}</ErrorAlert>}

        {review !== null && iv.answers[review] && iv.questions[review] ? (
          <section className="card shadow-lift" aria-labelledby="fbh" aria-live="polite">
            <div className="mb-3"><TypeChip q={iv.questions[review]} /></div>
            <h2 id="fbh" className="mb-5 font-display font-bold text-[19px] leading-snug break-words">{iv.questions[review].question}</h2>
            <AnswerReview a={iv.answers[review]} showAnswer />
            <div className="mt-6 pt-5 border-t border-line flex justify-end">
              <button
                type="button"
                className="btn-primary btn-lg w-full sm:w-auto"
                onClick={() => {
                  setReview(null);
                  scrollTop();
                }}
              >
                {iv.status === 'DONE' ? t('interview.seeResults') : t('interview.nextQuestion')} <Icon.arrowRight className="w-[18px] h-[18px]" />
              </button>
            </div>
          </section>
        ) : asking && iv.questions[current] ? (
          <form onSubmit={send} className="card shadow-lift">
            <div className="flex items-start justify-between gap-3 mb-3">
              <TypeChip q={iv.questions[current]} />
              <button
                type="button"
                onClick={toggleTimer}
                aria-pressed={timerOn}
                className={`shrink-0 inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-full text-[13px] font-semibold border ${timerOn ? 'border-accent text-accent bg-accent-wash' : 'border-line text-ink-muted'}`}
              >
                <Icon.clock className="w-4 h-4" />
                {timerOn ? (
                  <span className={`font-mono ${seconds > SUGGESTED_SECONDS ? 'text-warn-strong' : ''}`} aria-label={t('interview.timerAria', { time: mmss(seconds) })}>
                    {mmss(seconds)}
                  </span>
                ) : (
                  t('interview.timer')
                )}
              </button>
            </div>
            <h2 id="qh" className="mb-5 font-display font-bold text-[20px] sm:text-[22px] leading-snug break-words">
              {iv.questions[current].question}
            </h2>
            <label htmlFor="answer" className="lbl">{t('interview.answerLabel')}</label>
            <textarea
              id="answer"
              value={draft}
              disabled={sending}
              maxLength={LIMITS.INTERVIEW_ANSWER_MAX}
              onChange={(e) => {
                setDraft(e.target.value);
                writeStore(session, draftKey, e.target.value);
              }}
              rows={8}
              placeholder={t('interview.answerPlaceholder')}
              className="field min-h-[11rem] resize-y leading-normal"
            />
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-[13px] text-ink-muted">
              <span>{timerOn ? t('interview.timerHint') : t('interview.answerHint')}</span>
              <span className="font-mono">{draft.trim().length}/{LIMITS.INTERVIEW_ANSWER_MAX}</span>
            </div>
            <div className="mt-6 pt-5 border-t border-line flex justify-end">
              <button type="submit" disabled={sending || draft.trim() === ''} className="btn-primary btn-lg w-full sm:w-auto">
                {sending ? t('interview.evaluating') : t('interview.send')}
                {!sending && <Icon.arrowRight className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </form>
        ) : (
          <Results iv={iv} onAgain={() => navigate('/app/interviews/new', { state: { prefill: { cvId: iv.cvId, vacancyId: iv.vacancyId } satisfies InterviewPrefill } })} locale={i18n.language} />
        )}
      </main>
    </div>
  );
};

/* ---------- Final screen ---------- */

const Results: React.FC<{ iv: Interview; onAgain: () => void; locale: string }> = ({ iv, onAgain, locale }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [card, setCard] = useState<Application | null | undefined>(undefined);
  const outcome = iv.outcome;

  // The tracker card for the same vacancy, if there is one.
  useEffect(() => {
    listApplications()
      .then((apps) => setCard(apps.find((a) => a.vacancyId === iv.vacancyId) ?? null))
      .catch(() => setCard(null));
  }, [iv.vacancyId]);

  const addToTracker = () => {
    const prefill: ApplicationPrefill = { cvId: iv.cvId, vacancyId: iv.vacancyId, company: iv.company, title: iv.vacancyTitle };
    navigate('/app/tracker', { state: { prefill } });
  };
  const fmtScore = (n: number) => new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

  if (!outcome) return null;
  return (
    <div className="flex flex-col gap-6">
      <section className="card shadow-lift" aria-labelledby="resh">
        <h2 id="resh" className="sr-only">{t('interview.resultsTitle')}</h2>
        <div className="flex flex-wrap gap-6 items-center">
          <div className="text-center shrink-0">
            <p className={`font-mono font-bold text-[56px] leading-none ${scoreColor(outcome.overallScore * 10)}`}>{fmtScore(outcome.overallScore)}</p>
            <p className="mt-1 font-mono text-sm text-ink-muted">{t('interview.outOf10')}</p>
          </div>
          <div className="flex-[1_1_260px] min-w-0 flex flex-col gap-2.5">
            {QUESTION_TYPES.filter((type) => outcome.byType[type] !== undefined).map((type) => (
              <div key={type}>
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="font-semibold">{t(`interview.type.${type}`)}</span>
                  <span className="font-mono text-ink-muted">{fmtScore(outcome.byType[type]!)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#ECEEF2] overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${outcome.byType[type]! * 10}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <p className="mb-2 text-sm font-semibold">{t('interview.strongest')}</p>
            {outcome.strongest.length ? (
              <div className="flex flex-wrap gap-1.5">{outcome.strongest.map((s) => <span key={s} className="chip-ok">{s}</span>)}</div>
            ) : (
              <p className="text-sm text-ink-muted">{t('interview.noStrongest')}</p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">{t('interview.weakest')}</p>
            {outcome.weakest.length ? (
              <div className="flex flex-wrap gap-1.5">{outcome.weakest.map((s) => <span key={s} className="chip-miss">{s}</span>)}</div>
            ) : (
              <p className="text-sm text-ink-muted">{t('interview.noWeakest')}</p>
            )}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-line flex flex-col sm:flex-row flex-wrap gap-2.5">
          <button type="button" onClick={onAgain} className="btn-primary">{t('interview.again')}</button>
          {card ? (
            <Link to="/app/tracker" className="btn-outline">
              <Icon.columns className="w-4 h-4" /> {t('interview.openTracker')}
            </Link>
          ) : card === null ? (
            <button type="button" onClick={addToTracker} className="btn-outline">
              <Icon.columns className="w-4 h-4" /> {t('analysis.addToTracker')}
            </button>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="qah">
        <h2 id="qah" className="mb-4 font-display font-extrabold text-[22px]">{t('interview.allAnswers')}</h2>
        <ol className="flex flex-col gap-4">
          {iv.questions.map((q, i) => {
            const a = iv.answers[i];
            return (
              <li key={i} className="card">
                <div className="flex items-center gap-3 mb-3">
                  <span className="num-badge" aria-hidden="true">{i + 1}</span>
                  <TypeChip q={q} />
                </div>
                <h3 className="mb-4 font-display font-bold text-[17px] leading-snug break-words">{q.question}</h3>
                {a && <AnswerReview a={a} showAnswer />}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
};
