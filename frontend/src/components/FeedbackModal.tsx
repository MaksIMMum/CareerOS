import React from 'react';
import { useTranslation } from 'react-i18next';
import { FeedbackCard } from './FeedbackCard.js';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  context = 'general',
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">{t('feedback.modalTitle')}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title={t('feedback.close')}
          >
            ✕
          </button>
        </div>

        <div className="p-6 max-h-[85vh] overflow-y-auto">
          <FeedbackCard context={context} onSubmitted={() => setTimeout(onClose, 2500)} />
        </div>
      </div>
    </div>
  );
};
