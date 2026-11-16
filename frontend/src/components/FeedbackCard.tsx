import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { submitFeedback } from '../lib/api.js';

interface FeedbackCardProps {
  context?: string;
  onSubmitted?: () => void;
  className?: string;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  context = 'general',
  onSubmitted,
  className = '',
}) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState<number>(5);
  const [useful, setUseful] = useState('');
  const [confusing, setConfusing] = useState('');
  const [callRequested, setCallRequested] = useState(false);
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await submitFeedback({
        rating,
        useful: useful.trim(),
        confusing: confusing.trim(),
        callRequested,
        contact: callRequested ? contact.trim() : undefined,
        context,
      });
      setSubmitted(true);
      onSubmitted?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={`rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 text-center ${className}`}>
        <span className="text-3xl block mb-2">🎉</span>
        <h3 className="text-base font-bold text-emerald-900">{t('feedback.thanks')}</h3>
        <p className="mt-1 text-xs text-emerald-700">{t('feedback.thanksSub')}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">💬</span>
        <h3 className="font-bold text-slate-900 text-sm sm:text-base">{t('feedback.cardTitle')}</h3>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {t('feedback.ratingPrompt')}
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className={`w-9 h-9 rounded-xl text-sm font-bold flex items-center justify-center transition-all ${
                  rating >= star
                    ? 'bg-amber-400 text-slate-900 shadow-sm scale-105'
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
              >
                ★
              </button>
            ))}
            <span className="ml-2 text-xs font-semibold text-slate-600">{rating} / 5</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {t('feedback.usefulLabel')}
          </label>
          <textarea
            rows={2}
            value={useful}
            onChange={(e) => setUseful(e.target.value)}
            placeholder={t('feedback.usefulPlaceholder')}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            {t('feedback.confusingLabel')}
          </label>
          <textarea
            rows={2}
            value={confusing}
            onChange={(e) => setConfusing(e.target.value)}
            placeholder={t('feedback.confusingPlaceholder')}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={callRequested}
              onChange={(e) => setCallRequested(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-blue-900">
              {t('feedback.callPrompt')}
            </span>
          </label>

          {callRequested && (
            <div className="mt-2.5 pl-6">
              <label className="block text-[11px] text-slate-600 mb-1">
                {t('feedback.contactLabel')}
              </label>
              <input
                type="text"
                required={callRequested}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={t('feedback.contactPlaceholder')}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {submitting ? t('feedback.submitting') : t('feedback.submitBtn')}
        </button>
      </form>
    </div>
  );
};
