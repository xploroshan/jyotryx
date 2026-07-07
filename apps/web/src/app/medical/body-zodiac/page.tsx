import { pageMetadata } from "@/lib/seo/page-metadata";
import { TRADITION_PAGES } from "@/lib/seo/tradition-pages";
import MedicalBodyZodiacClient from "./MedicalBodyZodiacClient";

// Thin server wrapper: owns the route's metadata (title/canonical/OG) while
// the interactive tool stays a client component. No hreflang — tradition
// pages exist only at the English root.
export const metadata = pageMetadata({ path: "/medical/body-zodiac", ...TRADITION_PAGES["/medical/body-zodiac"] });

export default function Page() {
  return <MedicalBodyZodiacClient />;
}
