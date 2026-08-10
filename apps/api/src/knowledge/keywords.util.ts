/**
 * Shared tokenisation for the vector KB's keyword tier.
 *
 * Two things must agree or keyword search silently returns nothing:
 *   - `extractKeywords` builds the `keywords` column when a document is
 *     seeded/added,
 *   - `tokenizeQuery` builds the token list matched against that column
 *     (`keywords: { hasSome: queryWords }`).
 * They previously lived as three separate copies (prisma/seed.ts,
 * knowledge.service.ts keywordSearch, knowledge.service.ts addDocument) and
 * all three shared the same defect.
 *
 * THE DEFECT — `\w` IS ASCII-ONLY. The old expression `/[^\w\s]/g` strips
 * every character outside [A-Za-z0-9_], which means an entire query in
 * Devanagari, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam,
 * Gurmukhi, Odia or Assamese was reduced to an empty string; `queryWords`
 * came out empty and `keywordSearch` returned `[]` before touching the
 * database. Keyword search — the fallback tier beneath pgvector — was dead
 * for 11 of the 12 supported locales.
 *
 * The fix is `\p{L}\p{N}` with the `u` flag, which keeps letters and digits
 * in every script while still dropping punctuation.
 *
 * This module deliberately holds NO seed data, so the request-path service
 * can import it without pulling the ~264KB corpus into memory.
 */

const STOP_WORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'a', 'an',
  'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'this', 'that', 'these', 'those', 'it',
  'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
  'he', 'she', 'his', 'her', 'not', 'no', 'nor', 'if', 'then',
  'than', 'when', 'where', 'which', 'who', 'whom', 'how', 'what',
  'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'only', 'very', 'also', 'just', 'about',
]);

/**
 * Strip punctuation (all scripts), lowercase, split on whitespace.
 *
 * `\p{M}` (combining marks) is REQUIRED, not optional. Indic vowel signs,
 * anusvara and virama are marks, not letters: without \p{M} the expression
 * treats them as punctuation and replaces them with a space, which tears a
 * word into fragments. Measured on the first version of this fix:
 *   मंगल → "म" + "गल"   (anusvara removed → split, "म" then too short)
 *   दोष  → "द" + "ष"    (vowel sign removed → both fragments too short → term lost entirely)
 * Every Indic script is affected the same way.
 */
function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Minimum token length.
 *
 * Latin needs >2 to drop noise like "of"/"an". Indic scripts routinely carry
 * meaning in 2-character words (e.g. मन, राशि is 4 but घर is 2), and their
 * stop-words are not in the English STOP_WORDS list anyway, so applying the
 * Latin floor to them would discard real query terms. Tokens containing any
 * non-ASCII letter therefore only need >=2 characters.
 */
function longEnough(word: string): boolean {
  const isAscii = /^[\x00-\x7F]*$/.test(word);
  return isAscii ? word.length > 2 : word.length >= 2;
}

/** Keywords stored on a document row. Deduped, capped at 30. */
export function extractKeywords(text: string): string[] {
  const words = normalizeWords(text).filter((w) => longEnough(w) && !STOP_WORDS.has(w));
  return [...new Set(words)].slice(0, 30);
}

/**
 * Tokens for a search query, matched against the stored `keywords` array.
 * Stop-words are NOT removed here: a short query ("what is the 7th house")
 * can legitimately reduce to nothing once stop-words go, and an empty token
 * list means the keyword tier bails out entirely.
 */
export function tokenizeQuery(query: string): string[] {
  // Capped like extractKeywords: the result goes straight into
  // `keywords: { hasSome: [...] }`, and a long free-text question (the tarot
  // and vastu DTOs carry no @MaxLength) would otherwise build a
  // many-thousand-element array-overlap predicate per request.
  return [...new Set(normalizeWords(query).filter(longEnough))].slice(0, 30);
}
