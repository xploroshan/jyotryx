import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { jsonLdHtml, serviceLd } from "@/lib/seo/json-ld";
import { SITE_ORIGIN } from "@/lib/seo/server-api";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import TarotClient from "./TarotClient";

export const metadata = pageMetadata({ path: "/tarot", ...FEATURE_PAGES["/tarot"], hreflang: true });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            serviceLd({
              name: "Free Online Tarot Card Reading",
              serviceType: "Tarot reading",
              description: FEATURE_PAGES["/tarot"].description,
              url: `${SITE_ORIGIN}/tarot`,
            }),
          ),
        }}
      />
      <TarotClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/tarot"]} />
      <LanguageLinkRow path="/tarot" />
    </>
  );
}
