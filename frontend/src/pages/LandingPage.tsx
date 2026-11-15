import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext.js';
import { Icon, LangSwitch, Logo, Rings, useCountUp } from '../components/ui.js';

const TICKER = [
  'Junior QA Engineer', 'Trainee Data Analyst', 'Intern Frontend (React)', 'Junior Node.js Developer', 'Junior Python Developer',
  'Trainee UI/UX Designer', 'Junior Java Developer', 'Intern DevOps', 'Junior Manual QA', 'Trainee .NET Developer',
  'Junior Data Engineer', 'Intern iOS Developer',
];
const eyebrow = 'mb-3.5 font-mono text-[13px] font-medium uppercase tracking-[0.08em]';

/* ---------- Hero: blue band, phone mockup with a counting score, floating cards ---------- */

const PhoneMock: React.FC<{ score: number }> = ({ score }) => {
  const { t } = useTranslation();
  const c = 2 * Math.PI * 52;
  return (
    <div role="img" aria-label={t('landing.phone.alt')} className="relative w-[270px] sm:w-[290px] h-[560px] sm:h-[590px] rounded-[46px] bg-ink p-3 shadow-deep">
      <div className="w-full h-full rounded-[36px] bg-canvas overflow-hidden text-ink flex flex-col" aria-hidden="true">
        <div className="h-[30px] flex justify-center items-center">
          <span className="w-[90px] h-[22px] rounded-full bg-ink" />
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="font-display font-extrabold text-[15px]">CareerOS</span>
          <span className="font-mono text-[11px] text-ink-muted">Backend CV</span>
        </div>
        <div className="mx-3 my-1.5 p-4 rounded-[18px] bg-white text-center">
          <p className="mb-2.5 font-display font-bold text-[13px]">Junior Backend Developer</p>
          <div className="relative w-[124px] h-[124px] mx-auto">
            <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
              <circle cx="62" cy="62" r="52" stroke="#E3E5EA" strokeWidth="11" fill="none" />
              <circle cx="62" cy="62" r="52" stroke="#2346D8" strokeWidth="11" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono font-bold text-[38px] leading-none">{score}</span>
              <span className="mt-0.5 text-[10px] text-ink-muted">{score >= 81 ? t('landing.phone.after') : t('landing.phone.analyzing')}</span>
            </div>
          </div>
        </div>
        <div className="mx-3 my-1.5 p-3.5 rounded-[18px] bg-white">
          <p className="mb-2 text-[11px] font-semibold text-ink-muted">{t('landing.phone.matched')}</p>
          <div className="flex flex-wrap gap-[5px] mb-3">
            {['Node.js', 'REST API', 'PostgreSQL'].map((s) => (
              <span key={s} className="chip-ok text-[11px] px-2 py-1">{s}</span>
            ))}
          </div>
          <p className="mb-2 text-[11px] font-semibold text-ink-muted">{t('landing.phone.missing')}</p>
          <div className="flex flex-wrap gap-[5px]">
            <span className="chip-miss text-[11px] px-2 py-1 animate-pop1">Docker</span>
            <span className="chip-miss text-[11px] px-2 py-1 animate-pop2">Jest</span>
            <span className="chip-miss text-[11px] px-2 py-1 animate-pop3">CI/CD</span>
          </div>
        </div>
        <div className="mx-3 my-1.5 px-3.5 py-3 rounded-[14px] bg-accent text-white text-xs font-semibold text-center">{t('landing.phone.addTracker')}</div>
      </div>
    </div>
  );
};

