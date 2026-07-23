import type { Metadata } from "next";
import { SITE_ORIGIN } from "./server-api";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locales";
import { getServerTranslations } from "@/i18n/server";
import { FEATURE_PAGES } from "./feature-pages";
import { featureContentLocales } from "./feature-content";

interface PageMetaInput {
  title: string;
  description: string;
  /** Route path beginning with "/", e.g. "/numerology" (or "/" for home). */
  path: string;
  keywords?: string[];
  /**
   * Set when this (English, root) page has localized `/​<locale>` variants —
   * emits reciprocal hreflang alternates so Google links the language set.
   */
  hreflang?: boolean;
  /** Opt out of the root layout's title.template (brand-led titles). */
  absoluteTitle?: boolean;
}

/** Absolute URL for a path in a given locale (English = root, no prefix). */
export function localeUrl(locale: Locale, path: string): string {
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  const p = path === "/" ? "" : path;
  return `${SITE_ORIGIN}${prefix}${p}`;
}

/**
 * hreflang map + x-default → English.
 *
 * DEFAULT = featureContentLocales(): only locales whose feature pages carry
 * real long-form content (en + FEATURE_CONTENT_LOCALE keys — currently
 * en/hi). Deliberately NOT all 12: advertising every thin locale variant via
 * hreflang made Google discover ~600 pages it then declined to index
 * ("Discovered – currently not indexed"), diluting crawl budget. The sitemap,
 * these alternates and the visible LanguageLinkRow all share this source, so
 * adding a locale's content auto-expands all three. Pages that exist in a
 * different locale set (sign/period pages → LANDING_LOCALES, panchang city
 * pages → PANCHANG_SITEMAP_LOCALES) pass their set explicitly.
 */
export function languagesFor(path: string, locales: readonly Locale[] = featureContentLocales()): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = localeUrl(l, path);
  languages["x-default"] = localeUrl(DEFAULT_LOCALE, path);
  return languages;
}

const OG_IMAGE = { url: "/og", width: 1200, height: 630 } as const;

/**
 * The root layout sets `title.template = "%s | MyAstro360"`, so page titles
 * passed to these helpers must be BARE (no hand-appended suffix). Next applies
 * the template to <title> only — NOT og:title/twitter:title — so the helpers
 * compose the suffixed string for the social cards themselves.
 */
const BRAND_SUFFIX = " | MyAstro360";
const withBrand = (title: string) =>
  title.endsWith(BRAND_SUFFIX) ? title : `${title}${BRAND_SUFFIX}`;

/** og:locale values (Indian-audience variants) per supported locale. */
const OG_LOCALE: Record<string, string> = {
  en: "en_IN", hi: "hi_IN", ta: "ta_IN", te: "te_IN", bn: "bn_IN", mr: "mr_IN",
  gu: "gu_IN", kn: "kn_IN", ml: "ml_IN", pa: "pa_IN", or: "or_IN", as: "as_IN",
};

/**
 * Builds per-page metadata with a SELF-referencing canonical plus matching
 * OpenGraph/Twitter cards.
 *
 * Centralised on purpose: the root layout previously set a static
 * `alternates.canonical: "/"`, which Next inherits into every page that
 * doesn't override it — silently canonicalising all feature pages to the
 * homepage. Routing every page through this helper guarantees a correct
 * self-canonical and keeps titles/descriptions unique per page.
 */
