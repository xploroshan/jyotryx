import { Suspense } from "react";
import { pageMetadata } from "@/lib/seo/page-metadata";
import KundliClient from "./KundliClient";

export const metadata = pageMetadata({
  title: "Free Kundli Online — Janam Kundali & Birth Chart | myastro360",
  description:
    "Generate your free Janam Kundali (birth chart) instantly with Swiss Ephemeris accuracy — planetary positions, dashas, doshas and personalized predictions.",
  path: "/kundli",
  keywords: ["free kundli", "janam kundali", "birth chart", "vedic astrology", "horoscope chart"],
});

export default function Page() {
  // KundliClient reads useSearchParams, which requires a Suspense boundary
  // now that the page shell is a server component.
  return (
    <Suspense fallback={null}>
      <KundliClient />
    </Suspense>
  );
}
