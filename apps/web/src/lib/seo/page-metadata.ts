import type { Metadata } from "next";
import { SITE_ORIGIN } from "./server-api";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/locales";
import { getServerTranslations } from "@/i18n/server";
import { FEATURE_PAGES } from "./feature-pages";

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
}

/** Absolute URL for a path in a given locale (English = root, no prefix). */
export function localeUrl(locale: Locale, path: string): string {
  const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
  const p = path === "/" ? "" : path;
  return `${SITE_ORIGIN}${prefix}${p}`;
}

/**
 * hreflang map + x-default → English. Defaults to every supported locale
 * (Tier-A feature pages exist in all 12); pass a subset for pages that only
 * exist in some locales (e.g. landing pages live in en + hi for now) so we
 * never emit an hreflang to a URL that 404s.
 */
function languagesFor(path: string, locales: readonly Locale[] = SUPPORTED_LOCALES): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = localeUrl(l, path);
  languages["x-default"] = localeUrl(DEFAULT_LOCALE, path);
  return languages;
}

const OG_IMAGE = { url: "/og", width: 1200, height: 630 } as const;

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
export function pageMetadata({ title, description, path, keywords, hreflang }: PageMetaInput): Metadata {
  const url = `${SITE_ORIGIN}${path === "/" ? "" : path}`;
  return {
    title,
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
      title,
      description,
      url,
      type: "website",
      siteName: "myastro360",
      images: [{ ...OG_IMAGE, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og"] },
  };
}

interface LocalizedMetaInput {
  locale: Locale;
  /** Route path beginning with "/", WITHOUT the locale prefix. */
  path: string;
  title: string;
  description: string;
  keywords?: string[];
  /** Locales this page actually exists in (for hreflang). Defaults to all 12. */
  hreflangLocales?: readonly Locale[];
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
  const key = FEATURE_I18N_KEY[path];
  const t = await getServerTranslations(locale);
  const section = key ? (t as unknown as Record<string, { title?: string; titleHighlight?: string; description?: string }>)[key] : undefined;

  const headline = section?.title
    ? `${section.title}${section.titleHighlight ? ` ${section.titleHighlight}` : ""}`
    : null;
  const title = headline ? `${headline} | myastro360` : fallback.title;
  const description = section?.description ?? fallback.description;

  return localizedMetadata({ locale, path, title, description, keywords: fallback.keywords });
}

/**
 * Metadata for a localized `/<locale>/…` page: canonical points at the
 * localized URL, with reciprocal hreflang alternates (the locales the page
 * exists in + x-default) so the language set is correctly linked for search
 * engines.
 */
export function localizedMetadata({ locale, path, title, description, keywords, hreflangLocales }: LocalizedMetaInput): Metadata {
  const canonical = localeUrl(locale, path);
  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical, languages: languagesFor(path, hreflangLocales) },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: "myastro360",
      images: [{ ...OG_IMAGE, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og"] },
  };
}
