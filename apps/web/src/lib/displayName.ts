/**
 * Resolve which name to show the user, depending on context.
 *
 * Rules — set by product:
 *  - **feature** pages (tradition heroes, chat surface, /my-day
 *    greeting, dashboard pleasantries): use the informal nickname
 *    when set; otherwise fall back to the first token of the
 *    formal name; otherwise show nothing.
 *  - **astrology** artefacts (kundli, matching, dasha reports,
 *    chart labels, PDF exports): always use the formal full
 *    name. The chart is a record about the legal person, not a
 *    conversational greeting.
 *
 * Both branches gracefully handle a user with neither field set
 * (anonymous visitors hitting a SEO landing, partial profiles).
 */

export type DisplayContext = 'feature' | 'astrology';

interface NameSource {
  /** The formal name. May be a full name with spaces. */
  name?: string | null;
  /** Optional informal name. Whitespace-only counts as unset. */
  nickname?: string | null;
}

/**
 * Returns the name to display, or an empty string if neither
 * `name` nor `nickname` is usable. Callers should usually guard on
 * the empty return value before splicing into a greeting.
 */
export function displayName(user: NameSource | null | undefined, context: DisplayContext = 'feature'): string {
  if (!user) return '';
  if (context === 'astrology') {
    return (user.name ?? '').trim();
  }
  const nick = user.nickname?.trim();
  if (nick) return nick;
  const first = user.name?.trim().split(/\s+/)[0];
  return first ?? '';
}

/**
 * Casual greeting prefix — what most feature pages want. Equivalent to
 * `displayName(user, 'feature')`; kept as a named helper so call
 * sites read clearly ("greet the user with their casual name").
 */
export function greetingName(user: NameSource | null | undefined): string {
  return displayName(user, 'feature');
}
