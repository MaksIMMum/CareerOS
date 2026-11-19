/** Turns a name into a safe file name, e.g. "Backend CV" → "Backend CV.pdf". */
export function pdfFileName(name: string, fallback = 'CV'): string {
  const base = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 100)
    .trim();
  return `${base || fallback}.pdf`;
}

/** Saves bytes as a file in the browser. */
export function downloadBlob(fileName: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * pdf-lib, the PDF layouts and the fonts (~1 MB together) are loaded lazily,
 * only the first time someone downloads a PDF.
 */
async function loadPdfKit() {
  const [mod, regularUrl, boldUrl] = await Promise.all([
    import('./cvPdf.js'),
    import('../assets/fonts/NotoSans-Regular.ttf?url').then((m) => m.default),
    import('../assets/fonts/NotoSans-Bold.ttf?url').then((m) => m.default),
  ]);
  const fetchFont = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Font request failed: ${res.status}`);
    return res.arrayBuffer();
  };
  const [regular, bold] = await Promise.all([fetchFont(regularUrl), fetchFont(boldUrl)]);
  return { ...mod, fonts: { regular, bold } };
}

/** Renders a saved CV to PDF and downloads it. */
export async function downloadCvPdf(cv: { name: string; text: string }): Promise<void> {
  const { buildCvPdf, fonts } = await loadPdfKit();
  const bytes = await buildCvPdf(cv, fonts);
  downloadBlob(pdfFileName(cv.name), bytes as BlobPart, 'application/pdf');
}

/** Renders a cover letter to PDF and downloads it as "<title>.pdf". */
export async function downloadLetterPdf(letter: { title: string; text: string }): Promise<void> {
  const { buildLetterPdf, fonts } = await loadPdfKit();
  const bytes = await buildLetterPdf(letter, fonts);
  downloadBlob(pdfFileName(letter.title, 'Cover letter'), bytes as BlobPart, 'application/pdf');
}
