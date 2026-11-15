import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPublicShare, type PublicShare } from '../lib/api.js';
import { LangSwitch, LogoMark } from '../components/ui.js';

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
      <div className="flex-1 flex items-center justify-center py-8">
        <article className="w-full max-w-[1000px] rounded-[20px] bg-night text-white p-6 sm:p-12 lg:px-[72px] lg:py-16 flex flex-col gap-10 sm:gap-14">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <Link to="/?src=share" className="flex items-center gap-3 text-white no-underline hover:text-white">
              <LogoMark size={40} />
              <span className="font-display font-extrabold text-2xl sm:text-[28px] leading-none tracking-[-0.02em]">CareerOS</span>
            </Link>
            <span className="font-mono text-sm sm:text-lg text-night-muted">{t('sharePage.title')}</span>
          </div>

          {missing ? (
            <p className="text-lg text-night-text">{t('sharePage.notFound')}</p>
          ) : !data ? (
            <p className="text-night-muted">{t('analysis.loading')}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-6 sm:gap-14">
              <div>
                <p className="mb-2 text-base sm:text-xl text-night-muted">{t('sharePage.before')}</p>
                <p className="font-mono font-bold text-[72px] sm:text-[140px] leading-[0.9] text-[#6B7180]">{data.scoreBefore}</p>
              </div>
              <svg viewBox="0 0 96 40" className="w-14 sm:w-24 text-[#6B7180]" aria-hidden="true">
                <path d="M4 20h80M68 6l16 14-16 14" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <p className="mb-2 text-base sm:text-xl text-night-muted">{t('sharePage.after')}</p>
                <p className="font-mono font-bold text-[96px] sm:text-[200px] leading-[0.85] text-accent-light">{data.scoreAfter}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-between items-end gap-6 sm:gap-8">
            <div className="min-w-0 flex-[1_1_320px]">
              {data && <h1 className="mb-2 font-display font-extrabold text-2xl sm:text-4xl leading-[1.15] tracking-[-0.02em] break-words">{data.jobTitle}</h1>}
              <p className="text-base sm:text-xl text-night-muted">{t('sharePage.tagline')}</p>
            </div>
            <div className="w-full sm:w-auto">
              <Link to="/?src=share" className="btn btn-lg w-full sm:w-auto bg-white text-ink hover:bg-canvas hover:text-ink whitespace-nowrap">
                {t('sharePage.cta')}
              </Link>
              <p className="mt-2 text-sm text-night-muted text-center">{t('sharePage.ctaHint')}</p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
};
