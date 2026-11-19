import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/**
 * Builds a formatted A4 PDF from a saved CV (name + plain text).
 *
 * CVs are stored as plain text, so the layout is inferred from it (see `parseCv`):
 * the first line becomes the header name, the lines right after it the contact line(s),
 * known section titles / ALL-CAPS lines / "Title:" lines become section headings, and
 * "•", "-", "*", "1." lines become bullet lists. Nothing is added or removed — only styled.
 *
 * Kept free of browser APIs so it can be unit-tested in Node; fonts are passed in
 * because the standard 14 PDF fonts have no Cyrillic glyphs.
 */

export interface CvPdfFonts {
  regular: Uint8Array | ArrayBuffer;
  bold: Uint8Array | ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** A piece of text in one style. */
export interface Run {
  text: string;
  bold?: boolean;
}

export type Block =
  | { kind: 'name'; text: string }
  | { kind: 'contact'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; marker: string; runs: Run[] }
  | { kind: 'para'; runs: Run[] }
  | { kind: 'gap' };

/** Tabs → spaces, CRLF → LF, other control characters (which have no glyphs) removed. */
export function sanitizeCvText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f​﻿]/g, '');
}

/** Section titles commonly used in UA / EN / RU CVs (lower case, without a trailing colon). */
const SECTION_TITLES = new Set([
  // en
  'summary', 'professional summary', 'profile', 'about', 'about me', 'objective', 'career objective',
  'experience', 'work experience', 'professional experience', 'employment', 'employment history', 'work history',
  'education', 'skills', 'technical skills', 'hard skills', 'soft skills', 'key skills', 'core skills', 'tech stack',
  'stack', 'technologies', 'tools', 'projects', 'personal projects', 'pet projects', 'side projects',
  'certifications', 'certificates', 'courses', 'training', 'languages', 'contacts', 'contact', 'contact information',
  'achievements', 'awards', 'interests', 'hobbies', 'volunteering', 'volunteer experience', 'publications',
  'references', 'additional information', 'links',
  // uk
  'про мене', 'профіль', 'резюме', 'мета', 'досвід', 'досвід роботи', 'професійний досвід', 'освіта', 'навички',
  'технічні навички', 'ключові навички', "м'які навички", 'мʼякі навички', 'технології', 'інструменти', 'стек',
  'проєкти', 'проекти', 'особисті проєкти', 'пет-проєкти', 'сертифікати', 'сертифікації', 'курси', 'мови',
  'знання мов', 'іноземні мови', 'контакти', 'контактна інформація', 'досягнення', 'нагороди', 'інтереси', 'хобі',
  'волонтерство', 'додаткова інформація', 'посилання',
  // ru
  'о себе', 'опыт', 'опыт работы', 'образование', 'навыки', 'проекты', 'языки', 'контакты', 'курсы', 'сертификаты',
]);

const BULLET_RE = /^\s*(?:([•·▪●◦‣∙■□➢►✓✔])|([-*–—])(?=\s)|(\d{1,2}[.)])(?=\s))\s*/;
const MAX_HEADING_LEN = 42;

const stripMarkdown = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1');

