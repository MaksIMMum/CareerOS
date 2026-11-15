import React from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, LangSwitch, Logo } from './ui.js';

/** Sign-up / sign-in: form on the right, dark brand panel on the left (stacks below on phones). */
export const AuthSplit: React.FC<{ asideTitle: string; children: React.ReactNode }> = ({ asideTitle, children }) => {
  const { t } = useTranslation();
  const points = [t('auth.aside.point1'), t('auth.aside.point2'), t('auth.aside.point3')];
  return (
    <div className="min-h-screen flex flex-wrap flex-row-reverse bg-canvas">
      <main className="flex-[999_1_560px] min-w-0 flex flex-col p-4 sm:p-6">
        <div className="flex items-center justify-between lg:justify-end">
          <span className="lg:hidden">
            <Logo to="/" size={28} />
          </span>
          <LangSwitch />
        </div>
        <div className="flex-1 flex items-center justify-center py-8 sm:py-10">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>
      </main>
      <aside className="flex-[1_1_420px] min-w-0 px-6 py-10 sm:px-12 bg-night text-white flex flex-col justify-between gap-10">
        <span className="hidden lg:block">
          <Logo to="/" dark />
        </span>
        <div className="max-w-[440px]">
          <h2 className="font-display font-extrabold text-[28px] sm:text-[34px] leading-[1.15] tracking-[-0.02em] mb-7">{asideTitle}</h2>
          <ul className="flex flex-col gap-4">
            {points.map((p) => (
              <li key={p} className="flex gap-3 items-start text-base leading-normal text-[#D6D9E0]">
                <Icon.check className="w-[22px] h-[22px] shrink-0 mt-px text-accent-light" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-night-muted">{t('auth.aside.footer')}</p>
      </aside>
    </div>
  );
};

/** Confirm code / reset password: logo + language on top, one centred column. */
export const AuthCentered: React.FC<{ children: React.ReactNode; width?: string }> = ({ children, width = 'max-w-[480px]' }) => (
  <div className="min-h-screen flex flex-col p-4 sm:p-6 bg-canvas">
    <div className="flex items-center justify-between">
      <Logo to="/" />
      <LangSwitch />
    </div>
    <div className="flex-1 flex items-center justify-center py-10 sm:py-12">
      <div className={`w-full ${width}`}>{children}</div>
    </div>
  </div>
);
