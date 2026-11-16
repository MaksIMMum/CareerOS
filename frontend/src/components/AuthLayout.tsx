import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, LangSwitch, Logo, Rings } from './ui.js';

/** Sign-up / sign-in: form on the right, illustrated panel on the left (below the form on phones). */
export const AuthSplit: React.FC<{ aside: React.ReactNode; children: React.ReactNode }> = ({ aside, children }) => (
  <div className="min-h-screen flex flex-wrap flex-row-reverse bg-canvas">
    <main className="flex-[999_1_560px] min-w-0 flex flex-col px-4 py-5 sm:px-8 sm:py-6">
      <div className="flex items-center justify-between gap-4">
        <Logo to="/" />
        <LangSwitch />
      </div>
      <div className="flex-1 flex items-center justify-center py-8 sm:py-10">
        <div className="w-full max-w-[460px]">{children}</div>
      </div>
    </main>
    {aside}
  </div>
);

const Perk: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-flex items-center gap-2">
    <Icon.check className="w-[18px] h-[18px] text-sun" />
    {children}
  </span>
);

/** Blue panel: a CV being scanned while its score counts up and missing skills pop in. */
export const SignUpAside: React.FC<{ score: number }> = ({ score }) => {
  const { t } = useTranslation();
  const c = 2 * Math.PI * 52;
  return (
    <aside className="flex-[1_1_480px] min-w-0 px-6 py-12 sm:px-12 sm:py-14 bg-accent text-white flex flex-col justify-center gap-12 relative overflow-hidden">
      <Rings className="w-[520px] h-[520px] -left-[180px] -bottom-[200px]" />
      <div className="relative max-w-[460px]">
        <p className="mb-5 inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-white/15 font-mono text-[13px] font-medium leading-none">
          <span className="w-2 h-2 rounded-full bg-sun animate-blink" />
          {t('auth.aside.signUpBadge')}
        </p>
        <h2 className="font-display font-extrabold text-[30px] sm:text-[40px] leading-[1.08] tracking-[-0.03em]">
          {t('auth.aside.signUpTitleA')}
          <span className="mark-sun">{t('auth.aside.signUpTitleMark')}</span>
        </h2>
      </div>

      <div aria-hidden="true" className="relative hidden sm:block h-[380px] max-w-[460px] w-full">
        <div className="absolute w-[300px] h-[300px] rounded-full bg-sun left-[70px] top-[30px]" />
        <div className="absolute left-10 top-2.5 w-[300px] p-5 rounded-[20px] bg-white text-ink shadow-deep animate-float-a">
          <div className="flex gap-3 items-center mb-4">
            <div className="relative w-9 h-[46px] rounded-md bg-warn-chip overflow-hidden shrink-0">
              {[12, 20, 28].map((top, i) => (
                <span key={top} className="absolute left-1.5 h-[3px] bg-warn-border" style={{ top, right: [6, 10, 8][i] }} />
              ))}
              <span className="absolute left-0 right-0 h-[3px] bg-accent animate-scan" />
            </div>
            <div>
              <p className="mb-1 text-sm font-semibold leading-tight">CV.pdf</p>
              <p className="font-mono text-[11px] text-ink-muted">Junior QA Engineer</p>
            </div>
          </div>
          <div className="flex items-center gap-[18px]">
            <div className="relative w-[104px] h-[104px] shrink-0">
              <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
                <circle cx="62" cy="62" r="52" stroke="#E3E5EA" strokeWidth="12" fill="none" />
                <circle cx="62" cy="62" r="52" stroke="#2346D8" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-[32px]">{score}</div>
            </div>
            <div className="flex flex-col gap-1.5 items-start">
              <span className="chip-ok text-xs px-2.5 py-[5px]">{t('auth.aside.skillTestCases')}</span>
              <span className="chip-miss text-xs px-2.5 py-[5px] animate-pop1">Postman</span>
              <span className="chip-miss text-xs px-2.5 py-[5px] animate-pop2">SQL</span>
              <span className="chip-miss text-xs px-2.5 py-[5px] animate-pop3">Jira</span>
            </div>
          </div>
        </div>
        <div className="absolute right-0 bottom-5 w-[220px] p-4 rounded-2xl bg-ink text-white shadow-deep rotate-[4deg] animate-float-b">
          <p className="mb-1.5 font-display font-bold text-[15px] leading-snug">{t('auth.aside.noInventTitle')}</p>
          <p className="text-[13px] leading-[1.45] text-night-text">{t('auth.aside.noInventText')}</p>
        </div>
      </div>

      <div className="relative flex flex-wrap gap-x-[22px] gap-y-2.5 text-[15px] text-accent-on">
        <Perk>{t('auth.aside.free')}</Perk>
        <Perk>{t('auth.aside.noCard')}</Perk>
        <Perk>{t('auth.aside.langs')}</Perk>
      </div>
    </aside>
  );
};

