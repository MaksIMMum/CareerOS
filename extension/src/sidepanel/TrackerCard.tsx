import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createApplication } from '../../../frontend/src/lib/api.js';
import { apiErrorMessage } from '../../../frontend/src/lib/apiErrors.js';
import { ErrorAlert, Icon } from '../../../frontend/src/components/ui.js';
import { openUrl, setTracked } from '../chromeApi.js';
import type { PageVacancy } from '../sites.js';
import { siteLink } from './siteUrl.js';

/** Today in the user's time zone, YYYY-MM-DD (the tracker's "applied on" date). */
export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Adds the vacancy to the CareerOS tracker with the CV that was sent. `asked` = the user just
 * clicked the site's apply button, so the card asks proactively (it never adds on its own).
 */
export const TrackerCard: React.FC<{
  vacancy: PageVacancy;
  cv: { id: string; name: string } | undefined;
  vacancyId: string | null;
  trackedId: string | undefined;
  asked: boolean;
  onTracked: (applicationId: string) => void;
  onDismiss: () => void;
}> = ({ vacancy, cv, vacancyId, trackedId, asked, onTracked, onDismiss }) => {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!cv) return;
    setError(null);
    setBusy(true);
    try {
      const app = await createApplication({
        vacancyId,
        cvId: cv.id,
        company: vacancy.company,
        title: vacancy.title,
        appliedAt: localDate(),
        status: 'APPLIED',
        hadInterview: false,
        notes: vacancy.url,
      });
      await setTracked(vacancy.url, app.id).catch(() => undefined);
      onTracked(app.id);
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (trackedId) {
    return (
      <section className="card flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[14px] text-accent-ink">
          <Icon.check className="w-5 h-5 shrink-0" /> {t('ext.trackerDone')}
        </p>
        <button type="button" onClick={() => openUrl(siteLink('/app/tracker'))} className="text-[13px] link shrink-0">
          {t('ext.trackerOpen')} →
        </button>
      </section>
    );
  }

  return (
    <section className={`card ${asked ? 'border-2 border-sun bg-sun-wash' : ''}`} aria-labelledby="tracker-h" aria-live="polite">
      <h2 id="tracker-h" className="font-display font-extrabold text-[17px] mb-1">
        {asked ? t('ext.trackerAsk') : t('ext.trackerTitle')}
      </h2>
      {!asked && <p className="mb-2 text-[14px] text-ink-muted">{t('ext.trackerLead')}</p>}
      {cv && <p className="mb-3 text-[13px] text-ink-soft break-words">{t('ext.trackerCv', { name: cv.name })}</p>}
      {error && <ErrorAlert className="mb-3">{error}</ErrorAlert>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void add()} disabled={busy || !cv} className={asked ? 'btn-primary btn-sm min-h-[40px]' : 'btn-accent btn-sm min-h-[40px]'}>
          <Icon.columns className="w-4 h-4" /> {busy ? t('ext.trackerAdding') : t('ext.trackerAdd')}
        </button>
        {asked && (
          <button type="button" onClick={onDismiss} className="btn-secondary btn-sm min-h-[40px]">
            {t('ext.notNow')}
          </button>
        )}
      </div>
    </section>
  );
};
