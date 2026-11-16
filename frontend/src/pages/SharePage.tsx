import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPublicShare, type PublicShare } from '../lib/api.js';
import { Icon, LangSwitch, LogoMark, Rings } from '../components/ui.js';

/** Public read-only card behind /s/<id>: job title + score before → after. No CV text. */
export const SharePage: React.FC = () => {
  const { t } = useTranslation();
  const { shareId = '' } = useParams();
  const [data, setData] = useState<PublicShare | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    getPublicShare(shareId).then(setData).catch(() => setMissing(true));
  }, [shareId]);

  return (
    <div className="min-h-screen flex flex-col bg-canvas p-4 sm:p-6">
      <div className="flex justify-end">
        <LangSwitch />
      </div>
      <main className="flex-1 flex items-center justify-center py-8">
        <article className="w-full max-w-[1100px] rounded-[28px] bg-accent text-white px-6 py-8 sm:px-16 sm:py-14 flex flex-col gap-10 relative overflow-hidden">
          <Rings className="w-[620px] h-[620px] -right-[180px] -top-[200px]" />
          <div className="relative flex items-center">
            <Link to="/?src=share" className="flex items-center gap-3.5 text-white no-underline hover:text-white">
              <LogoMark size={44} light />
              <span className="font-display font-extrabold text-2xl sm:text-[28px] leading-none tracking-[-0.02em]">CareerOS</span>
            </Link>
          </div>

          <div className="relative flex flex-wrap items-center justify-between gap-10">
            <div className="flex-[1_1_360px] min-w-0 max-w-[560px]">
              <p className="mb-3.5 font-mono text-base sm:text-xl text-accent-on">{t('sharePage.label')}</p>
              {missing ? (
                <p className="text-2xl font-display font-extrabold">{t('sharePage.notFound')}</p>
              ) : (
                <h1 className="mb-4 font-display font-extrabold text-[32px] sm:text-[52px] leading-[1.05] tracking-[-0.03em] break-words">
                  {data ? data.jobTitle : t('analysis.loading')}
                </h1>
              )}
              <p className="text-lg sm:text-[22px] leading-[1.4] text-accent-on">{t('sharePage.tagline')}</p>
            </div>
            {data && (
              <div className="relative flex items-center gap-4 sm:gap-5 text-ink mx-auto sm:mx-0 sm:mr-6">
                <div aria-hidden="true" className="absolute w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] rounded-full bg-sun left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <div className="relative text-center">
                  <p className="mb-1.5 font-semibold text-base sm:text-lg">{t('sharePage.before')}</p>
                  <p className="font-mono font-bold text-[64px] sm:text-[96px] leading-[0.9] opacity-45">{data.scoreBefore}</p>
                </div>
                <svg viewBox="0 0 56 28" className="relative w-10 sm:w-14" aria-hidden="true">
                  <path d="M3 14h44M37 4l10 10-10 10" stroke="#111318" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="relative text-center">
                  <p className="mb-1.5 font-semibold text-base sm:text-lg">{t('sharePage.after')}</p>
                  <p className="font-mono font-bold text-[96px] sm:text-[150px] leading-[0.85]">{data.scoreAfter}</p>
                </div>
              </div>
            )}
          </div>

          <div className="relative flex flex-wrap justify-between items-center gap-5">
            <p className="font-mono font-semibold text-sm sm:text-xl text-accent-on">{t('sharePage.ctaHint')}</p>
            <Link to="/?src=share" className="btn btn-lg w-full sm:w-auto bg-ink text-sun hover:bg-ink-2 hover:text-sun">
              {t('sharePage.cta')} <Icon.arrowRight className="w-[18px] h-[18px]" />
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
};
