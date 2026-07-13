import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { jsonLdHtml, serviceLd } from "@/lib/seo/json-ld";
import { SITE_ORIGIN } from "@/lib/seo/server-api";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import PalmistryClient from "./PalmistryClient";

export const metadata = pageMetadata({ path: "/palmistry", ...FEATURE_PAGES["/palmistry"], hreflang: true });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            serviceLd({
              name: "Free Palm Reading (Palmistry)",
              serviceType: "Palmistry analysis",
              description: FEATURE_PAGES["/palmistry"].description,
              url: `${SITE_ORIGIN}/palmistry`,
            }),
          ),
        }}
      />
      <PalmistryClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/palmistry"]} />
      <LanguageLinkRow path="/palmistry" />
    </>
  );
}
