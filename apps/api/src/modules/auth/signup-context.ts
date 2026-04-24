/**
 * Parse signup dimensions (locale / country / signupSource) out of an
 * incoming HTTP request and body so every auth flow that creates a user
 * — email register, OTP verify, Google, Firebase — tags the row with
 * the same consistent set of fields.
 *
 * Kept locale-validation loose: we accept any 2-letter primary subtag
 * and trust the web app to only send values from its SUPPORTED_LOCALES
 * list. The server clamp just guards against header injection — we
 * never persist more than 10 chars of locale, 2 chars of country, or
 * 32 chars of signup source.
 */

export interface SignupContext {
  locale: string | null;
  country: string | null;
  signupSource: string | null;
}

const LOCALE_RE = /^[a-z]{2,3}(-[A-Z]{2})?$/;

/**
 * Pull the primary locale + region out of an Accept-Language header.
 * Returns null when the header is missing or malformed. The header
 * can be a weighted list (`en-US,en;q=0.9,hi;q=0.8`) — we pick the
 * first q≥1 tag, falling back to the first tag of any weight.
 */
export function parseAcceptLanguage(
  header: string | undefined | null,
): { locale: string | null; country: string | null } {
  if (!header || typeof header !== 'string') return { locale: null, country: null };

  const tags = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? parseFloat(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((x) => x.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    if (!LOCALE_RE.test(tag)) continue;
    const primary = tag.toLowerCase().split('-')[0];
    const region = tag.includes('-') ? tag.split('-')[1].toUpperCase() : null;
    return { locale: primary, country: region };
  }
  return { locale: null, country: null };
}

/**
 * Build the full SignupContext, combining header-derived locale with
 * client-supplied overrides (body.locale / body.signupSource). Body
 * values win when present, so the web app can override the browser's
 * Accept-Language with its own persisted locale choice.
 */
export function buildSignupContext(opts: {
  acceptLanguage?: string | null;
  bodyLocale?: string | null;
  bodyCountry?: string | null;
  bodySignupSource?: string | null;
}): SignupContext {
  const fromHeader = parseAcceptLanguage(opts.acceptLanguage);

  const locale = (opts.bodyLocale ?? fromHeader.locale ?? null)
    ?.toString()
    .toLowerCase()
    .slice(0, 10) || null;

  const country = (opts.bodyCountry ?? fromHeader.country ?? null)
    ?.toString()
    .toUpperCase()
    .slice(0, 2) || null;

  // Normalise to lowercase + slice; whitespace-only strings map to null
  // so a client that sends an empty UTM field doesn't persist "".
  const rawSource = opts.bodySignupSource?.toString().trim() ?? null;
  const signupSource = rawSource && rawSource.length > 0 ? rawSource.slice(0, 32) : null;

  return { locale, country, signupSource };
}
