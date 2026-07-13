import { Suspense } from "react";
import { en } from "@/i18n/en";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { jsonLdHtml, serviceLd } from "@/lib/seo/json-ld";
import { SITE_ORIGIN } from "@/lib/seo/server-api";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import { FeatureGlyph } from "@/components/icons";
import KundliClient from "./KundliClient";

export const metadata = pageMetadata({ path: "/kundli", ...FEATURE_PAGES["/kundli"], hreflang: true });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            serviceLd({
              name: "Free Kundli (Vedic Birth Chart)",
              serviceType: "Vedic birth chart generation",
              description: FEATURE_PAGES["/kundli"].description,
              url: `${SITE_ORIGIN}/kundli`,
            }),
          ),
        }}
      />
{/* H1 lives HERE, not in KundliClient: the client tree below is
          suspended (it reads ?place= via useSearchParams), so anything
          inside it is missing from the crawler-visible initial HTML. */}
      <FeatureHeader
        tint="amber"
        eyebrow={en.kundli.badge}
        eyebrowIcon={<FeatureGlyph slug="kundli" size={18} />}
        headline={`${en.kundli.title} {em}${en.kundli.titleHighlight}{/em}`}
        tagline={en.kundli.description}
      />
      {/*
        CLS guard: KundliClient renders client-side behind this Suspense
        boundary. With a `null` fallback it contributed zero height on first
        paint and then expanded to the birth-details form on hydration,
        shoving FeatureSeoSection (and the footer) down — a 0.87 CLS on
        /kundli before the fixes. Two things now hold the layout still:
        the hero (~324px) is server-rendered above (so it never shifts), and
        this fallback reserves the FORM's height (~743px at Lighthouse's
        412px mobile width — the original 1067px measurement minus the
        hoisted hero). Re-measure if the form gains or loses fields.
      */}
      <Suspense fallback={<div className="min-h-[743px]" aria-hidden />}>
        <KundliClient />
      </Suspense>
      <FeatureSeoSection content={FEATURE_CONTENT["/kundli"]} />
      <LanguageLinkRow path="/kundli" />
    </>
  );
}
