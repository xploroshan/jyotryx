import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { LEARN_ARTICLES, findArticleBySlug } from "@/lib/learn/articles";
import { learnEntries } from "../sitemap-entries";
import { SITE_ORIGIN } from "../server-api";

/**
 * /learn content-integrity guards (SEO PR 5). The hub's value depends on
 * every article being routable, interlinked, and pointed at a real tool page
 * — broken related-links or tool CTAs would leak authority into 404s.
 */

const APP_DIR = path.resolve(__dirname, "../../../app");
const routeExists = (href: string): boolean => {
  const clean = href.split("?")[0].replace(/^\//, "");
  return fs.existsSync(path.join(APP_DIR, clean, "page.tsx"));
};

describe("learn articles", () => {
  it("has at least the 14 published articles (6 seed + 8 expansion) with unique slugs", () => {
    expect(LEARN_ARTICLES.length).toBeGreaterThanOrEqual(14);
    const slugs = LEARN_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it.each(LEARN_ARTICLES.map((a) => [a.slug, a] as const))(
    "'%s' is complete: sections, FAQs, tool links, valid dates",
    (_slug, a) => {
      expect(a.title.length).toBeGreaterThan(20);
      expect(a.title).not.toContain("| MyAstro360"); // template owns the suffix
      expect(a.description.length).toBeGreaterThan(70);
      expect(a.sections.length).toBeGreaterThanOrEqual(3);
      expect(a.faqs.length).toBeGreaterThanOrEqual(3);
      expect(a.toolLinks.length).toBeGreaterThanOrEqual(1);
      expect(Date.parse(a.datePublished)).not.toBeNaN();
      expect(Date.parse(a.dateModified)).not.toBeNaN();
      // Substantial content: total on-page words (sections + FAQ answers —
      // the FAQ block is rendered content, not metadata) ≥ 450.
      const words = [
        ...a.sections.flatMap((s) => [...s.paragraphs, ...(s.bullets ?? [])]),
        ...a.faqs.flatMap((f) => [f.q, f.a]),
      ]
        .join(" ")
        .split(/\s+/).length;
      expect(words, `${a.slug} word count`).toBeGreaterThan(450);
    },
  );

  it("every toolLink points at a real route", () => {
    for (const a of LEARN_ARTICLES) {
      for (const t of a.toolLinks) {
        expect(routeExists(t.href), `${a.slug} → ${t.href}`).toBe(true);
      }
    }
  });

  it("every related slug resolves to an article", () => {
    for (const a of LEARN_ARTICLES) {
      for (const r of a.related) {
        expect(findArticleBySlug(r), `${a.slug} → related ${r}`).toBeDefined();
      }
    }
  });

  it("sitemap lists /learn and every article", () => {
    const urls = learnEntries().map((e) => e.url);
    expect(urls).toContain(`${SITE_ORIGIN}/learn`);
    for (const a of LEARN_ARTICLES) {
      expect(urls).toContain(`${SITE_ORIGIN}/learn/${a.slug}`);
    }
  });
});