/** Dark panel: an example of the coming application tracker (labelled as an example). */
export const SignInAside: React.FC = () => {
  const { t } = useTranslation();
  return (
    <aside className="flex-[1_1_480px] min-w-0 px-6 py-12 sm:px-12 sm:py-14 bg-night text-white flex flex-col justify-center gap-11 relative overflow-hidden">
      <div aria-hidden="true" className="absolute w-[380px] h-[380px] rounded-full bg-accent -right-[120px] -top-[120px]" />
      <div aria-hidden="true" className="absolute w-[120px] h-[120px] rounded-[28px] bg-sun -left-10 bottom-[60px] rotate-[18deg]" />
      <div className="relative max-w-[460px]">
        <h2 className="mb-3.5 font-display font-extrabold text-[30px] sm:text-[40px] leading-[1.08] tracking-[-0.03em]">
          {t('auth.aside.signInTitleA')}
          <span className="text-sun">{t('auth.aside.signInTitleMark')}</span>
        </h2>
        <p className="text-[17px] leading-[1.55] text-night-text">{t('auth.aside.signInText')}</p>
      </div>

      <div aria-hidden="true" className="relative hidden sm:flex flex-col gap-3.5 max-w-[460px] w-full">
        <div className="p-5 rounded-[20px] bg-white text-ink shadow-deep animate-float-a">
          <p className="eyebrow mb-3.5 text-[11px]">{t('auth.aside.whichCv')}</p>
          {[
            ['Backend CV', 50, 'bg-accent'],
            ['General CV', 13, 'bg-ink-faint'],
          ].map(([name, pct, color]) => (
            <div key={name as string} className="mb-3 last:mb-0">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-semibold">{name}</span>
                <span className="font-mono font-bold text-[13px]">{pct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-[#ECEEF2] overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 p-3 rounded-[18px] bg-night-card border border-night-line">
          <div>
            <p className="mb-2 font-display font-bold text-xs text-night-muted">{t('auth.aside.applied')}</p>
            <div className="px-3 py-2.5 rounded-[10px] bg-white text-ink">
              <p className="font-display font-bold text-xs">Kalyna Data</p>
              <p className="text-[11px] text-ink-muted">Junior Data Engineer</p>
            </div>
          </div>
          <div>
            <p className="mb-2 font-display font-bold text-xs text-sun">{t('auth.aside.interview')}</p>
            <div className="h-11 rounded-[10px] border-[1.5px] border-dashed border-[#4A4F5C]" />
          </div>
        </div>
        <div className="self-end inline-flex items-center gap-2.5 px-4 py-3 rounded-[14px] bg-sun text-ink font-display font-bold text-sm animate-float-b">
          <span className="w-2.5 h-2.5 rounded-full bg-ink" />
          {t('auth.aside.reminder')}
        </div>
      </div>
      <p className="relative text-[13px] text-ink-faint">{t('auth.aside.example')}</p>
    </aside>
  );
};

/** Confirm code: full blue page with a yellow sun in the corner and one centred card. */
export const AuthBlue: React.FC<{ topRight?: React.ReactNode; children: React.ReactNode }> = ({ topRight, children }) => (
  <div className="min-h-screen flex flex-col px-4 py-5 sm:px-8 sm:py-6 bg-accent relative overflow-hidden">
    <Rings className="w-[620px] h-[620px] -left-[200px] -top-[220px]" />
    <div aria-hidden="true" className="absolute w-[260px] h-[260px] rounded-full bg-sun -right-20 -bottom-20" />
    <div className="relative flex items-center justify-between gap-4">
      <Logo to="/" tone="onBlue" />
      {topRight}
    </div>
    <div className="relative flex-1 flex items-center justify-center pt-20 pb-10 sm:pt-24 sm:pb-12">
      <div className="w-full max-w-[500px]">{children}</div>
    </div>
  </div>
);

/** Reset password: dark page with a blue circle and a tilted yellow square. */
export const AuthDark: React.FC<{ topRight?: React.ReactNode; children: React.ReactNode }> = ({ topRight, children }) => (
  <div className="min-h-screen flex flex-col px-4 py-5 sm:px-8 sm:py-6 bg-night relative overflow-hidden">
    <div aria-hidden="true" className="absolute w-[420px] h-[420px] rounded-full bg-accent -left-[140px] -bottom-[160px]" />
    <div aria-hidden="true" className="absolute hidden sm:block w-[140px] h-[140px] rounded-[32px] bg-sun right-20 top-[90px] rotate-[16deg]" />
    <div className="relative flex items-center justify-between gap-4">
      <Logo to="/" tone="onDark" />
      {topRight}
    </div>
    <main className="relative flex-1 flex items-center justify-center py-10 sm:py-12">
      <div className="w-full max-w-[480px]">{children}</div>
    </main>
  </div>
);
