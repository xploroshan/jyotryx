import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { jsonLdHtml, serviceLd } from "@/lib/seo/json-ld";
import { SITE_ORIGIN } from "@/lib/seo/server-api";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import MatchingClient from "./MatchingClient";

export const metadata = pageMetadata({ path: "/matching", ...FEATURE_PAGES["/matching"], hreflang: true });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            serviceLd({
              name: "Kundli Matching for Marriage (Guna Milan)",
              serviceType: "Kundli matching / compatibility analysis",
              description: FEATURE_PAGES["/matching"].description,
              url: `${SITE_ORIGIN}/matching`,
            }),
          ),
        }}
      />
      <MatchingClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/matching"]} />
      <LanguageLinkRow path="/matching" />
    </>
  );
}