const isSectionTitle = (s: string) =>
  SECTION_TITLES.has(s.replace(/^#+\s*/, '').replace(/:\s*$/, '').trim().toLocaleLowerCase('uk').replace(/[’`]/g, "'"));

function headingText(line: string): string | null {
  const md = line.match(/^#{1,6}\s+(.+)$/);
  if (md) return md[1]!.replace(/:\s*$/, '').trim();
  if (line.length > MAX_HEADING_LEN || BULLET_RE.test(line)) return null;
  const bare = line.replace(/:\s*$/, '').trim();
  if (!bare) return null;
  const words = bare.split(/\s+/).length;
  if (isSectionTitle(bare)) return bare;
  const letters = bare.replace(/[^\p{L}]/gu, '');
  const allCaps = letters.length >= 3 && letters === letters.toLocaleUpperCase('uk') && letters !== letters.toLocaleLowerCase('uk');
  if (allCaps && words <= 5 && !/[,|@/\d]/.test(bare)) return bare;
  if (line.trimEnd().endsWith(':') && words <= 4 && !/[,|@]/.test(bare)) return bare;
  return null;
}

/** "Languages: English B2" → bold "Languages:" + regular rest. URLs and times are left alone. */
export function labelRuns(text: string): Run[] {
  const m = text.match(/^([^:]{2,30}):\s+(\S.*)$/);
  if (m && !/https?$|\d$/i.test(m[1]!) && m[1]!.trim().split(/\s+/).length <= 4) {
    return [{ text: `${m[1]}:`, bold: true }, { text: m[2]! }];
  }
  return [{ text }];
}

const looksLikeName = (line: string) =>
  !isSectionTitle(line) &&
  line.length <= 50 && line.split(/\s+/).length <= 6 && !/[@:|]|https?:|www\.|\d{3}/i.test(line) && !BULLET_RE.test(line);

/** `header: false` skips the name/contact detection (for texts that are not a CV, e.g. a vacancy). */
export function parseCv(text: string, { header = true }: { header?: boolean } = {}): Block[] {
  const lines = sanitizeCvText(text)
    .split('\n')
    .map((l) => stripMarkdown(l).trimEnd());
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length && lines[i]!.trim() === '') i++;

  // Header: name (even if ALL CAPS or "# Name") + up to 4 contact / title lines right after it.
  const first = lines[i]?.trim().replace(/^#+\s*/, '') ?? '';
  if (header && first && looksLikeName(first)) {
    blocks.push({ kind: 'name', text: first });
    i++;
    let n = 0;
    while (i < lines.length && n < 4) {
      const l = lines[i]!.trim();
      if (!l || headingText(l) || BULLET_RE.test(l) || l.length > 140) break;
      blocks.push({ kind: 'contact', text: l });
      i++;
      n++;
    }
  }

  for (; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) {
      const last = blocks[blocks.length - 1]?.kind;
      if (last && last !== 'gap' && last !== 'heading') blocks.push({ kind: 'gap' });
      continue;
    }
    const heading = headingText(line);
    if (heading) {
      if (blocks[blocks.length - 1]?.kind === 'gap') blocks.pop(); // headings bring their own spacing
      blocks.push({ kind: 'heading', text: heading });
      continue;
    }
    const bullet = line.match(BULLET_RE);
    if (bullet) {
      const rest = line.slice(bullet[0].length);
      if (rest) {
        blocks.push({ kind: 'bullet', marker: bullet[3] ?? '•', runs: labelRuns(rest) });
        continue;
      }
    }
    blocks.push({ kind: 'para', runs: labelRuns(line) });
  }
  while (blocks[blocks.length - 1]?.kind === 'gap') blocks.pop();
  return blocks;
}

// ---------------------------------------------------------------------------
// Wrapping
// ---------------------------------------------------------------------------

type Measure = (text: string, bold: boolean) => number;

/** Joins neighbouring runs that share a style. */
function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && !!last.bold === !!r.bold) last.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

/**
 * Word-wraps styled text to `maxWidth`. Words longer than a whole line (URLs, etc.)
 * are broken by characters. Returns one array of runs per output line.
 */
export function wrapRuns(runs: Run[], maxWidth: number, measure: Measure): Run[][] {
  const words: Run[] = runs.flatMap((r) =>
    r.text
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => ({ text: w, bold: !!r.bold })),
  );
  const lines: Run[][] = [];
  let line: Run[] = [];
  let width = 0;
  const space = measure(' ', false);

  const flush = () => {
    if (line.length) lines.push(mergeRuns(line));
    line = [];
    width = 0;
  };

  for (const word of words) {
    const w = measure(word.text, !!word.bold);
    const gap = line.length ? space : 0;
    if (width + gap + w <= maxWidth) {
      line.push(gap ? { text: ' ', bold: word.bold } : word, ...(gap ? [word] : []));
      width += gap + w;
      continue;
    }
    if (w <= maxWidth) {
      flush();
      line.push(word);
      width = w;
      continue;
    }
    // Longer than a whole line (URLs, etc.): start a new line and break it by characters.
    flush();
    let chunk = '';
    for (const ch of Array.from(word.text)) {
      if (chunk && measure(chunk + ch, !!word.bold) > maxWidth) {
        line.push({ text: chunk, bold: word.bold });
        flush();
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    line.push({ text: chunk, bold: word.bold });
    width = measure(chunk, !!word.bold);
  }
  flush();
  return lines.length ? lines : [[]];
}

/** Plain-text convenience wrapper around `wrapRuns`. */
export function wrapLine(line: string, maxWidth: number, measure: (s: string) => number): string[] {
  return wrapRuns([{ text: line }], maxWidth, (s) => measure(s)).map((l) => l.map((r) => r.text).join(''));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const PAGE = { width: 595.28, height: 841.89 }; // A4 in points
const MARGIN_X = 54;
const MARGIN_TOP = 52;
const MARGIN_BOTTOM = 56;

/** Black only: prints cleanly and looks neutral to recruiters and ATS. */
const BLACK = rgb(0, 0, 0);

const SIZE = { name: 22, contact: 10, heading: 11, body: 10.5, footer: 8.5 };
const LEADING = { name: 26, contact: 14, heading: 14, body: 14.5 };
const BULLET_INDENT = 14;

/** Shortens text with "…" so it fits `maxWidth` (used for the footer). */
function clipToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && font.widthOfTextAtSize(`${chars.join('')}…`, size) > maxWidth) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

const oneLine = (s: string) => sanitizeCvText(s).replace(/\n/g, ' ').trim();

export async function buildCvPdf(cv: { name: string; text: string }, fonts: CvPdfFonts): Promise<Uint8Array> {
  const versionName = oneLine(cv.name) || 'CV';
  let blocks = parseCv(cv.text);
  // No recognisable name at the top → use the version name as the header.
  if (blocks[0]?.kind !== 'name') blocks = [{ kind: 'name', text: versionName }, ...blocks];
  const personName = (blocks[0] as { text: string }).text;
  return renderBlocks(blocks, { title: versionName, author: personName, footer: personName }, fonts);
}

/**
 * A vacancy as a PDF: job title as the header, company and link under it, and the text
 * styled like a CV body ("Requirements:" → heading, "•"/"-" lines → bullets).
 */
export async function buildVacancyPdf(
  vacancy: { title: string; company?: string; url?: string; text: string },
  fonts: CvPdfFonts,
): Promise<Uint8Array> {
  const title = oneLine(vacancy.title) || 'Vacancy';
  const company = oneLine(vacancy.company ?? '');
  const url = oneLine(vacancy.url ?? '');
  const blocks: Block[] = [
    { kind: 'name', text: title },
    ...(company ? [{ kind: 'contact' as const, text: company }] : []),
    ...(url ? [{ kind: 'contact' as const, text: url }] : []),
    ...parseCv(vacancy.text, { header: false }),
  ];
  const footer = company ? `${title} · ${company}` : title;
  return renderBlocks(blocks, { title: footer, author: company || undefined, footer }, fonts);
}

async function renderBlocks(
  blocks: Block[],
  meta: { title: string; author?: string; footer: string },
  fonts: CvPdfFonts,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fonts.regular, { subset: true });
  const bold = await doc.embedFont(fonts.bold, { subset: true });
  const fontOf = (b?: boolean): PDFFont => (b ? bold : regular);

  doc.setTitle(meta.title);
  if (meta.author) doc.setAuthor(meta.author);
  doc.setCreator('CareerOS');
  doc.setProducer('CareerOS');

  const contentWidth = PAGE.width - 2 * MARGIN_X;
  const measureAt = (size: number): Measure => (s, b) => fontOf(b).widthOfTextAtSize(s, size);

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN_TOP;
  const ensure = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN_TOP;
      return true;
    }
    return false;
  };

  const drawRuns = (runs: Run[], x: number, baseline: number, size: number) => {
    for (const r of runs) {
      if (r.text) page.drawText(r.text, { x, y: baseline, size, font: fontOf(r.bold), color: BLACK });
      x += fontOf(r.bold).widthOfTextAtSize(r.text, size);
    }
  };

  /** Draws wrapped runs and advances `y`. */
  const drawWrapped = (runs: Run[], x: number, width: number, size: number, leading: number) => {
    for (const line of wrapRuns(runs, width, measureAt(size))) {
      ensure(leading);
      y -= leading;
      drawRuns(line, x, y + (leading - size) * 0.35, size);
    }
  };

  const bodyLineHeight = LEADING.body;
  let afterHeader = false;

  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx]!;
    const next = blocks[idx + 1];
    switch (b.kind) {
      case 'name':
        drawWrapped([{ text: b.text, bold: true }], MARGIN_X, contentWidth, SIZE.name, LEADING.name);
        y -= 4;
        break;
      case 'contact':
        drawWrapped([{ text: b.text }], MARGIN_X, contentWidth, SIZE.contact, LEADING.contact);
        break;
      case 'heading': {
        if (!afterHeader) {
          // Close the header with a rule before the first section / text.
          finishHeader();
        }
        // Keep the heading together with at least two lines of what follows.
        if (!ensure(18 + LEADING.heading + 10 + 2 * bodyLineHeight)) y -= 18;
        y -= LEADING.heading;
        page.drawText(b.text.toLocaleUpperCase('uk'), {
          x: MARGIN_X,
          y: y + 3,
          size: SIZE.heading,
          font: bold,
          color: BLACK,
        });
        y -= 5;
        page.drawLine({
          start: { x: MARGIN_X, y },
          end: { x: PAGE.width - MARGIN_X, y },
          thickness: 0.5,
          color: BLACK,
        });
        y -= 5;
        break;
      }
      case 'bullet': {
        if (!afterHeader) finishHeader();
        const lines = wrapRuns(b.runs, contentWidth - BULLET_INDENT, measureAt(SIZE.body));
        if (lines.length <= 3) ensure(lines.length * bodyLineHeight); // don't split short bullets across pages
        lines.forEach((line, li) => {
          ensure(bodyLineHeight);
          y -= bodyLineHeight;
          const baseline = y + (bodyLineHeight - SIZE.body) * 0.35;
          if (li === 0) {
            const markerSize = b.marker === '•' ? SIZE.body + 1 : SIZE.body;
            page.drawText(b.marker, {
              x: MARGIN_X + 2,
              y: baseline,
              size: markerSize,
              font: b.marker === '•' ? bold : regular,
              color: BLACK,
            });
          }
          drawRuns(line, MARGIN_X + BULLET_INDENT, baseline, SIZE.body);
        });
        if (next?.kind === 'bullet') y -= 1.5;
        break;
      }
      case 'para': {
        if (!afterHeader) finishHeader();
        // A line introducing a list (job / project title) is bold and kept with its first bullet.
        const intro = next?.kind === 'bullet' && b.runs.length === 1;
        if (intro) ensure(2 * bodyLineHeight);
        const runs = intro ? b.runs.map((r) => ({ ...r, bold: true })) : b.runs;
        drawWrapped(runs, MARGIN_X, contentWidth, SIZE.body, bodyLineHeight);
        if (intro) y -= 1.5;
        break;
      }
      case 'gap':
        if (afterHeader) y -= 7;
        break;
    }
  }
  if (!afterHeader) finishHeader();

  function finishHeader() {
    afterHeader = true;
    y -= 10;
    page.drawRectangle({ x: MARGIN_X, y, width: contentWidth, height: 1, color: BLACK });
    y -= 2;
  }

  // Footer: person name / vacancy title + page numbers, only when there is more than one page.
  const pages = doc.getPages();
  if (pages.length > 1) {
    pages.forEach((p, i) => {
      const num = `${i + 1} / ${pages.length}`;
      const w = regular.widthOfTextAtSize(num, SIZE.footer);
      p.drawText(clipToWidth(meta.footer, regular, SIZE.footer, PAGE.width - 2 * MARGIN_X - w - 24), { x: MARGIN_X, y: MARGIN_BOTTOM - 26, size: SIZE.footer, font: regular, color: BLACK });
      p.drawText(num, { x: PAGE.width - MARGIN_X - w, y: MARGIN_BOTTOM - 26, size: SIZE.footer, font: regular, color: BLACK });
    });
  }

  return doc.save();
}

/**
 * A cover letter as a plain one-column A4 page: paragraphs separated by blank lines,
 * black text, no inferred structure (a letter has no sections).
 */
export async function buildLetterPdf(letter: { title: string; text: string }, fonts: CvPdfFonts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(fonts.regular, { subset: true });
  doc.setTitle(sanitizeCvText(letter.title).replace(/\n/g, ' ').trim() || 'Cover letter');
  doc.setCreator('CareerOS');
  doc.setProducer('CareerOS');

  const size = 11;
  const leading = 16.5;
  const marginX = 64;
  const marginY = 64;
  const width = PAGE.width - 2 * marginX;
  const measure: Measure = (s) => regular.widthOfTextAtSize(s, size);

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - marginY;
  const lines = sanitizeCvText(letter.text).trim().split('\n');
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      if (lines[i - 1]?.trim()) y -= leading * 0.6; // one paragraph gap, however many blank lines
      return;
    }
    for (const wrapped of wrapRuns([{ text: line }], width, measure)) {
      if (y - leading < marginY) {
        page = doc.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - marginY;
      }
      y -= leading;
      page.drawText(wrapped.map((r) => r.text).join(''), { x: marginX, y, size, font: regular, color: BLACK });
    }
  });

  return doc.save();
}
