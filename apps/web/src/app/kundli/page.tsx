import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { FEATURE_CONTENT } from "@/lib/seo/feature-content";
import { FeatureSeoSection } from "@/components/seo/FeatureSeoSection";
import KundliClient from "./KundliClient";

export const metadata = pageMetadata({ path: "/kundli", ...FEATURE_PAGES["/kundli"], hreflang: true });

export default function Page() {
  return (
    <>
      <Suspense fallback={null}>
        <KundliClient />
      </Suspense>
      <FeatureSeoSection content={FEATURE_CONTENT["/kundli"]} />
    </>
  );
}
