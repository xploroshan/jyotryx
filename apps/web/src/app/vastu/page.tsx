import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { jsonLdHtml, serviceLd } from "@/lib/seo/json-ld";
import { SITE_ORIGIN } from "@/lib/seo/server-api";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import VastuClient from "./VastuClient";

export const metadata = pageMetadata({ path: "/vastu", ...FEATURE_PAGES["/vastu"], hreflang: true });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            serviceLd({
              name: "Vastu Shastra Guidance",
              serviceType: "Vastu guidance",
              description: FEATURE_PAGES["/vastu"].description,
              url: `${SITE_ORIGIN}/vastu`,
            }),
          ),
        }}
      />
      <VastuClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/vastu"]} />
      <LanguageLinkRow path="/vastu" />
    </>
  );
}
