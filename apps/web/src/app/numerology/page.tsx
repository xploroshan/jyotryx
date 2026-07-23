import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { jsonLdHtml, serviceLd } from "@/lib/seo/json-ld";
import { SITE_ORIGIN } from "@/lib/seo/server-api";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import { RelatedGuides } from "@/components/seo/RelatedGuides";
import NumerologyClient from "./NumerologyClient";

export const metadata = pageMetadata({ path: "/numerology", ...FEATURE_PAGES["/numerology"], hreflang: true });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            serviceLd({
              name: "Free Numerology Calculator",
              serviceType: "Numerology reading",
              description: FEATURE_PAGES["/numerology"].description,
              url: `${SITE_ORIGIN}/numerology`,
            }),
          ),
        }}
      />
      <NumerologyClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/numerology"]} />
      <RelatedGuides path="/numerology" />
      <LanguageLinkRow path="/numerology" />
    </>
  );
}
