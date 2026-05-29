import { pageMetadata } from "@/lib/seo/page-metadata";
import NumerologyClient from "./NumerologyClient";

export const metadata = pageMetadata({
  title: "Free Numerology Calculator — Name & Birth Numbers | myastro360",
  description:
    "Discover your numerology profile — life path, destiny and name numbers — with a free instant calculator and a clear, personalized interpretation.",
  path: "/numerology",
  keywords: ["numerology calculator", "life path number", "destiny number", "name numerology"],
});

export default function Page() {
  return <NumerologyClient />;
}
