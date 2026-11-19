import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createProfile, getProfiles, type ProfilePlatform, type ProfileText } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { activeFlags, highlight } from '../lib/flagged.js';
import { ErrorAlert, Icon } from './ui.js';

type Lang = 'uk' | 'en';
type Draft = { headline: string; about: string; skills: string[] };

/** Mirrors backend/src/lib/profile.ts PROFILE_LIMITS. */
const LIMITS: Record<ProfilePlatform, { headline: number; about: number }> = {
  djinni: { headline: 80, about: 2000 },
  linkedin: { headline: 220, about: 2600 },
};
const PLATFORM_NAME: Record<ProfilePlatform, string> = { djinni: 'Djinni', linkedin: 'LinkedIn' };
const PROFILES_PER_DAY = 10;

const draftOf = (p: ProfileText): Draft => ({ headline: p.headline, about: p.about, skills: p.skills });

/** Djinni / LinkedIn profile text for one saved CV: write with AI, edit, copy field by field. */
export const ProfileTextCard: React.FC<{ cvId: string; cvUpdatedAt?: string; className?: string }> = ({
  cvId,
  cvUpdatedAt,
  className = '',
}) => {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<ProfilePlatform>('djinni');
  // Recruiters on both sites usually read English; the user can switch.
  const [lang, setLang] = useState<Lang>('en');
  const [saved, setSaved] = useState<Partial<Record<ProfilePlatform, ProfileText>>>({});
  const [drafts, setDrafts] = useState<Partial<Record<ProfilePlatform, Draft>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<null | 'headline' | 'about' | 'skills'>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProfiles(cvId)
      .then((items) => {
        setSaved(items);
        setDrafts(Object.fromEntries(Object.entries(items).map(([k, p]) => [k, draftOf(p!)])));
        const first = items.djinni ?? items.linkedin;
        if (first) setLang(first.lang);
      })
      .catch((err) => setError(apiErrorMessage(err, t)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cvId]);

  const current = saved[platform];
  const draft = drafts[platform];
  const lim = LIMITS[platform];
  const edited =
    !!current && !!draft && (draft.headline !== current.headline || draft.about !== current.about || draft.skills.join() !== current.skills.join());
  const cvChanged = !!current && !!cvUpdatedAt && current.cvUpdatedAt !== cvUpdatedAt;
  const fullText = draft ? [draft.headline, draft.about, draft.skills.join(', ')].join('\n') : '';
  const flags = useMemo(() => (current ? activeFlags(fullText, current.flagged) : []), [fullText, current]);

  const write = async () => {
    if (edited && !window.confirm(t('profile.regenerateConfirm'))) return;
    setError(null);
    setBusy(true);
    try {
      const p = await createProfile(cvId, platform, lang);
      setSaved((s) => ({ ...s, [platform]: p }));
      setDrafts((d) => ({ ...d, [platform]: draftOf(p) }));
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (what: 'headline' | 'about' | 'skills', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError(t('errors.generic'));
    }
  };

  const setDraft = (patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [platform]: { ...d[platform]!, ...patch } }));

  const CopyBtn: React.FC<{ what: 'headline' | 'about' | 'skills'; text: string; label?: string }> = ({ what, text, label }) => (
    <button type="button" onClick={() => void copy(what, text)} disabled={!text.trim()} className="btn-secondary btn-sm min-h-[36px]">
      <Icon.copy className="w-4 h-4" /> {copied === what ? t('profile.copied') : (label ?? t('profile.copy'))}
    </button>
  );

  const counter = (n: number, max: number) => (
    <span className={`font-mono text-[13px] ${n > max ? 'text-warn-strong font-bold' : 'text-ink-muted'}`}>{t('profile.chars', { count: n, max })}</span>
  );

  return (
    <section className={`card shadow-lift ${className}`} aria-labelledby="profile-title">
      <h2 id="profile-title" className="font-display font-extrabold text-[21px] mb-1">{t('profile.title')}</h2>
      <p className="text-[15px] text-ink-muted">{t('profile.lead')}</p>
      <p className="mb-4 text-[13px] text-ink-muted">{t('profile.savedOnly')}</p>

      <div className="flex flex-wrap items-end gap-2.5 mb-4">
        <div role="tablist" aria-label={t('profile.title')} className="inline-flex p-1 rounded-xl bg-canvas border border-line">
          {(['djinni', 'linkedin'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={platform === p}
              onClick={() => setPlatform(p)}
              className={`min-h-[40px] px-4 rounded-lg text-[15px] font-semibold ${platform === p ? 'bg-white shadow-sm text-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              {PLATFORM_NAME[p]}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="profile-lang" className="lbl">{t('profile.langLabel')}</label>
          <select id="profile-lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} disabled={busy} className="field min-h-[44px] py-2">
            <option value="en">{t('coverLetter.langEn')}</option>
            <option value="uk">{t('coverLetter.langUk')}</option>
          </select>
        </div>
        <button type="button" onClick={() => void write()} disabled={busy || loading} className={current ? 'btn-outline' : 'btn-accent'}>
          <Icon.edit className="w-4 h-4" /> {busy ? t('profile.generating') : current ? t('profile.regenerate') : t('profile.generate')}
        </button>
      </div>

      {error && <ErrorAlert className="mb-4">{error}</ErrorAlert>}

      {loading ? (
        <p className="text-sm text-ink-muted">{t('common.loading')}</p>
      ) : !current || !draft ? (
        <p className="text-[13px] text-ink-muted">{t('profile.limitHint', { limit: PROFILES_PER_DAY })}</p>
      ) : (
        <div className="space-y-5">
          {cvChanged && (
            <div className="alert-warn rounded-[14px]">
              <Icon.info className="w-5 h-5 shrink-0 mt-px" />
              <p>{t('profile.cvChanged')}</p>
            </div>
          )}
          {flags.length > 0 ? (
            <div role="alert" className="alert-warn rounded-[14px]">
              <Icon.warn className="w-5 h-5 shrink-0 mt-px" />
              <p>
                <strong>{t('analysis.flaggedTitle')}</strong> {t('profile.flaggedText', { terms: flags.map((f) => `«${f}»`).join(', ') })}
              </p>
            </div>
          ) : (
            <div className="alert-ok rounded-[14px]">
              <Icon.shield className="w-5 h-5 shrink-0 mt-px" />
              <p>{t('profile.noFlags')}</p>
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label htmlFor="profile-headline" className="lbl mb-0">
                {platform === 'djinni' ? t('profile.headlineDjinni') : t('profile.headline')}
              </label>
              <CopyBtn what="headline" text={draft.headline} />
            </div>
            <input id="profile-headline" value={draft.headline} onChange={(e) => setDraft({ headline: e.target.value })} className="field" />
            <div className="mt-1 text-right">{counter(draft.headline.length, lim.headline)}</div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label htmlFor="profile-about" className="lbl mb-0">
                {platform === 'djinni' ? t('profile.aboutDjinni') : t('profile.about')}
              </label>
              <CopyBtn what="about" text={draft.about} />
            </div>
            <textarea
              id="profile-about"
              value={draft.about}
              onChange={(e) => setDraft({ about: e.target.value })}
              rows={10}
              className="field leading-relaxed resize-y min-h-[12rem]"
            />
            <div className="mt-1 text-right">{counter(draft.about.length, lim.about)}</div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="lbl mb-0">{t('profile.skills')}</p>
              <CopyBtn what="skills" text={draft.skills.join(', ')} label={t('profile.copySkills')} />
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.skills.map((s) => (
                <span key={s} className={flags.some((f) => f.toLowerCase() === s.toLowerCase()) ? 'chip-miss' : 'chip-ok'}>
                  {s}
                  <button
                    type="button"
                    onClick={() => setDraft({ skills: draft.skills.filter((x) => x !== s) })}
                    aria-label={`${t('cvs.delete')}: ${s}`}
                    className="-mr-1 ml-0.5 w-6 h-6 rounded-full inline-flex items-center justify-center hover:bg-black/10"
                  >
                    <Icon.close className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {flags.length > 0 && (
            <div className="p-4 rounded-2xl bg-white border border-warn-line text-[14px] leading-relaxed whitespace-pre-wrap max-h-60 overflow-auto text-ink-2">
              {highlight(fullText, flags).map((seg, i) =>
                seg.flagged ? (
                  <mark key={i} className="bg-warn-chip text-warn rounded px-0.5">{seg.text}</mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
