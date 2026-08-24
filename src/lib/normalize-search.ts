/**
 * Diacritic- and orthography-insensitive matching, for search over a corpus
 * that is Arabic-first and mixed with Latin.
 *
 * Ported from hogwarts' spotlight (`generic-command-menu/normalize.ts`) —
 * substring matching on raw Arabic is close to useless, because the same word
 * is written several ways that a reader treats as identical:
 *
 *   - harakat (tashkeel) are optional and inconsistently typed
 *   - alef carries hamza or madda depending on the writer: إ أ آ ا
 *   - final ya and alef maqsura are interchanged: ي / ى
 *   - ta marbuta and ha are interchanged in casual typing: ة / ه
 *   - tatweel (ـ) is decorative and can appear anywhere
 *
 * Folding both sides of the comparison means someone typing "مكان" finds a
 * draft written "مكـان", and "احمد" finds "أحمد".
 */
export function normalizeForMatch(input: string): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    // Latin combining marks — café → cafe
    .replace(/[̀-ͯ]/g, "")
    // Arabic harakat + superscript alef
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    // tatweel
    .replace(/ـ/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** True when every whitespace-separated term in `query` appears in `haystack`. */
export function matchesQuery(haystack: string, query: string): boolean {
  const q = normalizeForMatch(query);
  if (!q) return true;
  const hay = normalizeForMatch(haystack);
  // AND across terms, so "mkan port" narrows rather than widens.
  return q.split(" ").every((term) => hay.includes(term));
}
