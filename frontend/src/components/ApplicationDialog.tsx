import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_STATUSES, type Application, type ApplicationInput, type AppStatus, type CvSummary } from '../lib/api.js';
import { LIMITS } from '../lib/limits.js';
import { localToday } from '../lib/tracker.js';
import { ErrorAlert, Icon } from './ui.js';

/** What "Add to tracker" on an analysis hands over. */
export interface ApplicationPrefill {
  cvId: string;
  vacancyId: string | null;
  company: string;
  title: string;
}

interface Props {
  /** null = closed. `editing` set = edit that application, otherwise create (optionally pre-filled). */
  open: { editing?: Application; prefill?: ApplicationPrefill } | null;
  cvs: CvSummary[];
  /** True when the pre-filled vacancy already has a card on the board. */
  duplicate?: boolean;
  onClose: () => void;
  onSave: (data: ApplicationInput, editing?: Application) => Promise<void>;
  onDelete: (app: Application) => Promise<void>;
}

const emptyForm = (cvs: CvSummary[]): ApplicationInput => ({
  vacancyId: null,
  cvId: cvs[0]?.id ?? '',
  company: '',
  title: '',
  appliedAt: localToday(),
  status: 'APPLIED',
  hadInterview: false,
  notes: '',
});

/** Add / edit form in a native <dialog> (focus trap, Escape and backdrop for free). */
export const ApplicationDialog: React.FC<Props> = ({ open, cvs, duplicate, onClose, onSave, onDelete }) => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<ApplicationInput>(() => emptyForm(cvs));
  const [busy, setBusy] = useState<null | 'saving' | 'deleting'>(null);
  const [error, setError] = useState<string | null>(null);
  const editing = open?.editing;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!open) {
      if (d.open) d.close();
      return;
    }
    setError(null);
    setBusy(null);
    if (open.editing) {
      const { vacancyId, cvId, company, title, appliedAt, status, hadInterview, notes } = open.editing;
      setForm({ vacancyId, cvId, company, title, appliedAt, status, hadInterview: Boolean(hadInterview), notes });
    } else {
      const base = emptyForm(cvs);
      const p = open.prefill;
      setForm(
        p
          ? { ...base, vacancyId: p.vacancyId, cvId: cvs.some((c) => c.id === p.cvId) ? p.cvId : base.cvId, company: p.company, title: p.title }
          : base,
      );
    }
    if (!d.open) d.showModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof ApplicationInput>(k: K, v: ApplicationInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('saving');
    try {
      await onSave({ ...form, title: form.title.trim(), company: form.company.trim(), notes: form.notes.trim() }, editing);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!editing || !window.confirm(t('tracker.form.deleteConfirm', { title: editing.title }))) return;
    setError(null);
    setBusy('deleting');
    try {
      await onDelete(editing);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'));
      setBusy(null);
    }
  };

  // The CV this application was sent with may have been deleted since: keep it selectable.
  const cvOptions =
    editing && !cvs.some((c) => c.id === editing.cvId)
      ? [...cvs, { id: editing.cvId, name: t('tracker.cvDeleted', { name: editing.cvName }) }]
      : cvs;

  return (
    <dialog
      ref={ref}
      aria-labelledby="app-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => e.target === ref.current && !busy && onClose()}
      className="w-[calc(100%-32px)] max-w-[560px] max-h-[calc(100dvh-32px)] p-0 rounded-3xl border-0 shadow-deep bg-white text-ink backdrop:bg-ink/50"
    >
      {open && (
        <form onSubmit={(e) => void submit(e)} className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4 mb-5">
            <h2 id="app-dialog-title" className="section-title">
              {editing ? t('tracker.form.editTitle') : t('tracker.form.addTitle')}
            </h2>
            <button type="button" onClick={onClose} disabled={busy !== null} aria-label={t('tracker.form.close')} className="w-11 h-11 -mr-2 -mt-1 shrink-0 rounded-xl flex items-center justify-center text-ink-muted hover:bg-canvas hover:text-ink">
              <Icon.close className="w-5 h-5" />
            </button>
          </div>

          {!editing && open.prefill && (
            <p className="alert-ok mb-5">
              <Icon.check className="w-5 h-5 shrink-0 mt-px" />
              <span>
                {t('tracker.form.fromAnalysis')}
                {duplicate && <strong className="block mt-1">{t('tracker.form.duplicate')}</strong>}
              </span>
            </p>
          )}
          {error && <ErrorAlert className="mb-5">{error}</ErrorAlert>}

          <div className="grid gap-4">
            <div>
              <label htmlFor="app-title" className="lbl">{t('tracker.form.titleLabel')}</label>
              <input id="app-title" required maxLength={LIMITS.VACANCY_TITLE_MAX} value={form.title} onChange={(e) => set('title', e.target.value)} className="field" placeholder={t('analysis.titlePlaceholder')} />
            </div>
            <div>
              <label htmlFor="app-company" className="lbl">
                {t('tracker.form.companyLabel')} <span className="lbl-optional">{t('common.optional')}</span>
              </label>
              <input id="app-company" maxLength={LIMITS.VACANCY_COMPANY_MAX} value={form.company} onChange={(e) => set('company', e.target.value)} className="field" />
            </div>
            <div>
              <label htmlFor="app-cv" className="lbl">{t('tracker.form.cvLabel')}</label>
              <select id="app-cv" required value={form.cvId} onChange={(e) => set('cvId', e.target.value)} className="field" aria-describedby="app-cv-hint">
                {cvOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p id="app-cv-hint" className="hint">{t('tracker.form.cvHint')}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="app-date" className="lbl">{t('tracker.form.appliedLabel')}</label>
                <input id="app-date" type="date" required max={localToday()} value={form.appliedAt} onChange={(e) => set('appliedAt', e.target.value)} className="field" />
              </div>
              <div>
                <label htmlFor="app-status" className="lbl">{t('tracker.statusLabel')}</label>
                <select id="app-status" value={form.status} onChange={(e) => set('status', e.target.value as AppStatus)} className="field">
                  {APP_STATUSES.map((s) => (
                    <option key={s} value={s}>{t(`tracker.status.${s}`)}</option>
                  ))}
                </select>
              </div>
            </div>
            {form.status === 'REJECTED' && (
              <label className="flex items-start gap-3 p-4 rounded-xl bg-canvas cursor-pointer">
                <input type="checkbox" checked={form.hadInterview} onChange={(e) => set('hadInterview', e.target.checked)} className="mt-0.5 w-5 h-5 accent-accent shrink-0" />
                <span>
                  <span className="block text-[15px] font-semibold">{t('tracker.form.hadInterviewLabel')}</span>
                  <span className="block text-[13px] text-ink-muted">{t('tracker.form.hadInterviewHint')}</span>
                </span>
              </label>
            )}
            <div>
              <label htmlFor="app-notes" className="lbl">
                {t('tracker.form.notesLabel')} <span className="lbl-optional">{t('common.optional')}</span>
              </label>
              <textarea id="app-notes" rows={3} maxLength={LIMITS.APP_NOTES_MAX} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t('tracker.form.notesPlaceholder')} className="field resize-y" />
              <p className="hint text-right font-mono">{t('cvs.chars', { count: form.notes.length, max: LIMITS.APP_NOTES_MAX })}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center gap-2.5">
            {editing && (
              <button type="button" onClick={() => void remove()} disabled={busy !== null} className="btn-danger sm:mr-auto">
                {t('tracker.form.delete')}
              </button>
            )}
            <button type="button" onClick={onClose} disabled={busy !== null} className={`btn-secondary ${editing ? '' : 'sm:ml-auto'}`}>
              {t('tracker.form.cancel')}
            </button>
            <button type="submit" disabled={busy !== null || !form.cvId} className="btn-primary">
              {busy === 'saving' ? t('tracker.form.saving') : t('tracker.form.save')}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
};
