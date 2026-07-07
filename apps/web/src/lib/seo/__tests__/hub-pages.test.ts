import { describe, it, expect } from "vitest";
import { HUB_PAGES, FEATURE_PAGES, LOCALIZED_PATHS } from "../feature-pages";
import { switchHref, stripLocalePrefix, relativeLocaleHref } from "../locale-links";

/**
 * Guards for the hub-page + language-link work (SEO PR 1).
 *
 * HUB_PAGES must stay disjoint from FEATURE_PAGES: LOCALIZED_PATHS is derived
 * from FEATURE_PAGES keys and drives the sitemap's /<locale> fan-out, but the
 * hub routes (/horoscope, /panchang, /pricing) have NO localized variants —
 * merging the maps would sitemap URLs that 404.
 */
describe("HUB_PAGES", () => {
  it("covers the three hub routes with unique, non-generic titles", () => {
    expect(Object.keys(HUB_PAGES).sort()).toEqual(["/horoscope", "/panchang", "/pricing"]);
    for (const [path, meta] of Object.entries(HUB_PAGES)) {
      expect(meta.title.length, path).toBeGreaterThan(20);
      expect(meta.description.length, path).toBeGreaterThan(50);
      expect(meta.title).not.toBe(FEATURE_PAGES["/"].title);
    }
  });

  it("stays disjoint from FEATURE_PAGES / LOCALIZED_PATHS (no 404 hreflang fan-out)", () => {
    for (const path of Object.keys(HUB_PAGES)) {
      expect(LOCALIZED_PATHS).not.toContain(path);
      expect(FEATURE_PAGES[path]).toBeUndefined();
    }
  });
});

describe("hub page modules export metadata", () => {
  it.each([
    ["horoscope", () => import("@/app/horoscope/page")],
    ["panchang", () => import("@/app/panchang/page")],
    ["pricing", () => import("@/app/pricing/page")],
  ])("/%s has a metadata export with title + canonical", async (_name, load) => {
    const mod = (await load()) as { metadata?: { title?: unknown; alternates?: { canonical?: unknown } } };
    expect(mod.metadata?.title).toBeTruthy();
    expect(mod.metadata?.alternates?.canonical).toBeTruthy();
    // Hubs have no locale variants — they must NOT emit hreflang languages.
    expect((mod.metadata?.alternates as { languages?: unknown })?.languages).toBeUndefined();
  });
});

describe("stripLocalePrefix", () => {
  it("strips a known locale prefix", () => {
    expect(stripLocalePrefix("/hi/kundli")).toBe("/kundli");
    expect(stripLocalePrefix("/ta/horoscope/aries")).toBe("/horoscope/aries");
    expect(stripLocalePrefix("/hi")).toBe("/");
  });
  it("leaves root-tree paths untouched", () => {
    expect(stripLocalePrefix("/kundli")).toBe("/kundli");
    expect(stripLocalePrefix("/")).toBe("/");
    // "horoscope" is not a locale — must not be treated as a prefix.
    expect(stripLocalePrefix("/horoscope/aries")).toBe("/horoscope/aries");
  });
});

describe("relativeLocaleHref", () => {
  it("maps English to the root tree and locales to prefixes", () => {
    expect(relativeLocaleHref("en", "/kundli")).toBe("/kundli");
    expect(relativeLocaleHref("hi", "/kundli")).toBe("/hi/kundli");
    expect(relativeLocaleHref("hi", "/")).toBe("/hi");
    expect(relativeLocaleHref("en", "/")).toBe("/");
  });
});

describe("switchHref (language switcher navigation targets)", () => {
  it("routes feature pages between trees (en ↔ locale)", () => {
    expect(switchHref("hi", "/kundli")).toBe("/hi/kundli");
    expect(switchHref("en", "/hi/kundli")).toBe("/kundli");
    expect(switchHref("ta", "/hi/kundli")).toBe("/ta/kundli");
    expect(switchHref("hi", "/")).toBe("/hi");
    expect(switchHref("en", "/hi")).toBe("/");
  });

  it("routes sign/period pages only for LANDING_LOCALES", () => {
    expect(switchHref("hi", "/horoscope/aries")).toBe("/hi/horoscope/aries");
    expect(switchHref("hi", "/horoscope/aries/weekly")).toBe("/hi/horoscope/aries/weekly");
    // mr is not a landing locale — the localized sign page doesn't exist.
    expect(switchHref("mr", "/horoscope/aries")).toBeNull();
    // invalid sign slug → not a landing page → null.
    expect(switchHref("hi", "/horoscope/nope")).toBeNull();
  });

  it("routes panchang city pages only for PANCHANG_LOCALES", () => {
    expect(switchHref("hi", "/panchang/mumbai")).toBe("/hi/panchang/mumbai");
    expect(switchHref("gu", "/panchang/mumbai")).toBeNull();
    expect(switchHref("hi", "/panchang/atlantis")).toBeNull();
  });

  it("returns null for routes without localized variants (no teleporting)", () => {
    expect(switchHref("hi", "/reports")).toBeNull();
    expect(switchHref("hi", "/horoscope")).toBeNull(); // hub has no /hi variant
    expect(switchHref("hi", "/panchang")).toBeNull();
    expect(switchHref("hi", "/vedic/dasha")).toBeNull();
    // …but switching to English from anywhere always has a target.
    expect(switchHref("en", "/reports")).toBe("/reports");
  });
});
