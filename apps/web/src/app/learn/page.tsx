import Link from "next/link";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { LEARN_ARTICLES } from "@/lib/learn/articles";
import { jsonLdHtml, breadcrumbLd, itemListLd } from "@/lib/seo/json-ld";
import { SITE_ORIGIN } from "@/lib/seo/server-api";

/**
 * /learn hub — the informational content layer. Server-rendered card grid
 * linking every article; ItemList + Breadcrumb JSON-LD.
 */

export const metadata = pageMetadata({
  path: "/learn",
  title: "Learn Vedic Astrology — Nakshatras, Doshas, Muhurat & Charts",
  description:
    "Clear, practical guides to Vedic astrology: the 27 nakshatras, Manglik and Kaal Sarp dosha, choosing a shubh muhurat, the Navamsa chart, and how rashi differs from your sun sign.",
  keywords: ["learn vedic astrology", "jyotish basics", "astrology guides"],
});

export default function LearnHubPage() {
  const jsonLdBreadcrumb = breadcrumbLd([
    { name: "Home", url: SITE_ORIGIN },
    { name: "Learn", url: `${SITE_ORIGIN}/learn` },
  ]);
  const jsonLdItemList = itemListLd(
    "Vedic astrology guides",
    LEARN_ARTICLES.map((a) => ({ name: a.title, url: `${SITE_ORIGIN}/learn/${a.slug}` })),
  );

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 fade-in-up">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdBreadcrumb) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdItemList) }}
        />

        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-primary-400 font-semibold mb-2">
            Learn
          </p>
          <h1 className="text-3xl font-bold text-gradient">Vedic astrology, explained clearly</h1>
          <p className="text-sm text-secondary mt-2 max-w-2xl">
            Practical guides to the ideas behind your kundli — written to be accurate to the
            classical sources and honest about where traditions differ.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LEARN_ARTICLES.map((a) => (
            <Link
              key={a.slug}
              href={`/learn/${a.slug}`}
              className="block surface-card p-5 hover:bg-[rgba(255,252,245,0.92)] transition-colors"
            >
              <p className="text-xs uppercase tracking-wide text-[rgba(12,8,5,0.55)] mb-1">
                {a.hero.eyebrow}
              </p>
              <h2 className="text-base font-semibold text-surface-950 mb-2">{a.hero.headline}</h2>
              <p className="text-sm text-[rgba(12,8,5,0.7)] leading-relaxed line-clamp-3">
                {a.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
