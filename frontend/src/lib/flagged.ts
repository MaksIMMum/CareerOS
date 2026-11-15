// Frontend side of the "no invented facts" post-check (backend/src/lib/skillCheck.ts).

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRe = (term: string, flags = 'iu') =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(term.trim())}(?![\\p{L}\\p{N}+#])`, flags);

export function containsTerm(text: string, term: string): boolean {
  return term.trim() !== '' && termRe(term).test(text);
}

/**
 * Flags still present in the (possibly user-edited) improved CV. Once the user deletes or
 * rewrites a flagged term, the warning for it disappears.
 */
export function activeFlags(text: string, flagged: { skills: string[]; numbers: string[] }): string[] {
  return [...flagged.skills, ...flagged.numbers].filter((t) => containsTerm(text, t));
}

export type Segment = { text: string; flagged: boolean };

/** Splits text so flagged terms can be rendered with <mark>. */
export function highlight(text: string, terms: string[]): Segment[] {
  const clean = terms.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return [{ text, flagged: false }];
  const re = new RegExp(
    clean
      .sort((a, b) => b.length - a.length)
      .map((t) => `(?<![\\p{L}\\p{N}])${escapeRe(t)}(?![\\p{L}\\p{N}+#])`)
      .join('|'),
    'giu',
  );
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index), flagged: false });
    out.push({ text: m[0], flagged: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), flagged: false });
  return out;
}