const HeroArt: React.FC = () => {
  const { t } = useTranslation();
  const score = useCountUp(58, 81);
  return (
    <div className="flex-[1_1_460px] min-w-0 relative h-[580px] sm:h-[600px] flex justify-center">
      <div aria-hidden="true" className="absolute w-[340px] h-[340px] sm:w-[440px] sm:h-[440px] rounded-full bg-sun top-[70px] left-1/2 -translate-x-1/2" />
      <div aria-hidden="true" className="absolute w-[90px] h-[90px] rounded-[22px] bg-ink top-[30px] right-10 rotate-[14deg]" />
      <PhoneMock score={score} />

      <div aria-hidden="true" className="hidden md:block absolute left-0 top-[90px] w-[210px] p-3.5 rounded-2xl bg-white text-ink shadow-lift animate-float-a">
        <div className="flex gap-3 items-center">
          <div className="relative w-10 h-[50px] rounded-md bg-warn-chip overflow-hidden shrink-0">
            {[12, 20, 28].map((top, i) => (
              <span key={top} className="absolute left-[7px] h-[3px] bg-warn-border" style={{ top, right: [7, 12, 9][i] }} />
            ))}
            <span className="absolute left-0 right-0 h-[3px] bg-accent animate-scan" />
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[13px] font-semibold leading-tight">Backend_CV.pdf</p>
            <p className="font-mono text-[11px] text-ink-muted">{t('landing.float.reading')}</p>
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="hidden md:block absolute right-0 top-[250px] w-[200px] p-3.5 rounded-2xl bg-white text-ink shadow-lift animate-float-b">
        <p className="mb-1.5 font-display font-bold text-[13px] text-warn">{t('landing.float.gapTitle')}</p>
        <p className="text-xs leading-[1.45] text-ink-soft">{t('landing.float.gapText')}</p>
      </div>

      <div aria-hidden="true" className="hidden md:block absolute left-2.5 bottom-10 w-[230px] px-4 py-3.5 rounded-2xl bg-ink text-white shadow-deep animate-float-a">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-night-muted">{t('landing.float.trackerLabel')}</p>
        <p className="mb-2.5 font-display font-bold text-sm leading-snug">{t('landing.float.trackerText')}</p>
        <div className="flex gap-1.5 items-end h-[34px]">
          <span className="w-[22px] h-full rounded bg-sun" />
          <span className="w-[22px] h-1/4 rounded bg-[#4A4F5C]" />
        </div>
      </div>
    </div>
  );
};

/* ---------- Before / after demo ---------- */

