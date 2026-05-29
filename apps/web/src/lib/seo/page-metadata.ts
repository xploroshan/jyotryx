import type { Metadata } from "next";
import { SITE_ORIGIN } from "./server-api";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/locales";

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

/** hreflang map across every locale + x-default → English. */
function languagesFor(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of SUPPORTED_LOCALES) languages[l] = localeUrl(l, path);
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
}

/**
 * Metadata for a localized `/<locale>/…` page: canonical points at the
 * localized URL, with reciprocal hreflang alternates (every locale +
 * x-default) so the language set is correctly linked for search engines.
 */
export function localizedMetadata({ locale, path, title, description, keywords }: LocalizedMetaInput): Metadata {
  const canonical = localeUrl(locale, path);
  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    alternates: { canonical, languages: languagesFor(path) },
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
