import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { deleteAccount } from '../lib/api.js';

export const PrivacyPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (confirmInput.trim() !== 'DELETE') return;
    setDeleting(true);
    setError(null);

    try {
      await deleteAccount();
      await signOut();
      navigate('/', { replace: true });
    } catch {
      setError(t('privacyPage.deleteError'));
      setDeleting(false);
    }
  };

  return (
    <main className="w-full max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
          <span>🛡️</span>
          <span>{t('privacyPage.badge')}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t('privacyPage.title')}
        </h1>
      </div>

      <div className="space-y-6">
        <section className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🗄️</span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {t('privacyPage.whatWeStoreTitle')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t('privacyPage.whatWeStoreText')}
          </p>
        </section>

        <section className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {t('privacyPage.aiProcessingTitle')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t('privacyPage.aiProcessingText')}
          </p>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 font-medium">
            ⚠️ {t('privacyPage.noSensitiveDataNotice')}
          </div>
        </section>

        <section className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🧩</span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {t('privacyPage.extensionTitle')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {t('privacyPage.extensionText')}
          </p>
        </section>

        {user && (
          <section className="bg-white p-6 sm:p-7 rounded-2xl border border-red-200 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚠️</span>
              <h2 className="text-base sm:text-lg font-bold text-red-700">
                {t('privacyPage.deleteAccountTitle')}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t('privacyPage.deleteAccountText')}
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
              >
                🗑️ {t('privacyPage.deleteBtn')}
              </button>
            </div>
          </section>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-red-600 mb-2">
              {t('privacyPage.confirmModalTitle')}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {t('privacyPage.confirmModalText')}
            </p>

            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('privacyPage.typeConfirm')}
            </label>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="DELETE"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono tracking-widest text-slate-900 uppercase focus:border-red-500 focus:outline-none mb-4"
            />

            {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setShowModal(false);
                  setConfirmInput('');
                }}
                className="rounded-xl px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                {t('privacyPage.cancel')}
              </button>
              <button
                type="button"
                disabled={confirmInput.trim() !== 'DELETE' || deleting}
                onClick={handleDelete}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40 shadow-sm"
              >
                {deleting ? t('privacyPage.deleting') : t('privacyPage.confirmDelete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
