import { describe, it, expect } from "vitest";
import { pageMetadata, localizedMetadata, localeUrl } from "../page-metadata";
import { FEATURE_PAGES, HUB_PAGES } from "../feature-pages";
import { TRADITION_PAGES } from "../tradition-pages";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { featureContentLocales } from "../feature-content";

/**
 * Title/brand-suffix and hreflang-reciprocity guards (SEO PR 2).
 *
 * The root layout owns the brand suffix via title.template. Next applies the
 * template to <title> ONLY — not og:title — so pageMetadata() composes the
 * suffixed string for the social cards itself. These tests pin both halves
 * of that contract so neither "Foo | MyAstro360 | MyAstro360" nor a
 * suffix-less og:title can regress in silently.
 */

const ALL_MAPS: [string, Record<string, { title: string }>][] = [
  ["FEATURE_PAGES", FEATURE_PAGES],
  ["HUB_PAGES", HUB_PAGES],
  ["TRADITION_PAGES", TRADITION_PAGES],
];

describe("brand suffix contract", () => {
  it("no metadata map hand-appends the brand suffix (template owns <title>)", () => {
    for (const [name, map] of ALL_MAPS) {
      for (const [p, meta] of Object.entries(map)) {
        expect(meta.title, `${name}[${p}]`).not.toContain("| MyAstro360");
      }
    }
  });

  it("og:title and twitter:title DO carry the suffix (template doesn't reach them)", () => {
    const md = pageMetadata({ path: "/kundli", ...FEATURE_PAGES["/kundli"] });
    expect((md.openGraph as { title?: string })?.title).toBe(
      `${FEATURE_PAGES["/kundli"].title} | MyAstro360`,
    );
    expect((md.twitter as { title?: string })?.title).toBe(
      `${FEATURE_PAGES["/kundli"].title} | MyAstro360`,
    );
    // <title> side stays bare — the layout template appends the brand.
    expect(md.title).toBe(FEATURE_PAGES["/kundli"].title);
  });

  it("absoluteTitle opts out of the template AND the og suffix (brand-led home)", () => {
    const md = pageMetadata({ path: "/", ...FEATURE_PAGES["/"], absoluteTitle: true });
    expect(md.title).toEqual({ absolute: FEATURE_PAGES["/"].title });
    expect((md.openGraph as { title?: string })?.title).toBe(FEATURE_PAGES["/"].title);
  });
});

describe("hreflang reciprocity", () => {
  it("pageMetadata(hreflang) and localizedMetadata emit IDENTICAL language maps", () => {
    const root = pageMetadata({ path: "/kundli", ...FEATURE_PAGES["/kundli"], hreflang: true });
    const hi = localizedMetadata({ locale: "hi", path: "/kundli", title: "x", description: "y" });
    expect(root.alternates?.languages).toEqual(hi.alternates?.languages);
  });

  it("language maps cover exactly the CONTENT-BACKED locales + x-default", () => {
    // Crawl-budget alignment (SEO phase 2): hreflang must advertise only
    // locales with real feature content — currently en + hi. Advertising all
    // 12 pushed ~600 thin URLs into "Discovered - currently not indexed".
    const md = pageMetadata({ path: "/kundli", ...FEATURE_PAGES["/kundli"], hreflang: true });
    const langs = md.alternates?.languages as Record<string, string>;
    const expected = featureContentLocales();
    expect(Object.keys(langs).sort()).toEqual([...expected, "x-default"].sort());
    for (const l of expected) expect(langs[l], l).toBe(localeUrl(l, "/kundli"));
    expect(langs["x-default"]).toBe(localeUrl("en", "/kundli"));
    // Thin locales must NOT be advertised until their content lands.
    expect(langs["gu"]).toBeUndefined();
    expect(langs["as"]).toBeUndefined();
  });

  it("featureContentLocales auto-expands from FEATURE_CONTENT_LOCALE (single source)", () => {
    const locales = featureContentLocales();
    expect(locales[0]).toBe("en");
    expect(locales).toContain("hi");
    // Every entry is a supported locale (guards against typo'd dictionary keys).
    for (const l of locales) expect(SUPPORTED_LOCALES).toContain(l);
  });

  it("localized pages canonicalise to THEMSELVES, never to English", () => {
    const hi = localizedMetadata({ locale: "hi", path: "/kundli", title: "x", description: "y" });
    expect(hi.alternates?.canonical).toBe(localeUrl("hi", "/kundli"));
  });

  it("og:locale reflects the page locale with the alternates listed", () => {
    const ta = localizedMetadata({ locale: "ta", path: "/kundli", title: "x", description: "y" });
    const og = ta.openGraph as { locale?: string; alternateLocale?: string[] };
    expect(og.locale).toBe("ta_IN");
    expect(og.alternateLocale).toContain("hi_IN");
    expect(og.alternateLocale).not.toContain("ta_IN");
  });
});
