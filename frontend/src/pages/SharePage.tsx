import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPublicShare, type PublicShare } from '../lib/api.js';
import { scoreColor } from './AnalysisResultPage.js';

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
    <div className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-8 text-center">
        {missing ? (
          <p className="text-slate-600">{t('sharePage.notFound')}</p>
        ) : !data ? (
          <p className="text-sm text-slate-500">{t('analysis.loading')}</p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('sharePage.title')}</p>
            <h1 className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 break-words">«{data.jobTitle}»</h1>
            <p className="mt-6 text-6xl font-extrabold tracking-tight">
              <span className={scoreColor(data.scoreBefore)}>{data.scoreBefore}</span>
              <span className="text-slate-300 mx-3">→</span>
              <span className={scoreColor(data.scoreAfter)}>{data.scoreAfter}</span>
            </p>
            {data.scoreAfter > data.scoreBefore && (
              <p className="mt-2 inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold">
                +{data.scoreAfter - data.scoreBefore}
              </p>
            )}
            <p className="mt-3 text-sm text-slate-500">{t('sharePage.scoreLine')}</p>
          </>
        )}
        <Link to="/?src=share" className="mt-8 block w-full py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm">
          {t('sharePage.cta')}
        </Link>
        <p className="mt-2 text-xs text-slate-500">{t('sharePage.ctaHint')}</p>
      </div>
    </div>
  );
};
