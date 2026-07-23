import type { MetadataRoute } from "next";
import { SEO_CITIES } from "./cities";
import { ZODIAC_SIGNS } from "./zodiac";
import { SITE_ORIGIN } from "./server-api";
import { LOCALIZED_PATHS } from "./feature-pages";
import { TRADITION_PAGES } from "./tradition-pages";
import { FEATURE_CONTENT_LOCALE, featureContentLocales } from "./feature-content";
import { PANCHANG_SITEMAP_LOCALES } from "./panchang-city-content";
import { LEARN_ARTICLES } from "@/lib/learn/articles";
import { languagesFor, localeUrl } from "./page-metadata";
import { todayIST, startOfWeekIST, startOfMonthIST, startOfYearIST, CONTENT_VERSION } from "./dates";
import { LANDING_LOCALES, PREFIXED_LANDING_LOCALES, type Locale } from "@/i18n/locales";

/**
 * Per-entry hreflang alternates (SEO audit I1: "mirror the matrix in the
 * sitemap"). Uses the SAME locale-set sources as the page-level hreflang
 * (languagesFor), so sitemap and <head> can never disagree — a mismatched
 * pair invalidates the whole cluster in Google's eyes. Every URL in a
 * translation cluster carries the identical full matrix (reciprocity).
 */
function langAlternates(path: string, locales?: readonly Locale[]) {
  return { alternates: { languages: languagesFor(path, locales) } };
}

/**
 * Sitemap entry builders, extracted from app/sitemap.ts so the inclusion
 * rules are unit-testable without invoking the route.
 *
 * Two rules encode the audit's "sitemap truthfulness" findings:
 *
 * 1. TRIM THIN LOCALES, RE-ADD AUTOMATICALLY. Localized feature URLs are
 *    derived from FEATURE_CONTENT_LOCALE (the locales that actually have
 *    translated long-form content), and localized panchang-city URLs from
 *    PANCHANG_SITEMAP_LOCALES (locales with a translated city template).
 *    Translating a locale's content automatically restores its URLs — no
 *    sitemap edit. De-listed URLs remain live (200 + self-canonical +
 *    hreflang); they're just not advertised while thin.
 *
 * 2. HONEST lastModified. Daily pages carry midnight IST of today (their
 *    real refresh boundary); period pages the period start; static pages a
 *    manually-bumped CONTENT_VERSION const. Request-time stamps train
 *    Google to ignore the signal entirely.
 */

const PERIOD_START = {
  weekly: startOfWeekIST,
  monthly: startOfMonthIST,
  yearly: startOfYearIST,
} as const;

/**
 * Locales whose localized FEATURE pages are sitemap-listed (non-English
 * subset of featureContentLocales() — the shared content-gated source that
 * also drives hreflang defaults and the LanguageLinkRow).
 */
export function sitemapFeatureLocales(): Locale[] {
  return featureContentLocales().filter((l) => l !== "en");
}

export function staticEntries(now = new Date()): MetadataRoute.Sitemap {
  const base = SITE_ORIGIN;
  // [path, lastModified, changeFrequency, priority]
  const rows: Array<[string, Date, "daily" | "weekly" | "monthly", number]> = [
    ["/",                CONTENT_VERSION.features,    "weekly",  1.0],
    ["/horoscope",       todayIST(now),               "daily",   0.9],
    ["/panchang",        todayIST(now),               "daily",   0.9],
    ["/panchang/cities", CONTENT_VERSION.directories, "weekly",  0.7],
    ["/kundli",          CONTENT_VERSION.features,    "weekly",  0.9],
    ["/kundli/cities",   CONTENT_VERSION.directories, "weekly",  0.7],
    ["/matching",        CONTENT_VERSION.features,    "weekly",  0.8],
    ["/numerology",      CONTENT_VERSION.features,    "weekly",  0.7],
    ["/tarot",           CONTENT_VERSION.features,    "weekly",  0.7],
    ["/palmistry",       CONTENT_VERSION.features,    "weekly",  0.6],
    ["/vastu",           CONTENT_VERSION.features,    "weekly",  0.6],
    ["/muhurat",         CONTENT_VERSION.features,    "weekly",  0.7],
    ["/pricing",         CONTENT_VERSION.features,    "monthly", 0.5],
  ];
  return rows.map(([path, lastModified, changeFrequency, priority]) => ({
    url: `${base}${path === "/" ? "/" : path}`,
    lastModified,
    changeFrequency,
    priority,
    // hreflang only for paths that HAVE content-gated localized variants —
    // same condition the pages themselves use.
    ...(path === "/" || LOCALIZED_PATHS.includes(path) ? langAlternates(path) : {}),
  }));
}

/**
 * Tradition/technique tool pages with real search demand (subset of
 * TRADITION_PAGES — every listed path must have metadata there, which the
 * sitemap test enforces).
 */
export const SITEMAP_TRADITION_PATHS = [
  "/vedic", "/vedic/dasha", "/vedic/dosha", "/vedic/mulank",
  "/western", "/western/natal", "/western/synastry", "/western/transits",
  "/chinese", "/chinese/zodiac", "/chinese/bazi",
  "/hellenistic", "/medical", "/horary",
  "/kp-astrology", "/cosmic-calendar", "/divisional",
] as const;

