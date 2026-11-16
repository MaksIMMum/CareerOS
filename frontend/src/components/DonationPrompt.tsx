import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { recordDonationClick, reportDonation } from '../lib/api.js';
import { DEFAULT_DONATION_URL } from '../lib/donation.js';

interface DonationPromptProps {
  className?: string;
}

export const DonationPrompt: React.FC<DonationPromptProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const jarUrl = import.meta.env.VITE_DONATION_URL || DEFAULT_DONATION_URL;

  const [clicked, setClicked] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenJar = () => {
    // Open first, inside the tap itself: mobile browsers block pop-ups opened after an await.
    window.open(jarUrl, '_blank', 'noopener,noreferrer');
    setClicked(true);
    void recordDonationClick(jarUrl).catch(() => undefined); // non-blocking telemetry
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const parsedAmount = amount.trim() ? parseFloat(amount.trim()) : undefined;

    try {
      await reportDonation({
        amount: parsedAmount && !isNaN(parsedAmount) ? parsedAmount : undefined,
        currency: 'UAH',
        jarUrl,
      });
      setReported(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to record donation');
    } finally {
      setSubmitting(false);
    }
  };

  if (reported) {
    return (
      <div className={`rounded-2xl border border-amber-300 bg-amber-50/80 p-5 sm:p-6 text-center ${className}`}>
        <span className="text-3xl block mb-2">💛💙</span>
        <h3 className="text-base font-bold text-amber-950">{t('donation.reportedTitle')}</h3>
        <p className="mt-1 text-xs text-amber-900 font-medium">{t('donation.thanks')}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-2 border-dashed border-amber-300 bg-gradient-to-br from-amber-50/60 to-yellow-50/40 p-5 sm:p-6 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">🇺🇦</span>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
            {t('donation.title')}
          </h3>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            {t('donation.desc')}
          </p>

          <div className="mt-3 inline-block rounded-xl bg-amber-100/70 px-3 py-1.5 text-[11px] font-medium text-amber-900">
            ℹ️ {t('donation.commentHint')}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleOpenJar}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-sm"
            >
              <span>💳</span> {t('donation.jarBtn')}
            </button>

            {clicked && !showReportForm && (
              <button
                type="button"
                onClick={() => setShowReportForm(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400 bg-white px-3.5 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-50 transition-colors"
              >
                <span>✅</span> {t('donation.reportedBtn')}
              </button>
            )}
          </div>

          {showReportForm && (
            <form onSubmit={handleReport} className="mt-4 pt-3 border-t border-amber-200/60 flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-700 font-medium w-full sm:w-auto">
                {t('donation.amountPrompt')}
              </label>
              <input
                type="number"
                min={1}
                max={100000}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={t('donation.amountPlaceholder')}
                className="w-28 rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {submitting ? t('donation.submitting') : t('donation.submitReport')}
              </button>
            </form>
          )}

          {error && (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
};
