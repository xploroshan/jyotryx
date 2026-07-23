import Link from "next/link";
import { en } from "@/i18n/en";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { HUB_PAGES } from "@/lib/seo/feature-pages";
import { ZODIAC_SIGNS } from "@/lib/seo/zodiac";
import { fetchHoroscope, SITE_ORIGIN } from "@/lib/seo/server-api";
import { jsonLdHtml, serviceLd } from "@/lib/seo/json-ld";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import { FeatureGlyph } from "@/components/icons";
import { ZodiacGlyph } from "@/components/icons/astro";
import HoroscopeClient from "./HoroscopeClient";
import { RelatedGuides } from "@/components/seo/RelatedGuides";

/**
 * Server shell for the /horoscope hub.
 *
 * This page previously mounted a fully client component: no metadata, the
 * forecast fetched after hydration, and the 12-sign grid rendered as
 * <button>s — which meant the hub linked NONE of its 48 English sign/period
 * landing pages and Google saw only nav text. The server shell fixes all
 * three: real metadata, today's forecasts in initial HTML, and a crawlable
 * <Link> grid into the sign cluster. The interactive tradition-switching
 * widget stays intact below as a client child.
 *
 * No hreflang here on purpose: /<locale>/horoscope hub routes do not exist
 * (only the [sign] children do) — see HUB_PAGES in feature-pages.ts.
 */

export const metadata = pageMetadata({
  path: "/horoscope",
  ...HUB_PAGES["/horoscope"],
});

const PERIODS = ["weekly", "monthly", "yearly"] as const;

export default async function HoroscopeHubPage() {
  // One fetch per sign; these share Next's URL-keyed data cache (same URL +
  // revalidate) with the /horoscope/[sign] pages, so the strip is near-free
  // after the first render. Null-tolerant: a failed sign just omits its
  // snippet — the links must render regardless.
  const forecasts = await Promise.all(
    ZODIAC_SIGNS.map(async (s) => ({
      sign: s,
      forecast: (await fetchHoroscope(s.slug))?.forecast ?? null,
    })),
  );

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const jsonLdBreadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Horoscope", item: `${SITE_ORIGIN}/horoscope` },
    ],
  };
  const jsonLdItemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Daily horoscopes for all 12 zodiac signs",
    itemListElement: ZODIAC_SIGNS.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${s.name} Horoscope`,
      url: `${SITE_ORIGIN}/horoscope/${s.slug}`,
    })),
  };
  const jsonLdService = serviceLd({
    name: "Today's Horoscope for All 12 Zodiac Signs",
    serviceType: "Daily horoscope",
    description: HUB_PAGES["/horoscope"].description,
    url: `${SITE_ORIGIN}/horoscope`,
  });

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdService) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdItemList) }}
      />

      <FeatureHeader
        tint="violet"
        eyebrow={en.horoscope.badge}
        eyebrowIcon={<FeatureGlyph slug="horoscope" size={18} />}
        headline={`${en.horoscope.title} {em}${en.horoscope.titleHighlight}{/em}`}
        tagline={en.horoscope.description}
      />

      {/* Crawlable sign directory — today's snippet + links into the
          /horoscope/[sign] cluster (and its weekly/monthly/yearly children).
          This is the hub's server-rendered primary content. */}
      <section className="relative mx-auto max-w-6xl px-4 pt-10 sm:pt-12">
        <h2 className="text-lg font-semibold text-surface-950 mb-1">
          Today&apos;s horoscope — {today}
        </h2>
        <p className="text-sm text-[rgba(12,8,5,0.66)] mb-6">
          Pick your sign for the full daily forecast, or jump straight to the weekly, monthly or
          yearly outlook.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {forecasts.map(({ sign, forecast }) => (
            <div key={sign.slug} className="surface-card p-4 flex flex-col">
              <Link
                href={`/horoscope/${sign.slug}`}
                className="group flex items-center gap-3 mb-2"
              >
                <ZodiacGlyph sign={sign.slug} size={30} className="text-primary-700 shrink-0" />
                <span>
                  <span className="block text-sm font-semibold text-surface-950 group-hover:text-primary-700 transition-colors">
                    {sign.name} Horoscope
                  </span>
                  <span className="block text-xs text-[rgba(12,8,5,0.66)]">{sign.dateRange}</span>
                </span>
              </Link>
              {forecast && (
                <p className="text-xs text-emphasis leading-relaxed mb-2 line-clamp-3">
                  {forecast.length > 160 ? `${forecast.slice(0, 160)}…` : forecast}
                </p>
              )}
              <p className="mt-auto pt-1 text-xs text-[rgba(12,8,5,0.66)]">
                {PERIODS.map((p, i) => (
                  <span key={p}>
                    {i > 0 && <span aria-hidden> · </span>}
                    <Link
                      href={`/horoscope/${sign.slug}/${p}`}
                      className="text-primary-300 hover:text-primary-400 capitalize"
                    >
                      {p}
                    </Link>
                  </span>
                ))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Interactive widget: tradition switching, Chinese zodiac, multi-
          tradition summary — client-only by nature (auth/store dependent). */}
      <HoroscopeClient />
      <RelatedGuides path="/horoscope" />
    </div>
  );
}
