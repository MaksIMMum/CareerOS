import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { listAnalyses, type AnalysisSummary } from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { scoreColor } from './AnalysisResultPage.js';

export const HistoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<AnalysisSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAnalyses()
      .then(setItems)
      .catch((err) => {
        setItems([]);
        setError(apiErrorMessage(err, t));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t('analysis.history')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('analysis.historySubtitle')}</p>
        </div>
        <Link to="/app/analyses/new" className="self-start sm:self-auto px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm">
          {t('analysis.newBtn')}
        </Link>
      </div>

      {error && <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">{error}</div>}

      {items === null ? (
        <p className="text-sm text-slate-500">{t('analysis.loading')}</p>
      ) : items.length === 0 ? (
        <div className="p-8 bg-white rounded-2xl border border-dashed border-slate-300 text-center text-sm text-slate-600">
          {t('analysis.historyEmpty')}
        </div>
      ) : (
        <ul className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-sm">
          {items.map((a) => (
            <li key={a.id}>
              <Link to={`/app/analyses/${a.id}`} className="flex items-center gap-4 p-4 hover:bg-slate-50">
                <span className={`w-12 text-center text-2xl font-extrabold ${scoreColor(a.matchScore)}`}>{a.matchScore}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-slate-900 truncate">
                    {a.vacancyTitle}
                    {a.company && <span className="text-slate-500 font-normal"> · {a.company}</span>}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    📄 {a.cvName} · {fmt(a.createdAt)}
                    {a.shareScores && ` · 🔗 ${a.shareScores.before} → ${a.shareScores.after}`}
                    {a.flaggedCount > 0 && ' · ⚠️'}
                  </span>
                </span>
                <span className="text-sm text-blue-600 shrink-0">{t('analysis.open')} →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
