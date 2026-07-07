import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import TarotClient from "./TarotClient";

export const metadata = pageMetadata({ path: "/tarot", ...FEATURE_PAGES["/tarot"], hreflang: true });

export default function Page() {
  return (
    <>
      <TarotClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/tarot"]} />
      <LanguageLinkRow path="/tarot" />
    </>
  );
}
