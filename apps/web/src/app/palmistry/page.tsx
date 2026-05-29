import { pageMetadata } from "@/lib/seo/page-metadata";
import PalmistryClient from "./PalmistryClient";

export const metadata = pageMetadata({
  title: "Free Palmistry — AI Palm Reading Online | myastro360",
  description:
    "Free palm reading online — upload a photo of your palm for an AI-assisted analysis of your heart, head, life and fate lines.",
  path: "/palmistry",
  keywords: ["palmistry", "palm reading", "free palm reading", "hast rekha"],
});

export default function Page() {
  return <PalmistryClient />;
}
