import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import VastuClient from "./VastuClient";

export const metadata = pageMetadata({ path: "/vastu", ...FEATURE_PAGES["/vastu"], hreflang: true });

export default function Page() {
  return (
    <>
      <VastuClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/vastu"]} />
    </>
  );
}
