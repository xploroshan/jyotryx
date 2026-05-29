import { pageMetadata } from "@/lib/seo/page-metadata";
import HomeClient from "./HomeClient";

export const metadata = pageMetadata({
  title: "myastro360 — Vedic Astrology, Kundli, Horoscope & Palm Reading",
  description:
    "Instant, personalized Vedic astrology — free Kundli, daily horoscopes, Kundli matching, palmistry, numerology and panchang. Talk to astrologers 24/7.",
  path: "/",
});

export default function Page() {
  return <HomeClient />;
}
