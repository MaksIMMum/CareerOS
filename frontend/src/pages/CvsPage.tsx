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
import { ErrorAlert, Icon, OkAlert, PageHero } from '../components/ui.js';

type Editor = { id: string | null; name: string; text: string };

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
    <div className="flex-1">
      <PageHero
        overlap
        eyebrow={t('cvs.eyebrow')}
        title={t('cvs.title')}
        lead={t('cvs.subtitle')}
        aside={
          <button type="button" onClick={startNew} className="btn-primary btn-lg">
            {t('cvs.newBtn')}
          </button>
        }
      />
    <main className="relative max-w-[1240px] w-full mx-auto -mt-16 sm:-mt-20 px-4 sm:px-6 pb-16">
      {error && <ErrorAlert className="mb-6">{error}</ErrorAlert>}
      {notice && <OkAlert className="mb-6">{notice}</OkAlert>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6">
        {/* Saved versions */}
        <section className="card shadow-lift self-start">
          <p className="eyebrow mb-4">{t('cvs.listTitle')}</p>
          {loadingList ? (
            <p className="text-sm text-ink-muted">{t('cvs.loading')}</p>
          ) : cvs.length === 0 ? (
            <p className="text-[15px] text-ink-muted">{t('cvs.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {cvs.map((cv) => {
                const on = editor?.id === cv.id;
                return (
                  <li
                    key={cv.id}
                    className={`p-4 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-3 ${on ? 'border-accent bg-accent-wash' : 'border-line'}`}
                  >
                    <div className="min-w-0 flex-[1_1_140px]">
                      <p className="font-display font-bold leading-snug truncate">{cv.name}</p>
                      <p className="text-[13px] text-ink-muted">{t('cvs.updated', { date: formatDate(cv.updatedAt) })}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => void openCv(cv.id)} disabled={!!busy} className="btn-secondary btn-sm min-h-[40px]">
                        {t('cvs.edit')}
                      </button>
                      <button type="button" onClick={() => void remove(cv)} disabled={!!busy} className="btn-danger btn-sm min-h-[40px]">
                        {t('cvs.delete')}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Editor */}
        {editor ? (
          <form onSubmit={save} className="card shadow-lift space-y-5">
            <h2 className="font-display font-extrabold text-[21px]">
              {editor.id ? t('cvs.editorEditTitle') : t('cvs.editorNewTitle')}
            </h2>

            <div className="p-5 border-2 border-dashed border-line-dashed rounded-2xl text-center bg-subtle">
              <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPdfChosen} />
              <Icon.upload className="w-[30px] h-[30px] mx-auto text-accent" />
              <p className="mt-2 mb-1 font-display font-bold">{t('cvs.uploadTitle')}</p>
              <p className="mb-3.5 text-[13px] text-ink-muted max-w-md mx-auto">{t('cvs.uploadHint')}</p>
              <button type="button" onClick={() => fileInput.current?.click()} disabled={!!busy} className="btn-outline">
                {busy === 'extracting' ? t('cvs.extracting') : t('cvs.uploadPdf')}
              </button>
              <p className="mt-3 text-[13px] text-ink-muted">{t('cvs.orPaste')}</p>
            </div>

            <div>
              <label htmlFor="cv-name" className="lbl">{t('cvs.nameLabel')}</label>
              <input
                id="cv-name"
                value={editor.name}
                maxLength={LIMITS.CV_NAME_MAX}
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                placeholder={t('cvs.namePlaceholder')}
                className="field"
              />
            </div>

            <div>
              <label htmlFor="cv-text" className="lbl">{t('cvs.textLabel')}</label>
              <textarea
                id="cv-text"
                value={editor.text}
                onChange={(e) => setEditor({ ...editor, text: e.target.value })}
                placeholder={t('cvs.textPlaceholder')}
                rows={14}
                className="field font-mono text-[14px] leading-relaxed min-h-[16rem] resize-y"
              />
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-[13px]">
                <span className="text-ink-muted">{t('cvs.privacyNote')}</span>
                <span className={`font-mono ${over > 0 ? 'text-warn-strong font-bold' : 'text-ink-muted'}`}>
                  {t('cvs.chars', { count: chars, max: LIMITS.CV_TEXT_MAX })}
                </span>
              </div>
              {over > 0 && <p className="mt-1 text-[13px] text-warn-strong">{t('cvs.tooLong', { over, max: LIMITS.CV_TEXT_MAX })}</p>}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  resetMessages();
                  setEditor(null);
                }}
                className="btn-secondary"
              >
                {t('cvs.cancel')}
              </button>
              <button type="submit" disabled={!canSave} className="btn-primary">
                {busy === 'saving' ? t('cvs.saving') : t('cvs.save')}
              </button>
            </div>
          </form>
        ) : (
          <div className="hidden lg:flex items-center justify-center rounded-3xl border-2 border-dashed border-line-dashed bg-white/60 p-10 text-[15px] text-ink-muted text-center">
            {busy === 'opening' ? t('cvs.loading') : cvs.length ? t('cvs.pickHint') : t('cvs.empty')}
          </div>
        )}
      </div>
    </main>
    </div>
  );
};
