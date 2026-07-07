import type { MetadataRoute } from "next";
import { SEO_CITIES } from "./cities";
import { ZODIAC_SIGNS } from "./zodiac";
import { SITE_ORIGIN } from "./server-api";
import { LOCALIZED_PATHS } from "./feature-pages";
import { TRADITION_PAGES } from "./tradition-pages";
import { FEATURE_CONTENT_LOCALE } from "./feature-content";
import { PANCHANG_SITEMAP_LOCALES } from "./panchang-city-content";
import { localeUrl } from "./page-metadata";
import { todayIST, startOfWeekIST, startOfMonthIST, startOfYearIST, CONTENT_VERSION } from "./dates";
import { PREFIXED_LANDING_LOCALES, type Locale } from "@/i18n/locales";

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

/** Locales whose localized FEATURE pages are sitemap-listed. */
export function sitemapFeatureLocales(): Locale[] {
  return Object.keys(FEATURE_CONTENT_LOCALE).filter((l) => l !== "en") as Locale[];
}

export function staticEntries(now = new Date()): MetadataRoute.Sitemap {
  const base = SITE_ORIGIN;
  return [
    { url: `${base}/`,                lastModified: CONTENT_VERSION.features, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${base}/horoscope`,       lastModified: todayIST(now),            changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/panchang`,        lastModified: todayIST(now),            changeFrequency: "daily",   priority: 0.9 },
    { url: `${base}/panchang/cities`, lastModified: CONTENT_VERSION.directories, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/kundli`,          lastModified: CONTENT_VERSION.features, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${base}/kundli/cities`,   lastModified: CONTENT_VERSION.directories, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/matching`,        lastModified: CONTENT_VERSION.features, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/numerology`,      lastModified: CONTENT_VERSION.features, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/tarot`,           lastModified: CONTENT_VERSION.features, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/palmistry`,       lastModified: CONTENT_VERSION.features, changeFrequency: "weekly",  priority: 0.6 },
    { url: `${base}/vastu`,           lastModified: CONTENT_VERSION.features, changeFrequency: "weekly",  priority: 0.6 },
    { url: `${base}/muhurat`,         lastModified: CONTENT_VERSION.features, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${base}/pricing`,         lastModified: CONTENT_VERSION.features, changeFrequency: "monthly", priority: 0.5 },
  ];
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
  }));
}

export function signPeriodEntries(now = new Date()): MetadataRoute.Sitemap {
  return ZODIAC_SIGNS.flatMap((sign) =>
    (["weekly", "monthly", "yearly"] as const).map((period) => ({
      url: `${SITE_ORIGIN}/horoscope/${sign.slug}/${period}`,
      lastModified: PERIOD_START[period](now),
      changeFrequency: period,
      priority: 0.75,
    })),
  );
}

export function panchangCityEntries(now = new Date()): MetadataRoute.Sitemap {
  return SEO_CITIES.map((city) => ({
    url: `${SITE_ORIGIN}/panchang/${city.slug}`,
    lastModified: todayIST(now),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));
}

export function kundliCityEntries(): MetadataRoute.Sitemap {
  return SEO_CITIES.map((city) => ({
    url: `${SITE_ORIGIN}/kundli/${city.slug}`,
    lastModified: CONTENT_VERSION.directories,
    changeFrequency: "weekly" as const,
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
    });
    for (const path of paths) {
      if (!LOCALIZED_PATHS.includes(path)) continue;
      entries.push({
        url: localeUrl(locale, path),
        lastModified: CONTENT_VERSION.features,
        changeFrequency: "weekly",
        priority: 0.6,
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
    })),
    ...ZODIAC_SIGNS.flatMap((sign) =>
      (["weekly", "monthly", "yearly"] as const).map((period) => ({
        url: localeUrl(locale, `/horoscope/${sign.slug}/${period}`),
        lastModified: PERIOD_START[period](now),
        changeFrequency: period,
        priority: 0.6,
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
    })),
  );
}

export function allSitemapEntries(now = new Date()): MetadataRoute.Sitemap {
  return [
    ...staticEntries(now),
    ...traditionEntries(),
    ...signEntries(now),
    ...signPeriodEntries(now),
    ...panchangCityEntries(now),
    ...kundliCityEntries(),
    ...localizedFeatureEntries(),
    ...localizedSignEntries(now),
    ...localizedPanchangCityEntries(now),
  ];
}
