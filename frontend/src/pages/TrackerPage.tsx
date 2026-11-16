import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  APP_STATUSES,
  createApplication,
  deleteApplication,
  listApplications,
  listCvs,
  listInterviews,
  updateApplication,
  type Application,
  type ApplicationInput,
  type AppStatus,
  type CvSummary,
  type InterviewSummary,
} from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { bestVersion, cvStats, daysSince, needsFollowUp, resolveHadInterview, type BestVersion, type CvStats } from '../lib/tracker.js';
import { ApplicationDialog, type ApplicationPrefill } from '../components/ApplicationDialog.js';
import { ErrorAlert, Icon, PageHero, scoreColor } from '../components/ui.js';
import type { InterviewPrefill } from './NewInterviewPage.js';

const STATUS_DOT: Record<AppStatus, string> = {
  APPLIED: 'bg-ink-faint',
  INTERVIEW: 'bg-accent',
  OFFER: 'bg-good',
  REJECTED: 'bg-warn-strong',
};

/** Fewer applications than this: remind that the comparison is still rough. */
const FEW_APPLICATIONS = 10;

type DialogState = { editing?: Application; prefill?: ApplicationPrefill } | null;

export const TrackerPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [cvs, setCvs] = useState<CvSummary[] | null>(null);
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<AppStatus | null>(null);

  useEffect(() => {
    Promise.all([listApplications(), listCvs(), listInterviews().catch(() => [])])
      .then(([a, c, iv]) => {
        setApps(a);
        setCvs(c);
        setInterviews(iv);
      })
      .catch((err) => {
        setApps([]);
        setCvs([]);
        setError(apiErrorMessage(err, t));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Add to tracker" from an analysis: open the pre-filled form once, then drop the state so a
  // reload or Back does not open it again.
  useEffect(() => {
    const prefill = (location.state as { prefill?: ApplicationPrefill } | null)?.prefill;
    if (!prefill || cvs === null) return;
    setDialog({ prefill });
    navigate(location.pathname, { replace: true, state: null });
  }, [cvs, location.state, location.pathname, navigate]);

  const locale = i18n.language === 'en' ? 'en-GB' : 'uk-UA';
  const fmtDay = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };

  // Latest interview per vacancy (the list is newest first); a finished one wins over an unfinished one.
  const interviewByVacancy = useMemo(() => {
    const m = new Map<string, InterviewSummary>();
    for (const iv of interviews) {
      const prev = m.get(iv.vacancyId);
      if (!prev || (prev.status !== 'DONE' && iv.status === 'DONE')) m.set(iv.vacancyId, iv);
    }
    return m;
  }, [interviews]);

  const cvNames = useMemo(() => new Map((cvs ?? []).map((c) => [c.id, c.name])), [cvs]);
  const cvLabel = (a: Application) => cvNames.get(a.cvId) ?? t('tracker.cvDeleted', { name: a.cvName });
  const stats = useMemo(() => {
    const names = new Map(
      (apps ?? []).map((a) => [a.cvId, cvNames.get(a.cvId) ?? t('tracker.cvDeleted', { name: a.cvName })]),
    );
    return cvStats(apps ?? [], names);
  }, [apps, cvNames, t]);
  const best = useMemo(() => bestVersion(stats), [stats]);

  const columns = useMemo(() => {
    const by = Object.fromEntries(APP_STATUSES.map((s) => [s, [] as Application[]])) as Record<AppStatus, Application[]>;
    for (const a of apps ?? []) (by[a.status] ?? by.APPLIED).push(a);
    for (const s of APP_STATUSES) by[s].sort((x, y) => y.statusChangedAt.localeCompare(x.statusChangedAt));
    return by;
  }, [apps]);

  const replaceApp = (item: Application) => setApps((list) => (list ?? []).map((a) => (a.id === item.id ? item : a)));

  /** Optimistic: the card moves at once; on failure it goes back and an error is shown. */
  const moveTo = async (id: string, status: AppStatus) => {
    const prev = apps?.find((a) => a.id === id);
    if (!prev || prev.status === status) return;
    setError(null);
    replaceApp({ ...prev, status, statusChangedAt: new Date().toISOString(), hadInterview: resolveHadInterview(status, prev.hadInterview) });
    try {
      replaceApp(await updateApplication(id, { status }));
    } catch (err) {
      replaceApp(prev);
      setError(apiErrorMessage(err, t));
    }
  };

  const save = async (data: ApplicationInput, editing?: Application) => {
    try {
      if (editing) {
        replaceApp(await updateApplication(editing.id, data));
      } else {
        const item = await createApplication(data);
        setApps((list) => [item, ...(list ?? [])]);
      }
      setDialog(null);
    } catch (err) {
      throw new Error(apiErrorMessage(err, t));
    }
  };

  const remove = async (app: Application) => {
    try {
      await deleteApplication(app.id);
      setApps((list) => (list ?? []).filter((a) => a.id !== app.id));
      setDialog(null);
    } catch (err) {
      throw new Error(apiErrorMessage(err, t));
    }
  };

  const prefillVacancy = dialog?.prefill?.vacancyId;
  const duplicate = Boolean(prefillVacancy && apps?.some((a) => a.vacancyId === prefillVacancy));
  const loading = apps === null || cvs === null;
  const noCvs = cvs !== null && cvs.length === 0;

  return (
    <div className="flex-1">
      <PageHero
        overlap
        eyebrow={t('tracker.eyebrow')}
        title={t('tracker.title')}
        lead={t('tracker.lead')}
        aside={
          !noCvs && (
            <button type="button" onClick={() => setDialog({})} disabled={loading} className="btn-primary btn-lg">
              {t('tracker.addBtn')}
            </button>
          )
        }
      />
      <main className="relative max-w-[1240px] w-full mx-auto -mt-16 sm:-mt-20 px-4 sm:px-6 pb-16">
        {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}

        {loading ? (
          <div className="card shadow-lift"><p className="text-sm text-ink-muted">{t('tracker.loading')}</p></div>
        ) : noCvs ? (
          <div className="card shadow-lift p-10 text-center">
            <p className="mb-5 text-[15px] text-ink-muted">{t('tracker.noCvs')}</p>
            <Link to="/app/cvs" className="btn-accent">{t('tracker.addCv')}</Link>
          </div>
        ) : (
          <>
            {apps.length === 0 ? (
              <div className="card shadow-lift p-8 sm:p-10 text-center text-[15px] text-ink-muted">{t('tracker.empty')}</div>
            ) : (
              <CvSummaryCard stats={stats} best={best} total={apps.length} locale={locale} />
            )}

            <section aria-label={t('tracker.board')} className="mt-8">
              <p className="mb-3 text-sm text-ink-muted">
                <span className="hidden lg:inline">{t('tracker.dragHint')}</span>
                <span className="lg:hidden">{t('tracker.selectHint')}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
                {APP_STATUSES.map((status) => {
                  const items = columns[status];
                  const isOver = overCol === status && dragId !== null;
                  return (
                    <div
                      key={status}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (overCol !== status) setOverCol(status);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverCol(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const id = e.dataTransfer.getData('text/plain') || dragId;
                        setOverCol(null);
                        setDragId(null);
                        if (id) void moveTo(id, status);
                      }}
                      className={`rounded-3xl border p-3 min-h-[140px] lg:min-h-[320px] transition-colors ${
                        isOver ? 'bg-accent-wash border-accent ring-4 ring-accent-ring' : 'bg-subtle border-line'
                      }`}
                    >
                      <h2 className="flex items-center gap-2 px-2 pt-1 pb-3 font-display font-extrabold text-[17px]">
                        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                        {t(`tracker.status.${status}`)}
                        <span className="ml-auto font-mono text-[13px] font-semibold text-ink-muted">{items.length}</span>
                      </h2>
                      <ul className="flex flex-col gap-3">
                        {items.map((a) => (
                          <AppCard
                            key={a.id}
                            app={a}
                            cvName={cvLabel(a)}
                            interview={a.vacancyId ? interviewByVacancy.get(a.vacancyId) : undefined}
                            sent={fmtDay(a.appliedAt)}
                            dragging={dragId === a.id}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', a.id);
                              e.dataTransfer.effectAllowed = 'move';
                              setDragId(a.id);
                            }}
                            onDragEnd={() => {
                              setDragId(null);
                              setOverCol(null);
                            }}
                            onStatus={(s) => void moveTo(a.id, s)}
                            onEdit={() => setDialog({ editing: a })}
                          />
                        ))}
                      </ul>
                      {items.length === 0 && (
                        <p className="px-2 py-6 text-center text-sm text-ink-faint">{isOver ? t('tracker.dropHere') : t('tracker.columnEmpty')}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>

      <ApplicationDialog
        open={dialog}
        cvs={cvs ?? []}
        duplicate={duplicate}
        onClose={() => setDialog(null)}
        onSave={save}
        onDelete={remove}
      />
    </div>
  );
};

/* ---------- One card on the board ---------- */

const AppCard: React.FC<{
  app: Application;
  cvName: string;
  interview?: InterviewSummary;
  sent: string;
  dragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onStatus: (s: AppStatus) => void;
  onEdit: () => void;
}> = ({ app, cvName, interview, sent, dragging, onDragStart, onDragEnd, onStatus, onEdit }) => {
  const { t } = useTranslation();
  const days = daysSince(app.statusChangedAt);
  const followUp = needsFollowUp(app);
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-2xl border border-line p-4 shadow-[0_1px_2px_rgba(17,19,24,0.06)] lg:cursor-grab active:cursor-grabbing ${dragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {app.company && <p className="text-[13px] font-semibold text-ink-muted break-words">{app.company}</p>}
          <h3 className="font-display font-bold text-[16px] leading-snug break-words">{app.title}</h3>
        </div>
        <button type="button" onClick={onEdit} aria-label={t('tracker.edit', { title: app.title })} className="w-10 h-10 -mr-2 -mt-2 shrink-0 rounded-xl flex items-center justify-center text-ink-muted hover:bg-canvas hover:text-ink">
          <Icon.edit className="w-[18px] h-[18px]" />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="chip-neutral py-1 px-2.5 text-[13px] max-w-full">
          <Icon.doc className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{cvName}</span>
        </span>
        {followUp && (
          <span title={t('tracker.followUpTitle')} className="chip py-1 px-2.5 text-[13px] font-semibold bg-sun text-ink">
            <Icon.clock className="w-3.5 h-3.5" /> {t('tracker.followUp')}
          </span>
        )}
        {app.status === 'REJECTED' && app.hadInterview && (
          <span className="chip-ok py-1 px-2.5 text-[13px]">{t('tracker.afterInterview')}</span>
        )}
      </div>
      {followUp && <p className="sr-only">{t('tracker.followUpTitle')}</p>}

      <p className="mt-2.5 font-mono text-[12px] leading-relaxed text-ink-muted">
        {t('tracker.sent', { date: sent })} · {days === 0 ? t('tracker.inStatusToday') : t('tracker.inStatus', { count: days })}
      </p>
      {app.notes && <p className="mt-2 text-sm text-ink-soft whitespace-pre-line break-words line-clamp-3">{app.notes}</p>}

      {interview ? (
        <Link to={`/app/interviews/${interview.id}`} className="mt-3 inline-flex items-center gap-1.5 min-h-[40px] text-[14px] font-semibold text-accent no-underline hover:underline">
          <Icon.chat className="w-4 h-4" />
          {interview.status === 'DONE' && interview.overallScore !== undefined ? (
            <>
              {t('tracker.interviewScore')}{' '}
              <span className={`font-mono ${scoreColor(interview.overallScore * 10)}`}>{interview.overallScore.toFixed(1)}/10</span>
            </>
          ) : (
            t('tracker.interviewContinue')
          )}
        </Link>
      ) : app.vacancyId ? (
        <Link
          to="/app/interviews/new"
          state={{ prefill: { cvId: app.cvId, vacancyId: app.vacancyId } satisfies InterviewPrefill }}
          className="mt-3 inline-flex items-center gap-1.5 min-h-[40px] text-[14px] font-semibold text-accent no-underline hover:underline"
        >
          <Icon.chat className="w-4 h-4" /> {t('tracker.interviewPractise')}
        </Link>
      ) : null}

      <label className="lg:hidden mt-3 block">
        <span className="sr-only">{t('tracker.statusLabel')}</span>
        <select value={app.status} onChange={(e) => onStatus(e.target.value as AppStatus)} className="field min-h-[44px] py-2 text-[15px]">
          {APP_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`tracker.status.${s}`)}</option>
          ))}
        </select>
      </label>
    </li>
  );
};

/* ---------- "Which CV works" ---------- */

const CvSummaryCard: React.FC<{ stats: CvStats[]; best: BestVersion | null; total: number; locale: string }> = ({ stats, best, total, locale }) => {
  const { t } = useTranslation();
  const pct = (r: number) => `${Math.round(r * 100)}%`;
  const bestId = best && (best.kind === 'ratio' || best.kind === 'only') ? best.cvId : null;

  let headline: string;
  if (!best) headline = t('tracker.summary.single');
  else if (best.kind === 'ratio')
    headline = t('tracker.summary.ratio', { name: best.cvName, ratio: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(best.ratio) });
  else if (best.kind === 'only') headline = t('tracker.summary.only', { name: best.cvName });
  else headline = t(`tracker.summary.${best.kind}`);

  return (
    <section className="card shadow-lift" aria-labelledby="cv-summary-title">
      <h2 id="cv-summary-title" className="section-title mb-4">{t('tracker.summary.title')}</h2>
      <p className={`mb-5 px-5 py-4 rounded-2xl font-display font-bold text-[17px] sm:text-[19px] leading-snug ${bestId ? 'bg-sun text-ink' : 'bg-canvas text-ink-soft'}`}>
        {headline}
      </p>

      <div>
        <table className="w-full text-left">
          <thead>
            <tr className="eyebrow">
              <th scope="col" className="px-1 pb-2 font-medium">{t('tracker.summary.colCv')}</th>
              <th scope="col" className="px-1 pb-2 font-medium text-right">{t('tracker.summary.colSent')}</th>
              <th scope="col" className="px-1 pb-2 font-medium text-right">{t('tracker.summary.colReplies')}</th>
              <th scope="col" className="px-1 pb-2 pl-3 sm:pl-4 font-medium text-right sm:text-left sm:w-[38%]">{t('tracker.summary.colRate')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {stats.map((s) => (
              <tr key={s.cvId}>
                <th scope="row" className="px-1 py-3 font-semibold text-[15px]">
                  <span className="break-words">{s.cvName}</span>
                  {s.cvId === bestId && <span className="ml-2 chip py-0.5 px-2 text-[12px] font-bold bg-sun text-ink align-middle">{t('tracker.summary.best')}</span>}
                </th>
                <td className="px-1 py-3 text-right font-mono font-semibold">{s.sent}</td>
                <td className="px-1 py-3 text-right font-mono font-semibold">{s.replies}</td>
                <td className="px-1 py-3 pl-3 sm:pl-4">
                  <div className="flex items-center justify-end gap-3">
                    <div className="hidden sm:block flex-1 h-2.5 rounded-full bg-line overflow-hidden" aria-hidden="true">
                      <div className={`h-full rounded-full ${s.cvId === bestId ? 'bg-accent' : 'bg-accent-bar'}`} style={{ width: pct(s.rate) }} />
                    </div>
                    <span className="w-12 text-right font-mono font-bold">{pct(s.rate)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 flex gap-2 text-[13px] leading-snug text-ink-muted">
        <Icon.info className="w-4 h-4 shrink-0 mt-px" />
        <span>
          {t('tracker.summary.definition')}
          {stats.length >= 2 && total < FEW_APPLICATIONS && <> {t('tracker.summary.fewData', { count: total })}</>}
        </span>
      </p>
    </section>
  );
};
