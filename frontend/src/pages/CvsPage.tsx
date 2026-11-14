import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createCv,
  deleteCv,
  getCv,
  listCvs,
  updateCv,
  type CvSummary,
} from '../lib/api.js';
import { apiErrorMessage } from '../lib/apiErrors.js';
import { LIMITS } from '../lib/limits.js';
import { extractPdfText, PdfExtractError } from '../lib/pdf.js';

type Editor = { id: string | null; name: string; text: string };

const inputClass =
  'w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm bg-white';

export const CvsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);

  const [cvs, setCvs] = useState<CvSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState<null | 'extracting' | 'saving' | 'opening'>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setCvs(await listCvs());
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetMessages = () => {
    setError(null);
    setNotice(null);
  };

  const startNew = () => {
    resetMessages();
    setEditor({ id: null, name: '', text: '' });
  };

  const openCv = async (id: string) => {
    resetMessages();
    setBusy('opening');
    try {
      const cv = await getCv(id);
      setEditor({ id: cv.id, name: cv.name, text: cv.text });
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const onPdfChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    if (!file || !editor) return;
    resetMessages();
    setBusy('extracting');
    try {
      const { text, pages } = await extractPdfText(file);
      const suggestedName = file.name.replace(/\.pdf$/i, '').slice(0, LIMITS.CV_NAME_MAX);
      setEditor((ed) => ed && { ...ed, text, name: ed.name || suggestedName });
      setNotice(t('cvs.extracted', { pages }));
    } catch (err) {
      const code = err instanceof PdfExtractError ? err.code : 'unreadable';
      setError(t(`cvs.pdfErrors.${code}`));
    } finally {
      setBusy(null);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    resetMessages();
    setBusy('saving');
    try {
      const data = { name: editor.name.trim(), text: editor.text.trim() };
      const saved = editor.id ? await updateCv(editor.id, data) : await createCv(data);
      setEditor({ id: saved.id, name: saved.name, text: saved.text });
      setNotice(t('cvs.saved'));
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (cv: CvSummary) => {
    if (!window.confirm(t('cvs.deleteConfirm', { name: cv.name }))) return;
    resetMessages();
    try {
      await deleteCv(cv.id);
      if (editor?.id === cv.id) setEditor(null);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err, t));
    }
  };

  const chars = editor?.text.trim().length ?? 0;
  const over = chars - LIMITS.CV_TEXT_MAX;
  const canSave = !!editor && editor.name.trim() !== '' && chars > 0 && over <= 0 && !busy;
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{t('cvs.title')}</h1>
          <p className="mt-1 text-sm text-slate-600">{t('cvs.subtitle')}</p>
        </div>
        <button
          onClick={startNew}
          className="self-start sm:self-auto px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm"
        >
          {t('cvs.newBtn')}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6">
        {/* Saved versions */}
        <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm self-start">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            {t('cvs.listTitle')}
          </h2>
          {loadingList ? (
            <p className="text-sm text-slate-500">{t('cvs.loading')}</p>
          ) : cvs.length === 0 ? (
            <p className="text-sm text-slate-500">{t('cvs.empty')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {cvs.map((cv) => (
                <li
                  key={cv.id}
                  className={`py-3 flex items-center justify-between gap-3 ${editor?.id === cv.id ? 'bg-blue-50/60 -mx-2 px-2 rounded-lg' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">📄 {cv.name}</p>
                    <p className="text-xs text-slate-500">{t('cvs.updated', { date: formatDate(cv.updatedAt) })}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => void openCv(cv.id)}
                      disabled={!!busy}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                    >
                      {t('cvs.edit')}
                    </button>
                    <button
                      onClick={() => void remove(cv)}
                      disabled={!!busy}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      {t('cvs.delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Editor */}
        {editor ? (
          <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {editor.id ? t('cvs.editorEditTitle') : t('cvs.editorNewTitle')}
            </h2>

            <div className="p-3 sm:p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={onPdfChosen}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={!!busy}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded-xl disabled:opacity-50"
              >
                📎 {busy === 'extracting' ? t('cvs.extracting') : t('cvs.uploadPdf')}
              </button>
              <p className="mt-2 text-xs text-slate-500">{t('cvs.uploadHint')}</p>
              <p className="mt-1 text-xs text-slate-500">{t('cvs.orPaste')}</p>
            </div>

            <div>
              <label htmlFor="cv-name" className="block text-sm font-medium text-slate-700 mb-1">
                {t('cvs.nameLabel')}
              </label>
              <input
                id="cv-name"
                value={editor.name}
                maxLength={LIMITS.CV_NAME_MAX}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder={t('cvs.namePlaceholder')}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="cv-text" className="block text-sm font-medium text-slate-700 mb-1">
                {t('cvs.textLabel')}
              </label>
              <textarea
                id="cv-text"
                value={editor.text}
                onChange={(e) => setEditor({ ...editor, text: e.target.value })}
                placeholder={t('cvs.textPlaceholder')}
                rows={14}
                className={`${inputClass} font-mono text-[13px] leading-relaxed min-h-[16rem]`}
              />
              <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs">
                <span className="text-slate-500">{t('cvs.privacyNote')}</span>
                <span className={over > 0 ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                  {t('cvs.chars', { count: chars, max: LIMITS.CV_TEXT_MAX })}
                </span>
              </div>
              {over > 0 && (
                <p className="mt-1 text-xs text-red-600">
                  {t('cvs.tooLong', { over, max: LIMITS.CV_TEXT_MAX })}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setEditor(null);
                }}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-xl"
              >
                {t('cvs.cancel')}
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm"
              >
                {busy === 'saving' ? t('cvs.saving') : t('cvs.save')}
              </button>
            </div>
          </form>
        ) : (
          <div className="hidden lg:flex items-center justify-center rounded-2xl border border-dashed border-slate-300 p-10 text-sm text-slate-500 text-center">
            {busy === 'opening' ? t('cvs.loading') : cvs.length ? t('cvs.pickHint') : t('cvs.empty')}
          </div>
        )}
      </div>
    </div>
  );
};
