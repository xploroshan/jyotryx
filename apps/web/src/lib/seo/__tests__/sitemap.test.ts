import { describe, it, expect } from "vitest";
import {
  allSitemapEntries,
  localizedFeatureEntries,
  localizedPanchangCityEntries,
  traditionEntries,
  SITEMAP_TRADITION_PATHS,
  sitemapFeatureLocales,
} from "../sitemap-entries";
import { TRADITION_PAGES } from "../tradition-pages";
import { FEATURE_CONTENT_LOCALE } from "../feature-content";
import { PANCHANG_CITY_CONTENT_LOCALE, PANCHANG_SITEMAP_LOCALES } from "../panchang-city-content";
import { SITE_ORIGIN } from "../server-api";
import { todayIST } from "../dates";
import { PANCHANG_LOCALES, PREFIXED_LOCALES, type Locale } from "@/i18n/locales";

/**
 * Sitemap truthfulness guards (SEO PR 3).
 *
 * Rule under test: the sitemap advertises only URLs whose content isn't
 * thin — localized feature pages gate on FEATURE_CONTENT_LOCALE, localized
 * panchang city pages on the translated PANCHANG_CITY_CONTENT_LOCALE
 * template — and never a URL that robots.txt disallows.
 */

// Frozen clock for the suite — must be on/after the newest LEARN_ARTICLES
// dateModified, or the "no future lastModified" guard fires spuriously.
const NOW = new Date("2026-07-13T12:00:00Z");
const urls = () => allSitemapEntries(NOW).map((e) => e.url);

describe("sitemap inclusion rules", () => {
  it("lists hi feature URLs + the hi home (content exists)", () => {
    const all = urls();
    expect(all).toContain(`${SITE_ORIGIN}/hi`);
    expect(all).toContain(`${SITE_ORIGIN}/hi/kundli`);
    expect(all).toContain(`${SITE_ORIGIN}/hi/matching`);
  });

  it("excludes FEATURE URLs (and the locale home) for locales without translated content", () => {
    // Note: sign/period and panchang-city URLs are governed by their own
    // rules — a landing locale like ta keeps its sign pages (real translated
    // forecasts) while its feature pages stay de-listed.
    const featureEntries = localizedFeatureEntries().map((e) => e.url);
    const thin = PREFIXED_LOCALES.filter((l) => !(l in FEATURE_CONTENT_LOCALE));
    expect(thin.length).toBeGreaterThan(0); // sanity: rule actually bites today
    for (const locale of thin) {
      expect(
        featureEntries.some((u) => u === `${SITE_ORIGIN}/${locale}` || u.startsWith(`${SITE_ORIGIN}/${locale}/`)),
        `/${locale} feature URLs must be de-listed while FEATURE_CONTENT_LOCALE.${locale} is missing`,
      ).toBe(false);
    }
    // The full sitemap must not carry thin-locale KUNDLI pages (a feature path).
    expect(urls()).not.toContain(`${SITE_ORIGIN}/gu/kundli`);
    expect(urls()).not.toContain(`${SITE_ORIGIN}/mr`);
  });

  it("re-adds a locale automatically when its content lands (rule is data-driven)", () => {
    expect(sitemapFeatureLocales()).toEqual(
      Object.keys(FEATURE_CONTENT_LOCALE).filter((l) => l !== "en"),
    );
  });

  it("lists localized panchang cities only for locales with a translated template", () => {
    const entries = localizedPanchangCityEntries(NOW).map((e) => e.url);
    // hi has the template today.
    expect(entries.some((u) => u.startsWith(`${SITE_ORIGIN}/hi/panchang/`))).toBe(true);
    // Landing locales WITHOUT a template stay out.
    const untranslated = PANCHANG_LOCALES.filter(
      (l: Locale) => l !== "en" && !PANCHANG_CITY_CONTENT_LOCALE[l],
    );
    expect(untranslated.length).toBeGreaterThan(0);
    for (const locale of untranslated) {
      expect(entries.some((u) => u.includes(`/${locale}/panchang/`)), locale).toBe(false);
    }
    expect(PANCHANG_SITEMAP_LOCALES).toContain("hi");
  });

  it("keeps localized sign pages (real translated forecasts)", () => {
    expect(urls()).toContain(`${SITE_ORIGIN}/hi/horoscope/aries`);
    expect(urls()).toContain(`${SITE_ORIGIN}/ta/horoscope/aries/weekly`);
  });

  it("lists the tradition tool pages, and each has metadata to back it", () => {
    const t = traditionEntries().map((e) => e.url);
    expect(t).toContain(`${SITE_ORIGIN}/vedic/dasha`);
    expect(t).toContain(`${SITE_ORIGIN}/kp-astrology`);
    for (const p of SITEMAP_TRADITION_PATHS) {
      expect(TRADITION_PAGES[p], `${p} listed in sitemap but missing from TRADITION_PAGES`).toBeDefined();
    }
  });

  it("never lists a robots-disallowed or noindexed URL", () => {
    const disallowed = [
      "/admin", "/auth", "/reset-password", "/checkout", "/profile", "/api/",
      "/styleguide", "/chat", "/my-day", "/reports", "/referral",
      "/decision-room", "/horary/ask", "/horary/history",
    ];
    for (const u of urls()) {
      const path = u.replace(SITE_ORIGIN, "");
      for (const d of disallowed) {
        expect(path === d || path.startsWith(`${d}/`), `${u} matches disallow ${d}`).toBe(false);
      }
    }
  });

  it("emits honest lastModified: daily entries at IST midnight, none in the future", () => {
    const now = NOW.getTime();
    const midnight = todayIST(NOW).getTime();
    for (const e of allSitemapEntries(NOW)) {
      const lm = new Date(e.lastModified as Date).getTime();
      expect(lm, e.url).toBeLessThanOrEqual(now);
      if (e.changeFrequency === "daily") {
        expect(lm, `${e.url} (daily) should be stamped at IST midnight`).toBe(midnight);
      }
    }
  });

  it("has no duplicate URLs", () => {
    const all = urls();
    expect(new Set(all).size).toBe(all.length);
  });
});
