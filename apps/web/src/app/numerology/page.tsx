import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import NumerologyClient from "./NumerologyClient";

export const metadata = pageMetadata({ path: "/numerology", ...FEATURE_PAGES["/numerology"], hreflang: true });

export default function Page() {
  return (
    <>
      <NumerologyClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/numerology"]} />
    </>
  );
}
