import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import MuhuratClient from "./MuhuratClient";

export const metadata = pageMetadata({ path: "/muhurat", ...FEATURE_PAGES["/muhurat"], hreflang: true });

export default function Page() {
  return (
    <>
      <MuhuratClient />
      <FeatureSeoSection content={FEATURE_CONTENT["/muhurat"]} />
    </>
  );
}
