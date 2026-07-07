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
      {/*
        KundliClient reads useSearchParams (the `?place=` SEO deep-link), which
        opts it into client-side rendering behind this Suspense boundary. With a
        `null` fallback it contributed zero height on first paint and then
        expanded to the full hero + birth-details form on hydration, shoving
        FeatureSeoSection (and the footer) down by ~1067px — a 0.87 Cumulative
        Layout Shift that failed the Lighthouse budget (≤ 0.1) on /kundli.
        Reserve that height in the fallback so the SEO section keeps its final
        position from first paint. The value is hero (~324px) + the birth-
        details form, measured at Lighthouse's 412px mobile width; re-measure
        if the form gains or loses fields.
      */}
      <Suspense fallback={<div className="min-h-[1067px]" aria-hidden />}>
        <KundliClient />
      </Suspense>
      <FeatureSeoSection content={FEATURE_CONTENT["/kundli"]} />
    </>
  );
}
