import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/* ---------- Icons: inline stroke SVGs, colour comes from `currentColor`. ---------- */

type IconProps = { className?: string };
const svg = (path: React.ReactNode, { className = 'w-5 h-5' }: IconProps, sw = 1.8) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

export const Icon = {
  check: (p: IconProps) => svg(<path d="M5 12.5l4.5 4.5L19 7" />, p, 2.2),
  arrowRight: (p: IconProps) => svg(<path d="M5 12h14M13 6l6 6-6 6" />, p, 2.2),
  arrowLeft: (p: IconProps) => svg(<path d="M19 12H5M11 6l-6 6 6 6" />, p, 2),
  warn: (p: IconProps) => svg(<><path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.5" /></>, p),
  info: (p: IconProps) => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.5" /></>, p),
  upload: (p: IconProps) => svg(<path d="M12 16V4M7 9l5-5 5 5M5 20h14" />, p),
  search: (p: IconProps) => svg(<><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></>, p),
  columns: (p: IconProps) => svg(<><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="7" rx="1.5" /></>, p),
  chat: (p: IconProps) => svg(<path d="M4 5h16v10H9l-5 4z" />, p),
  eye: (p: IconProps) => svg(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>, p),
  eyeOff: (p: IconProps) => svg(<><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.6 0 3-.4 4.3-1" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></>, p),
  mail: (p: IconProps) => svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5L12 13l8.5-6.5" /></>, p),
  doc: (p: IconProps) => svg(<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>, p),
  clock: (p: IconProps) => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, p),
  copy: (p: IconProps) => svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h8" /></>, p),
  share: (p: IconProps) => svg(<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></>, p),
  plus: (p: IconProps) => svg(<path d="M12 5v14M5 12h14" />, p, 2.2),
  menu: (p: IconProps) => svg(<path d="M4 7h16M4 12h16M4 17h16" />, p, 2),
  shield: (p: IconProps) => svg(<><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5L15.5 10" /></>, p),
};

/* ---------- Brand ---------- */

export const LogoMark: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
    <rect width="32" height="32" rx="8" fill="#2346D8" />
    <path d="M9 16.5l4.5 4.5L23 11" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Logo: React.FC<{ to: string; size?: number; dark?: boolean }> = ({ to, size = 32, dark }) => (
  <Link to={to} className={`flex items-center gap-2.5 no-underline ${dark ? 'text-white hover:text-white' : 'text-ink hover:text-ink'}`}>
    <LogoMark size={size} />
    <span className="font-display font-extrabold text-xl leading-none tracking-[-0.02em]">CareerOS</span>
  </Link>
);

/* ---------- Language switch: segmented UA | EN ---------- */

export const LangSwitch: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { t, i18n } = useTranslation();
  const current = i18n.language === 'en' ? 'en' : 'uk';
  const options: Array<['uk' | 'en', string]> = [
    ['uk', 'UA'],
    ['en', 'EN'],
  ];
  return (
    <div role="group" aria-label={t('nav.language')} className="flex border border-line-strong rounded-lg overflow-hidden font-mono text-[13px] font-semibold leading-none shrink-0">
      {options.map(([lng, label]) => (
        <button
          key={lng}
          type="button"
          aria-pressed={current === lng}
          onClick={() => void i18n.changeLanguage(lng)}
          className={`${compact ? 'px-2.5' : 'px-3'} min-h-[40px] ${current === lng ? 'bg-ink text-white' : 'bg-white text-ink-soft hover:bg-canvas'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

/* ---------- Messages ---------- */

export const ErrorAlert: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div role="alert" className={`alert-warn ${className}`}>
    <Icon.info className="w-5 h-5 shrink-0 mt-px" />
    <div className="min-w-0">{children}</div>
  </div>
);

export const OkAlert: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div role="status" className={`alert-ok ${className}`}>
    <Icon.check className="w-5 h-5 shrink-0 mt-px" />
    <div className="min-w-0">{children}</div>
  </div>
);

/* ---------- Password field with show/hide ---------- */

export const PasswordInput: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { invalid?: boolean }
> = ({ invalid, className = '', ...rest }) => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...rest} type={show ? 'text' : 'password'} className={`field pr-14 ${invalid ? 'field-error' : ''} ${className}`} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
        className="absolute right-1 top-1 w-11 h-11 flex items-center justify-center text-ink-muted hover:text-ink rounded-lg"
      >
        {show ? <Icon.eyeOff /> : <Icon.eye />}
      </button>
    </div>
  );
};

/** 0–3: empty, under 8, 8+, 12+ with mixed character classes. */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  if (pw.length < 8) return 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  return pw.length >= 12 && classes >= 2 ? 3 : 2;
}

export const StrengthBar: React.FC<{ password: string }> = ({ password }) => {
  const { t } = useTranslation();
  const level = passwordStrength(password);
  return (
    <div className="flex gap-1.5 mt-2.5" role="img" aria-label={t('auth.strength', { level })}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`flex-1 h-1 rounded-full ${i <= level ? (level === 1 ? 'bg-warn-strong' : 'bg-accent') : 'bg-line-strong'}`} />
      ))}
    </div>
  );
};

/* ---------- Scores ---------- */

/** Text colour for a 0–100 score: accent when decent, orange when low (blue/orange, not red/green). */
export const scoreColor = (s: number) => (s >= 50 ? 'text-accent' : 'text-warn-strong');
const ringColor = (s: number) => (s >= 50 ? '#2346D8' : '#C2410C');

export const ScoreRing: React.FC<{ score: number; size?: number }> = ({ score, size = 148 }) => {
  const { t } = useTranslation();
  const r = 64;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 148 148" className="w-full h-full -rotate-90" role="img" aria-label={t('analysis.scoreAria', { score })}>
        <circle cx="74" cy="74" r={r} fill="none" stroke="#E3E5EA" strokeWidth="12" />
        <circle cx="74" cy="74" r={r} fill="none" stroke={ringColor(score)} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="font-mono font-bold leading-none" style={{ fontSize: size * 0.3 }}>{score}</span>
        <span className="text-[13px] text-ink-muted mt-1">{t('analysis.of100')}</span>
      </div>
    </div>
  );
};

export const Spinner: React.FC = () => (
  <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" aria-hidden="true" />
);
