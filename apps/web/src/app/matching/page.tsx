import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import MatchingClient from "./MatchingClient";

export const metadata = pageMetadata({ path: "/matching", ...FEATURE_PAGES["/matching"], hreflang: true });

export default function Page() {
  return (
    <>
      <MatchingClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/matching"]} />
      <LanguageLinkRow path="/matching" />
    </>
  );
}