export function pageMetadata({ title, description, path, keywords, hreflang, absoluteTitle }: PageMetaInput): Metadata {
  const url = `${SITE_ORIGIN}${path === "/" ? "" : path}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(keywords ? { keywords } : {}),
    // Relative canonical is resolved against `metadataBase` by Next.
    alternates: {
      canonical: path,
      ...(hreflang ? { languages: languagesFor(path) } : {}),
    },
    // NOTE: Next shallow-merges `openGraph`, so a page that sets it does NOT
    // inherit the layout's images — we must include the card here explicitly.
    openGraph: {
      title: absoluteTitle ? title : withBrand(title),
      description,
      url,
      type: "website",
      siteName: "MyAstro360",
      locale: OG_LOCALE.en,
      images: [{ ...OG_IMAGE, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title: absoluteTitle ? title : withBrand(title),
      description,
      images: ["/og"],
    },
  };
}

interface LocalizedMetaInput {
  locale: Locale;
  /** Route path beginning with "/", WITHOUT the locale prefix. */
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  /** Locales this page actually exists in (for hreflang). Defaults to the
   *  content-backed set from featureContentLocales() — never all 12. */
  hreflangLocales?: readonly Locale[];
  /** Opt out of the root layout's title.template (title used verbatim). */
  absoluteTitle?: boolean;
}

/**
 * Maps a feature path to the translation namespace whose
 * `{title, titleHighlight?, description}` drive the localized SEO meta. These
 * are the SAME strings the page UI renders, so the `<title>` and meta
 * description on `/<locale>/numerology` are real translations (no
 * machine-translated SEO prose, no English leaking onto a localized page).
 */
const FEATURE_I18N_KEY: Record<string, string> = {
  "/kundli": "kundli",
  "/numerology": "numerology",
  "/tarot": "tarot",
  "/matching": "matching",
  "/vastu": "vastu",
  "/muhurat": "muhurat",
  "/palmistry": "palmistry",
  // "/" (home) is handled as a special case in localizedFeatureMetadata —
  // its strings live under home.heroTitle/heroHighlight/heroDescription.
};

/**
 * Localized metadata for a Tier-A feature page. Composes the title from the
 * translated `title` (+ optional `titleHighlight`) and uses the translated
 * `description`, falling back to the English `FEATURE_PAGES` entry for any
 * locale/key whose dictionary section is missing a piece. Keywords stay on the
 * English fallback (the meta-keywords tag is not locale-sensitive for ranking).
 */
export async function localizedFeatureMetadata(locale: Locale, path: string): Promise<Metadata> {
  const fallback = FEATURE_PAGES[path];
  const t = await getServerTranslations(locale);

  // Home page: its localized strings live in the hero, and the highlight
  // already contains the brand name — so use the composed hero verbatim as
  // an ABSOLUTE title (no template suffix) to avoid "…MyAstro360 | MyAstro360".
  if (path === "/") {
    const home = (t as unknown as { home?: { heroTitle?: string; heroHighlight?: string; heroDescription?: string } }).home;
    const headline = home?.heroTitle
      ? `${home.heroTitle} ${home.heroHighlight ?? ""}`.trim()
      : null;
    return localizedMetadata({
      locale,
      path,
      title: headline ?? fallback.title,
      description: home?.heroDescription ?? fallback.description,
      keywords: fallback.keywords,
      absoluteTitle: true,
    });
  }

  const key = FEATURE_I18N_KEY[path];
  const section = key ? (t as unknown as Record<string, { title?: string; titleHighlight?: string; description?: string }>)[key] : undefined;

  const headline = section?.title
    ? `${section.title}${section.titleHighlight ? ` ${section.titleHighlight}` : ""}`
    : null;
  // Bare title — the root layout's title.template appends the brand suffix.
  const title = headline ?? fallback.title;
  const description = section?.description ?? fallback.description;

  return localizedMetadata({ locale, path, title, description, keywords: fallback.keywords });
}

/**
 * Metadata for a localized `/<locale>/…` page: canonical points at the
 * localized URL, with reciprocal hreflang alternates (the locales the page
 * exists in + x-default) so the language set is correctly linked for search
 * engines.
 */
export function localizedMetadata({ locale, path, title, description, keywords, hreflangLocales, absoluteTitle }: LocalizedMetaInput): Metadata {
  const canonical = localeUrl(locale, path);
  const ogTitle = absoluteTitle ? title : withBrand(title);
  // Same content-gated default as languagesFor — keeps localized pages'
  // hreflang reciprocal with the English side (see languagesFor doc).
  const locales = hreflangLocales ?? featureContentLocales();
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical, languages: languagesFor(path, locales) },
    openGraph: {
      title: ogTitle,
      description,
      url: canonical,
      type: "website",
      siteName: "MyAstro360",
      locale: OG_LOCALE[locale] ?? "en_IN",
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => OG_LOCALE[l] ?? "en_IN"),
      images: [{ ...OG_IMAGE, alt: title }],
    },
    twitter: { card: "summary_large_image", title: ogTitle, description, images: ["/og"] },
  };
}
