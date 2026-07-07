/**
 * /learn content registry — the informational layer the SEO audit found
 * entirely missing (competitors earn most of their organic traffic from
 * informational queries: "what is manglik dosha", "nakshatra list", …).
 *
 * Articles are typed TS modules (one per file under ./content) in the same
 * spirit as FEATURE_CONTENT: reviewable in PRs, rendered fully server-side,
 * and the single source for both the visible page and its structured data.
 *
 * IMPORTANT (owner review): seed articles ship with status:"draft" content
 * written for editorial review — datePublished is set when the owner
 * approves. Draft articles still render (they're accurate), but keep the
 * review loop in mind before promoting heavily.
 */

export interface LearnFaq {
  q: string;
  a: string;
}

export interface LearnSection {
  heading: string;
  paragraphs: string[];
  /** Optional bullet list rendered after the paragraphs. */
  bullets?: string[];
}

export interface LearnArticle {
  slug: string;
  /** Bare SEO title — the root layout's title.template appends the brand. */
  title: string;
  description: string;
  keywords: string[];
  /** Set on owner approval; used for Article JSON-LD + sitemap lastmod. */
  datePublished: string; // YYYY-MM-DD
  dateModified: string; // YYYY-MM-DD
  hero: {
    eyebrow: string;
    headline: string;
    tagline: string;
  };
  sections: LearnSection[];
  faqs: LearnFaq[];
  /** CTAs into the product — every article must link its tool page(s). */
  toolLinks: { label: string; href: string; blurb: string }[];
  related: string[]; // slugs
}

import { nakshatrasOverview } from "./content/nakshatras-overview";
import { manglikDosha } from "./content/manglik-dosha";
import { kaalSarpDosha } from "./content/kaal-sarp-dosha";
import { rashiVsSunSign } from "./content/rashi-vs-sun-sign";
import { choosingMuhurat } from "./content/choosing-muhurat";
import { navamsaD9 } from "./content/navamsa-d9";

export const LEARN_ARTICLES: LearnArticle[] = [
  nakshatrasOverview,
  manglikDosha,
  kaalSarpDosha,
  rashiVsSunSign,
  choosingMuhurat,
  navamsaD9,
];

export const findArticleBySlug = (slug: string): LearnArticle | undefined =>
  LEARN_ARTICLES.find((a) => a.slug === slug);

export const listArticleSlugs = (): string[] => LEARN_ARTICLES.map((a) => a.slug);
