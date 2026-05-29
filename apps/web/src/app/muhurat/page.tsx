import { pageMetadata } from "@/lib/seo/page-metadata";
import MuhuratClient from "./MuhuratClient";

export const metadata = pageMetadata({
  title: "Shubh Muhurat — Auspicious Dates & Timings | myastro360",
  description:
    "Find the shubh muhurat (auspicious timing) for marriage, griha pravesh, naming and travel — based on panchang and your birth details.",
  path: "/muhurat",
  keywords: ["shubh muhurat", "auspicious time", "muhurat for marriage", "griha pravesh muhurat"],
});

export default function Page() {
  return <MuhuratClient />;
}
