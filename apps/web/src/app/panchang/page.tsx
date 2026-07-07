import Link from "next/link";
import { en } from "@/i18n/en";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { HUB_PAGES } from "@/lib/seo/feature-pages";
import { SEO_CITIES } from "@/lib/seo/cities";
import { fetchPanchang, SITE_ORIGIN } from "@/lib/seo/server-api";
import { jsonLdHtml } from "@/lib/seo/json-ld";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import { FeatureGlyph } from "@/components/icons";
import PanchangClient from "./PanchangClient";

/**
 * Server shell for the /panchang hub ("aaj ka panchang").
 *
 * Previously a fully client page: no metadata, today's panchang fetched
 * after hydration, and the ONLY link to the 50 /panchang/[city] landing
 * pages hidden inside the post-fetch success branch. Now the server fetches
 * the panchang (Delhi as the national reference point — city pages carry
 * the location-exact values) and passes it to the client widget as a prop,
 * so the full card grid is in initial HTML; the city/feature links below
 * are server-rendered and always visible.
 *
 * No hreflang on purpose: /<locale>/panchang hub routes do not exist (only
 * the [city] children) — see HUB_PAGES in feature-pages.ts.
 */

export const metadata = pageMetadata({
  path: "/panchang",
  ...HUB_PAGES["/panchang"],
});

// New Delhi — the conventional national reference for a city-less panchang.
const DELHI = { lat: 28.6139, lng: 77.209 } as const;

export default async function PanchangHubPage() {
  // 6h ISR via the fetch-level revalidate inside fetchPanchang. Null is
  // tolerated: the client widget falls back to its own fetch, and the links
  // + explainer below render regardless — this page is never empty.
  const panchang = await fetchPanchang(DELHI.lat, DELHI.lng);

  const topCities = [...SEO_CITIES]
    .sort((a, b) => b.population - a.population)
    .slice(0, 10);

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Panchang", item: `${SITE_ORIGIN}/panchang` },
    ],
  };
  const jsonLdItemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "City-accurate panchang pages",
    itemListElement: topCities.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `Panchang for ${c.name}`,
      url: `${SITE_ORIGIN}/panchang/${c.slug}`,
    })),
  };

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdItemList) }}
      />

      <FeatureHeader
        tint="amber"
        eyebrow={en.panchang.badge}
        eyebrowIcon={<FeatureGlyph slug="panchang" size={18} />}
        headline={`${en.panchang.title} {em}${en.panchang.titleHighlight}{/em}`}
        tagline={en.panchang.description}
      />

      {/* Interactive panchang cards — server data arrives via prop, so the
          grid is in initial HTML; the widget re-fetches only for non-English
          locales. */}
      <PanchangClient initialPanchang={panchang} />

      {/* Crawlable city directory — always visible, independent of the data
          fetch. This is the link path from the hub into the 50-city cluster. */}
      <section className="relative mx-auto max-w-5xl px-4 pb-12">
        <div className="surface-card p-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-1">
            Panchang for your city
          </h2>
          <p className="text-sm text-[rgba(12,8,5,0.66)] mb-4">
            Sunrise, sunset, Rahu Kaal and tithi timings shift with location — open your city for
            minute-accurate values.
          </p>
          <ul className="flex flex-wrap gap-2 mb-4">
            {topCities.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/panchang/${c.slug}`}
                  className="inline-block px-3 py-1.5 rounded-full bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.92)] text-sm text-emphasis transition-colors"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-sm">
            <Link href="/panchang/cities" className="text-primary-300 hover:text-primary-400">
              Browse all {SEO_CITIES.length} cities →
            </Link>
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <Link
            href="/kundli"
            className="block surface-card p-4 hover:bg-[rgba(255,252,245,0.92)] transition-colors"
          >
            <p className="text-sm font-medium text-surface-950">Free Kundli (birth chart)</p>
            <p className="text-xs text-[rgba(12,8,5,0.72)] mt-1">
              Full Vedic janam kundali with dashas, doshas and predictions.
            </p>
          </Link>
          <Link
            href="/muhurat"
            className="block surface-card p-4 hover:bg-[rgba(255,252,245,0.92)] transition-colors"
          >
            <p className="text-sm font-medium text-surface-950">Find an auspicious muhurat</p>
            <p className="text-xs text-[rgba(12,8,5,0.72)] mt-1">
              Wedding, griha-pravesh, vehicle and naming timings from today&apos;s panchang.
            </p>
          </Link>
        </div>
      </section>
    </div>
  );
}
