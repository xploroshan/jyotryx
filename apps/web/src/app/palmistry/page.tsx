import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import PalmistryClient from "./PalmistryClient";

export const metadata = pageMetadata({ path: "/palmistry", ...FEATURE_PAGES["/palmistry"], hreflang: true });

export default function Page() {
  return (
    <>
      <PalmistryClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/palmistry"]} />
      <LanguageLinkRow path="/palmistry" />
    </>
  );
}
