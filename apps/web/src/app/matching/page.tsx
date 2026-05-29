import { pageMetadata } from "@/lib/seo/page-metadata";
import MatchingClient from "./MatchingClient";

export const metadata = pageMetadata({
  title: "Kundli Matching for Marriage — Guna Milan | myastro360",
  description:
    "Free online Kundli matching (Guna Milan / Ashtakoot) for marriage compatibility — 36-guna score, Mangal dosha check and a detailed compatibility report.",
  path: "/matching",
  keywords: ["kundli matching", "guna milan", "marriage compatibility", "ashtakoot", "mangal dosha"],
});

export default function Page() {
  return <MatchingClient />;
}
