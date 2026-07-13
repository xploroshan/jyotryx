/**
 * Tiny {token} interpolation for dictionary templates.
 *
 * The landing-page FAQ copy lives in the i18n dictionaries as templates
 * ("What dates does the {sign} zodiac sign cover?") so every locale renders
 * from its own dictionary instead of hardcoded English (AEO: no
 * mixed-language signal). This module fills the tokens at render time.
 *
 * Server-safe: plain data/functions, no 'use client'.
 */

/**
 * Replace every `{token}` in `template` with `tokens[token]`.
 * Unknown tokens are left intact so a translator typo degrades visibly
 * ("{sing}") rather than silently dropping content.
 */
export function interpolate(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(tokens, name) ? tokens[name] : match,
  );
}

/**
 * Build a `{q, a}[]` FAQ list from a dictionary section shaped as named
 * `q1/a1, q2/a2, …` keys (named keys — not arrays — so the i18n parity
 * test's key-walker sees stable string paths per locale).
 *
 * Reads pairs in ascending order starting at q1 and stops at the first
 * missing pair, so the order is stable and locales can never reorder
 * entries relative to en.
 */
export function buildFaqs(
  section: Record<string, string>,
  tokens: Record<string, string>,
): { q: string; a: string }[] {
  const faqs: { q: string; a: string }[] = [];
  for (let i = 1; ; i++) {
    const q = section[`q${i}`];
    const a = section[`a${i}`];
    if (typeof q !== 'string' || typeof a !== 'string') break;
    faqs.push({ q: interpolate(q, tokens), a: interpolate(a, tokens) });
  }
  return faqs;
}
