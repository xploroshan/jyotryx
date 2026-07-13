import { type Locale } from "@/i18n/locales";
import { featureContentLocales } from "@/lib/seo/feature-content";
import { LOCALE_LABELS, relativeLocaleHref } from "@/lib/seo/locale-links";

/**
 * "Also available in: हिन्दी · தமிழ் · …" — a server-rendered row of plain
 * anchors linking the current page to its language variants (and back to
 * English from localized pages).
 *
 * This is the PRIMARY crawlable path into the /<locale> URL tree: the
 * navbar's LanguageSwitcher dropdown and locale-aware footer help, but this
 * row guarantees every page in a language set links its siblings — making
 * the internal link graph reciprocal with the hreflang alternates.
 *
 * Pass `locales` limited to the locales the page actually exists in (e.g.
 * LANDING_LOCALES for sign pages) so we never link a 404.
 */
export function LanguageLinkRow({
  path,
  currentLocale = "en",
  locales = featureContentLocales(),
}: {
  /** Route path WITHOUT locale prefix, e.g. "/kundli" or "/horoscope/aries". */
  path: string;
  /** Locale of the page this row renders on (excluded from the list). */
  currentLocale?: Locale;
  /**
   * Locales the page should ADVERTISE. Defaults to content-backed feature
   * locales (en + FEATURE_CONTENT_LOCALE keys) — deliberately not all 12, so
   * this row never invites crawlers into thin locale variants the sitemap
   * dropped. Pages with their own locale sets (signs, panchang cities) pass
   * them explicitly.
   */
  locales?: readonly Locale[];
}) {
  const targets = LOCALE_LABELS.filter(
    (l) => l.code !== currentLocale && locales.includes(l.code),
  );
  if (targets.length === 0) return null;

  return (
    <nav
      aria-label="This page in other languages"
      className="mx-auto max-w-6xl px-4 py-6 text-xs text-[rgba(12,8,5,0.55)]"
    >
      <span className="mr-2">Also available in:</span>
      {targets.map((l, i) => (
        <span key={l.code}>
          {i > 0 && <span aria-hidden> · </span>}
          <a
            href={relativeLocaleHref(l.code, path)}
            hrefLang={l.code}
            className="hover:text-primary-400 underline-offset-2 hover:underline"
          >
            {l.native}
          </a>
        </span>
      ))}
    </nav>
  );
}

export default LanguageLinkRow;
