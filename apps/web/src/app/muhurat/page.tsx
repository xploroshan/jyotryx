import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { jsonLdHtml, serviceLd } from "@/lib/seo/json-ld";
import { SITE_ORIGIN } from "@/lib/seo/server-api";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import MuhuratClient from "./MuhuratClient";

export const metadata = pageMetadata({ path: "/muhurat", ...FEATURE_PAGES["/muhurat"], hreflang: true });

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml(
            serviceLd({
              name: "Shubh Muhurat Finder",
              serviceType: "Muhurat timing",
              description: FEATURE_PAGES["/muhurat"].description,
              url: `${SITE_ORIGIN}/muhurat`,
            }),
          ),
        }}
      />
      <MuhuratClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/muhurat"]} />
      <LanguageLinkRow path="/muhurat" />
    </>
  );
}