export function traditionEntries(): MetadataRoute.Sitemap {
  return SITEMAP_TRADITION_PATHS.filter((p) => TRADITION_PAGES[p]).map((p) => ({
    url: `${SITE_ORIGIN}${p}`,
    lastModified: CONTENT_VERSION.traditions,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}

export function signEntries(now = new Date()): MetadataRoute.Sitemap {
  return ZODIAC_SIGNS.map((sign) => ({
    url: `${SITE_ORIGIN}/horoscope/${sign.slug}`,
    lastModified: todayIST(now),
    changeFrequency: "daily" as const,
    priority: 0.85,
    ...langAlternates(`/horoscope/${sign.slug}`, LANDING_LOCALES),
  }));
}

export function signPeriodEntries(now = new Date()): MetadataRoute.Sitemap {
  return ZODIAC_SIGNS.flatMap((sign) =>
    (["weekly", "monthly", "yearly"] as const).map((period) => ({
      url: `${SITE_ORIGIN}/horoscope/${sign.slug}/${period}`,
      lastModified: PERIOD_START[period](now),
      changeFrequency: period,
      priority: 0.75,
      ...langAlternates(`/horoscope/${sign.slug}/${period}`, LANDING_LOCALES),
    })),
  );
}

export function panchangCityEntries(now = new Date()): MetadataRoute.Sitemap {
  return SEO_CITIES.map((city) => ({
    url: `${SITE_ORIGIN}/panchang/${city.slug}`,
    lastModified: todayIST(now),
    changeFrequency: "daily" as const,
    priority: 0.8,
    ...langAlternates(`/panchang/${city.slug}`, PANCHANG_SITEMAP_LOCALES),
  }));
}

export function kundliCityEntries(now = new Date()): MetadataRoute.Sitemap {
  // Daily since the pages embed today's live panchang for the city (the
  // "Today in {city}" section) — the content genuinely changes each day.
  return SEO_CITIES.map((city) => ({
    url: `${SITE_ORIGIN}/kundli/${city.slug}`,
    lastModified: todayIST(now),
    changeFrequency: "daily" as const,
    priority: 0.75,
  }));
}

/** Localized feature pages + locale homes — content-gated (rule 1 above). */
export function localizedFeatureEntries(): MetadataRoute.Sitemap {
  const locales = sitemapFeatureLocales();
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of locales) {
    const paths = Object.keys(FEATURE_CONTENT_LOCALE[locale] ?? {});
    // Locale home rides along whenever the locale has any listed children.
    entries.push({
      url: localeUrl(locale, "/"),
      lastModified: CONTENT_VERSION.features,
      changeFrequency: "weekly",
      priority: 0.8,
      ...langAlternates("/"),
    });
    for (const path of paths) {
      if (!LOCALIZED_PATHS.includes(path)) continue;
      entries.push({
        url: localeUrl(locale, path),
        lastModified: CONTENT_VERSION.features,
        changeFrequency: "weekly",
        priority: 0.6,
        ...langAlternates(path),
      });
    }
  }
  return entries;
}

/** Localized sign/period pages — real translated forecasts, all landing locales. */
export function localizedSignEntries(now = new Date()): MetadataRoute.Sitemap {
  return PREFIXED_LANDING_LOCALES.flatMap((locale) => [
    ...ZODIAC_SIGNS.map((sign) => ({
      url: localeUrl(locale, `/horoscope/${sign.slug}`),
      lastModified: todayIST(now),
      changeFrequency: "daily" as const,
      priority: 0.7,
      ...langAlternates(`/horoscope/${sign.slug}`, LANDING_LOCALES),
    })),
    ...ZODIAC_SIGNS.flatMap((sign) =>
      (["weekly", "monthly", "yearly"] as const).map((period) => ({
        url: localeUrl(locale, `/horoscope/${sign.slug}/${period}`),
        lastModified: PERIOD_START[period](now),
        changeFrequency: period,
        priority: 0.6,
        ...langAlternates(`/horoscope/${sign.slug}/${period}`, LANDING_LOCALES),
      })),
    ),
  ]);
}

/** Localized panchang city pages — template-content-gated (rule 1 above). */
export function localizedPanchangCityEntries(now = new Date()): MetadataRoute.Sitemap {
  return PANCHANG_SITEMAP_LOCALES.filter((l) => l !== "en").flatMap((locale) =>
    SEO_CITIES.map((city) => ({
      url: localeUrl(locale, `/panchang/${city.slug}`),
      lastModified: todayIST(now),
      changeFrequency: "daily" as const,
      priority: 0.7,
      ...langAlternates(`/panchang/${city.slug}`, PANCHANG_SITEMAP_LOCALES),
    })),
  );
}

/** /learn hub + article pages — lastModified from the article's own dates. */
export function learnEntries(): MetadataRoute.Sitemap {
  const newest = LEARN_ARTICLES.reduce(
    (max, a) => (a.dateModified > max ? a.dateModified : max),
    LEARN_ARTICLES[0]?.dateModified ?? "2026-07-07",
  );
  return [
    {
      url: `${SITE_ORIGIN}/learn`,
      lastModified: new Date(newest),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
    ...LEARN_ARTICLES.map((a) => ({
      url: `${SITE_ORIGIN}/learn/${a.slug}`,
      lastModified: new Date(a.dateModified),
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
  ];
}

export function allSitemapEntries(now = new Date()): MetadataRoute.Sitemap {
  return [
    ...staticEntries(now),
    ...learnEntries(),
    ...traditionEntries(),
    ...signEntries(now),
    ...signPeriodEntries(now),
    ...panchangCityEntries(now),
    ...kundliCityEntries(now),
    ...localizedFeatureEntries(),
    ...localizedSignEntries(now),
    ...localizedPanchangCityEntries(now),
  ];
}
