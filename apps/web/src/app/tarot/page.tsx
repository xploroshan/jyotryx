import { pageMetadata } from "@/lib/seo/page-metadata";
import TarotClient from "./TarotClient";

export const metadata = pageMetadata({
  title: "Free Online Tarot Card Reading | myastro360",
  description:
    "Get a free online tarot reading for love, career and life questions — with clear card meanings and personalized guidance. Instant and private.",
  path: "/tarot",
  keywords: ["tarot reading", "free tarot", "online tarot cards", "love tarot"],
});

export default function Page() {
  return <TarotClient />;
}
