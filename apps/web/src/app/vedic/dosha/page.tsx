import { pageMetadata } from "@/lib/seo/page-metadata";
import { TRADITION_PAGES } from "@/lib/seo/tradition-pages";
import VedicDoshaClient from "./VedicDoshaClient";
import { RelatedGuides } from "@/components/seo/RelatedGuides";

// Thin server wrapper: owns the route's metadata (title/canonical/OG) while
// the interactive tool stays a client component. No hreflang — tradition
// pages exist only at the English root.
export const metadata = pageMetadata({ path: "/vedic/dosha", ...TRADITION_PAGES["/vedic/dosha"] });

export default function Page() {
  return (
    <>
      <VedicDoshaClient />
      <RelatedGuides path="/vedic/dosha" />
    </>
  );
}
