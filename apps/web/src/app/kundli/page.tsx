import { Suspense } from "react";
import { en } from "@/i18n/en";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import { FeatureGlyph } from "@/components/icons";
import KundliClient from "./KundliClient";

export const metadata = pageMetadata({ path: "/kundli", ...FEATURE_PAGES["/kundli"], hreflang: true });

export default function Page() {
  return (
    <>
      {/* H1 lives HERE, not in KundliClient: the client tree below is
          suspended with fallback={null} (it reads ?place= via
          useSearchParams), so anything inside it is missing from the
          crawler-visible initial HTML. */}
      <FeatureHeader
        tint="amber"
        eyebrow={en.kundli.badge}
        eyebrowIcon={<FeatureGlyph slug="kundli" size={18} />}
        headline={`${en.kundli.title} {em}${en.kundli.titleHighlight}{/em}`}
        tagline={en.kundli.description}
      />
      <Suspense fallback={null}>
        <KundliClient />
      </Suspense>
      <FeatureSeoSection content={FEATURE_CONTENT["/kundli"]} />
      <LanguageLinkRow path="/kundli" />
    </>
  );
}