const Demo: React.FC = () => {
  const { t } = useTranslation();
  const [view, setView] = useState<'before' | 'after'>('before');
  const before = view === 'before';
  const mark = (s: string) => <mark className="bg-accent-chip text-accent-ink px-1 rounded">{s}</mark>;
  return (
    <section id="demo" className="bg-night text-white scroll-mt-4">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-wrap gap-10 sm:gap-14 items-center">
        <div className="flex-[1_1_380px] min-w-0">
          <p className={`${eyebrow} text-sun`}>{t('landing.demo.eyebrow')}</p>
          <h2 className="display-title mb-5">
            {t('landing.demo.title1')}
            <br />
            {t('landing.demo.title2')}
          </h2>
          <p className="mb-8 text-lg leading-relaxed text-night-text">{t('landing.demo.text')}</p>
          <div role="tablist" aria-label={t('landing.demo.tabs')} className="inline-flex p-1.5 rounded-[14px] bg-night-card border border-night-line">
            {(['before', 'after'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                type="button"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`min-h-[48px] px-[22px] rounded-[10px] font-display font-bold text-base ${
                  view === v ? (v === 'before' ? 'bg-white text-ink' : 'bg-sun text-ink') : 'bg-transparent text-night-text hover:text-white'
                }`}
              >
                {t(`landing.demo.${v}`)}
              </button>
            ))}
          </div>
        </div>
        <div role="tabpanel" className="flex-[1_1_520px] min-w-0 rounded-3xl bg-white text-ink p-6 sm:p-8 shadow-deep">
          <div className="flex justify-between items-center gap-4 mb-5">
            <p className="eyebrow text-[12px]">{t('landing.demo.label')}</p>
            <span className={`shrink-0 px-3.5 py-2 rounded-full font-mono font-bold text-[15px] ${before ? 'bg-warn-chip text-warn' : 'bg-accent-chip text-accent-ink'}`}>
              {before ? 58 : 81} / 100
            </span>
          </div>
          {before ? (
            <>
              <p className="mb-5 text-lg sm:text-[22px] font-medium leading-normal text-ink-muted">{t('landing.demo.beforeText')}</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((n) => (
                  <span key={n} className="chip-miss">{t(`landing.demo.beforeTag${n}`)}</span>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="mb-5 text-lg sm:text-[22px] font-medium leading-normal">
                {t('landing.demo.afterPre')}
                {mark('Node.js')}
                {t('landing.demo.afterMid')}
                {mark('PostgreSQL')}
                {t('landing.demo.afterPost')}
              </p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3].map((n) => (
                  <span key={n} className="chip-ok">{t(`landing.demo.afterTag${n}`)}</span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

/* ---------- Simple illustrated avatars for "who is it for" ---------- */

const Avatar: React.FC<{ variant: 0 | 1 | 2 | 3 }> = ({ variant }) => {
  const look = [
    { bg: '#E8EDFD', body: '#2346D8', skin: '#F2C9A5', hair: '#3B2A20', hairPath: 'M22 31c0-10 7-16 14-16s14 6 14 15c-4-4-9-6-14-6s-10 3-14 7z', glasses: true },
    { bg: '#FFF4D1', body: '#C2410C', skin: '#E9B48A', hair: '#8A4B22', hairPath: 'M24 30c3-6 8-9 12-9s9 3 12 9c-5-2-14-3-24 0z', glasses: false },
    { bg: '#E3F4EE', body: '#0F766E', skin: '#C98E62', hair: '#1E1A17', hairPath: 'M23 30c0-9 6-15 13-15s13 5 13 14c-6-1-11-4-14-8-2 4-6 7-12 9z', glasses: false },
    { bg: '#F1E8FD', body: '#6D28D9', skin: '#F5D3B8', hair: '#D9A441', hairPath: 'M24 34c-3-12 3-20 12-20 10 0 15 8 12 20-1-6-4-10-7-12-5 4-11 6-17 12z', glasses: false },
  ][variant];
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" className="mb-[18px]">
      <circle cx="36" cy="36" r="36" fill={look.bg} />
      <path d="M14 72c2-14 11-21 22-21s20 7 22 21z" fill={look.body} />
      <circle cx="36" cy="32" r="13" fill={look.skin} />
      <path d={look.hairPath} fill={look.hair} />
      {look.glasses && (
        <>
          <rect x="27" y="29" width="8" height="6" rx="2" stroke="#111318" strokeWidth="1.6" fill="none" />
          <rect x="37" y="29" width="8" height="6" rx="2" stroke="#111318" strokeWidth="1.6" fill="none" />
        </>
      )}
    </svg>
  );
};

export const LandingPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const startTo = user ? '/app/analyses/new' : '/signup';

  return (
    <div className="min-h-screen bg-canvas overflow-x-hidden">
      {/* Hero */}
      <section className="bg-accent text-white relative">
        <Rings className="w-[520px] h-[520px] -right-[120px] -top-[140px]" />
        <header className="relative max-w-[1200px] mx-auto px-4 sm:px-6 py-4 sm:py-[18px] flex flex-wrap items-center justify-between gap-4">
          <Logo to="/" tone="onBlue" />
          <nav aria-label={t('nav.mainNav')} className="hidden lg:flex gap-7 text-[15px]">
            <a href="#how" className="text-accent-on hover:text-white no-underline">{t('nav.how')}</a>
            <a href="#demo" className="text-accent-on hover:text-white no-underline">{t('nav.demo')}</a>
            <a href="#features" className="text-accent-on hover:text-white no-underline">{t('nav.features')}</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-2.5">
            <LangSwitch onBlue compact />
            {user ? (
              <Link to="/app" className="btn bg-sun text-ink font-bold hover:bg-[#FFCF1F] hover:text-ink">{t('landing.ctaDashboard')}</Link>
            ) : (
              <>
                <Link to="/signin" className="btn bg-transparent text-white hover:bg-white/10 hover:text-white px-3">{t('nav.signIn')}</Link>
                <Link to="/signup" className="btn bg-sun text-ink font-bold hover:bg-[#FFCF1F] hover:text-ink hidden sm:inline-flex">{t('nav.tryIt')}</Link>
              </>
            )}
          </div>
        </header>

        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 pb-16 sm:pt-14 sm:pb-24 flex flex-wrap gap-12 items-center">
          <div className="flex-[1_1_500px] min-w-0">
            <p className="mb-6 inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-white/15 font-mono text-[13px] font-medium leading-none">
              <span className="w-2 h-2 rounded-full bg-sun animate-blink" />
              {t('landing.badge')}
            </p>
            <h1 className="mb-6 font-display font-extrabold text-[42px] sm:text-[68px] leading-[1.02] tracking-[-0.04em]">
              {t('landing.titleA')}
              <span className="mark-sun px-3 rounded-[10px]">{t('landing.titleMark')}</span>
            </h1>
            <p className="mb-9 text-lg sm:text-xl leading-[1.55] text-accent-on max-w-[540px]">{t('landing.lead')}</p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-7">
              <Link to={startTo} className="btn-primary btn-lg min-h-[60px] shadow-[0_6px_0_#C9A21A]">
                {t('landing.ctaPrimary')} <Icon.arrowRight className="w-[18px] h-[18px]" />
              </Link>
              <a href="#demo" className="btn-ghost-light btn-lg font-sans font-semibold text-[17px] min-h-[60px]">{t('landing.ctaDemo')}</a>
            </div>
            <div className="flex flex-wrap gap-x-[22px] gap-y-2 text-[15px] text-accent-on">
              {(['free', 'langs', 'mobile'] as const).map((k) => (
                <span key={k} className="inline-flex items-center gap-2">
                  <Icon.check className="w-[18px] h-[18px] text-sun" />
                  {t(`landing.perks.${k}`)}
                </span>
              ))}
            </div>
          </div>
          <HeroArt />
        </div>
      </section>

      {/* Ticker of vacancy titles */}
      <div className="bg-ink text-white py-[18px] overflow-hidden" aria-label={t('landing.tickerLabel')}>
        <div className="flex gap-10 w-max font-display font-semibold text-lg whitespace-nowrap animate-marquee">
          {[...TICKER, ...TICKER].map((title, i) => (
            <span key={i} className="inline-flex items-center gap-10" aria-hidden={i >= TICKER.length}>
              {title}
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="#FFD84D" /></svg>
            </span>
          ))}
        </div>
      </div>

      {/* Pain */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-[72px] flex flex-wrap gap-10 sm:gap-14 items-center">
        <div className="flex-[1_1_420px] min-w-0">
          <p className={`${eyebrow} text-warn`}>{t('landing.pain.eyebrow')}</p>
          <h2 className="display-title mb-5">
            {t('landing.pain.title1')}
            <br />
            {t('landing.pain.title2')}
          </h2>
          <p className="text-lg leading-relaxed text-ink-soft max-w-[520px]">{t('landing.pain.text')}</p>
        </div>
        <div role="img" aria-label={t('landing.pain.alt')} className="flex-[1_1_420px] min-w-0 p-5 sm:p-8 rounded-3xl bg-white border border-line">
          <div className="grid grid-cols-6 gap-2 sm:gap-3" aria-hidden="true">
            {Array.from({ length: 30 }, (_, i) => {
              const hit = i === 8 || i === 21;
              return (
                <div key={i} className={`aspect-[4/3] rounded-[10px] flex items-center justify-center ${hit ? 'bg-sun text-ink' : 'bg-[#ECEEF2] text-night-muted'}`}>
                  <svg viewBox="0 0 26 20" className="w-[60%] max-w-[26px]">
                    <rect x="1.5" y="1.5" width="23" height="17" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
                    <path d="M2.5 3l10.5 8 10.5-8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
                  </svg>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-5 mt-5 text-sm text-ink-soft" aria-hidden="true">
            <span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-[#ECEEF2]" />{t('landing.pain.noReply')}</span>
            <span className="inline-flex items-center gap-2"><span className="w-3.5 h-3.5 rounded bg-sun" />{t('landing.pain.replied')}</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-16 sm:pb-24 scroll-mt-4">
        <p className={`${eyebrow} text-accent`}>{t('landing.how.eyebrow')}</p>
        <h2 className="display-title mb-10">{t('landing.how.title')}</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-6">
          {/* 1: paste */}
          <div className="rounded-3xl bg-white border border-line overflow-hidden">
            <div aria-hidden="true" className="h-[200px] bg-accent-soft flex items-center justify-center relative">
              <div className="w-[220px] p-4 rounded-[14px] bg-white shadow-[0_12px_24px_-12px_rgba(17,19,24,0.25)] -rotate-3">
                <p className="mb-2.5 font-display font-bold text-xs">Junior QA Engineer</p>
                {['100%', '80%', '90%', '60%'].map((w, i) => (
                  <span key={i} className={`block h-1.5 rounded mb-[7px] last:mb-0 ${i === 2 ? 'bg-accent-bar' : 'bg-line'}`} style={{ width: w }} />
                ))}
              </div>
              <span className="absolute right-[50px] bottom-[34px] px-2.5 py-1.5 rounded-lg bg-ink text-white font-mono text-xs font-semibold">Ctrl+V</span>
            </div>
            <div className="p-7">
              <p className="mb-2.5 font-mono font-bold text-sm text-accent">01</p>
              <h3 className="mb-2 font-display font-bold text-[22px] leading-snug">{t('landing.how.s1Title')}</h3>
              <p className="text-base leading-[1.55] text-ink-soft">{t('landing.how.s1Text')}</p>
            </div>
          </div>
          {/* 2: upload */}
          <div className="rounded-3xl bg-white border border-line overflow-hidden">
            <div aria-hidden="true" className="h-[200px] bg-sun-wash flex items-center justify-center gap-3.5">
              {[
                { tag: 'PDF', tagBg: 'bg-warn-strong', line: 'bg-line', rot: '-rotate-6' },
                { tag: 'v2', tagBg: 'bg-accent', line: 'bg-accent-bar', rot: 'rotate-[5deg]' },
              ].map((d) => (
                <div key={d.tag} className={`w-24 h-[124px] rounded-[10px] bg-white shadow-[0_12px_24px_-12px_rgba(17,19,24,0.25)] relative ${d.rot}`}>
                  <span className={`absolute left-2.5 top-2.5 px-1.5 py-[3px] rounded text-white font-mono font-bold text-[10px] ${d.tagBg}`}>{d.tag}</span>
                  <span className={`absolute left-2.5 right-2.5 top-10 h-[5px] rounded ${d.line}`} />
                  <span className={`absolute left-2.5 right-6 top-[52px] h-[5px] rounded ${d.line}`} />
                  <span className="absolute left-2.5 right-4 top-16 h-[5px] rounded bg-line" />
                </div>
              ))}
            </div>
            <div className="p-7">
              <p className="mb-2.5 font-mono font-bold text-sm text-accent">02</p>
              <h3 className="mb-2 font-display font-bold text-[22px] leading-snug">{t('landing.how.s2Title')}</h3>
              <p className="text-base leading-[1.55] text-ink-soft">{t('landing.how.s2Text')}</p>
            </div>
          </div>
          {/* 3: result */}
          <div className="rounded-3xl bg-white border border-line overflow-hidden">
            <div aria-hidden="true" className="h-[200px] bg-ink flex items-center justify-center gap-[18px]">
              <span className="font-mono font-bold text-[44px] text-[#6B7180]">58</span>
              <svg width="40" height="18" viewBox="0 0 40 18"><path d="M2 9h32M28 3l6 6-6 6" stroke="#FFD84D" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="font-mono font-bold text-[72px] text-sun">81</span>
            </div>
            <div className="p-7">
              <p className="mb-2.5 font-mono font-bold text-sm text-accent">03</p>
              <h3 className="mb-2 font-display font-bold text-[22px] leading-snug">{t('landing.how.s3Title')}</h3>
              <p className="text-base leading-[1.55] text-ink-soft">{t('landing.how.s3Text')}</p>
            </div>
          </div>
        </div>
      </section>

      <Demo />

      {/* Features */}
      <section id="features" className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-16 pb-12 sm:pt-24 scroll-mt-4">
        <p className={`${eyebrow} text-accent`}>{t('landing.features.eyebrow')}</p>
        <h2 className="display-title mb-4 max-w-[760px]">{t('landing.features.title')}</h2>
        <p className="mb-12 text-lg text-ink-soft max-w-[640px]">{t('landing.features.lead')}</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-6">
          <div className="rounded-3xl bg-sun p-7 sm:p-9 overflow-hidden">
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <h3 className="font-display font-extrabold text-[24px] sm:text-[28px] leading-[1.2] tracking-[-0.02em]">{t('landing.features.trackerTitle')}</h3>
              <span className="shrink-0 px-2.5 py-1 rounded-full bg-ink/10 font-mono text-xs font-bold uppercase">{t('common.soon')}</span>
            </div>
            <p className="mb-7 text-[17px] leading-[1.55] text-sun-ink">{t('landing.features.trackerText')}</p>
            <div aria-hidden="true" className="grid grid-cols-3 gap-2.5">
              {[
                [t('landing.features.colApplied'), ['bg-white', 'bg-white', 'bg-white']],
                [t('landing.features.colInterview'), ['bg-accent animate-float-a', 'bg-white']],
                [t('landing.features.colOffer'), ['border-2 border-dashed border-ink/30']],
              ].map(([label, cards]) => (
                <div key={label as string} className="p-2.5 rounded-xl bg-ink/[0.08] flex flex-col gap-2">
                  <p className="mb-0.5 font-display font-bold text-xs">{label as string}</p>
                  {(cards as string[]).map((c, i) => (
                    <span key={i} className={`h-11 rounded-lg ${c}`} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-accent text-white p-7 sm:p-9 overflow-hidden">
            <div className="flex items-start justify-between gap-3 mb-2.5">
              <h3 className="font-display font-extrabold text-[24px] sm:text-[28px] leading-[1.2] tracking-[-0.02em]">{t('landing.features.interviewTitle')}</h3>
              <span className="shrink-0 px-2.5 py-1 rounded-full bg-white/15 font-mono text-xs font-bold uppercase">{t('common.soon')}</span>
            </div>
            <p className="mb-7 text-[17px] leading-[1.55] text-accent-on">{t('landing.features.interviewText')}</p>
            <div aria-hidden="true" className="flex flex-col gap-2.5">
              <div className="self-start max-w-[80%] px-4 py-3 rounded-[16px_16px_16px_4px] bg-white text-ink text-sm leading-[1.45]">{t('landing.features.q')}</div>
              <div className="self-end max-w-[80%] px-4 py-3 rounded-[16px_16px_4px_16px] bg-ink text-white text-sm leading-[1.45]">{t('landing.features.a')}</div>
              <div className="self-start inline-flex items-center px-3.5 py-2.5 rounded-xl bg-sun text-ink font-display font-bold text-sm">{t('landing.features.score')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it is for */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pb-24">
        <p className={`${eyebrow} text-accent`}>{t('landing.who.eyebrow')}</p>
        <h2 className="display-title mb-10">{t('landing.who.title')}</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-5">
          {(['dev', 'qa', 'data', 'design'] as const).map((k, i) => (
            <div key={k} className="p-7 rounded-[20px] bg-white border border-line">
              <Avatar variant={i as 0 | 1 | 2 | 3} />
              <h3 className="mb-2 font-display font-bold text-xl leading-snug">{t(`landing.who.${k}Title`)}</h3>
              <p className="text-[15px] leading-[1.55] text-ink-soft">{t(`landing.who.${k}Text`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="max-w-[1200px] mx-auto rounded-[32px] bg-sun px-7 py-12 sm:px-14 sm:py-[72px] relative overflow-hidden">
          <svg viewBox="0 0 320 320" aria-hidden="true" className="absolute w-[200px] h-[200px] sm:w-[320px] sm:h-[320px] -right-[60px] -bottom-[80px]">
            <circle cx="160" cy="160" r="150" fill="#2346D8" />
            <path d="M95 165l45 45 85-95" stroke="#fff" strokeWidth="22" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="relative max-w-[640px]">
            <h2 className="mb-4 font-display font-extrabold text-[36px] sm:text-[52px] leading-[1.05] tracking-[-0.035em]">{t('landing.final.title')}</h2>
            <p className="mb-8 text-lg leading-[1.55] text-sun-ink">{t('landing.final.text')}</p>
            <Link to={startTo} className="btn btn-lg bg-ink text-white hover:bg-ink-2 hover:text-white">
              {t('landing.final.cta')} <Icon.arrowRight className="w-[18px] h-[18px]" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-7 flex flex-wrap gap-4 justify-between items-center text-sm text-ink-muted">
          <p>© 2026 CareerOS · {t('landing.footer.team')}</p>
          <nav aria-label={t('nav.footerNav')} className="flex gap-6">
            <a href="#how" className="text-accent">{t('nav.how')}</a>
            <a href="#features" className="text-accent">{t('nav.features')}</a>
          </nav>
        </div>
      </footer>
    </div>
  );
};
