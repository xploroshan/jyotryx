import { pageMetadata } from "@/lib/seo/page-metadata";
import VastuClient from "./VastuClient";

export const metadata = pageMetadata({
  title: "Vastu Shastra Tips & Consultation Online | myastro360",
  description:
    "Vastu Shastra guidance for home and office — directions, room placement and practical remedies to improve harmony, health and prosperity.",
  path: "/vastu",
  keywords: ["vastu shastra", "vastu tips", "vastu for home", "vastu consultation"],
});

export default function Page() {
  return <VastuClient />;
}
