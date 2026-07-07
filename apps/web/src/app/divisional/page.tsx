import { pageMetadata } from "@/lib/seo/page-metadata";
import { TRADITION_PAGES } from "@/lib/seo/tradition-pages";
import DivisionalClient from "./DivisionalClient";

// Thin server wrapper: owns the route's metadata (title/canonical/OG) while
// the interactive tool stays a client component. No hreflang — tradition
// pages exist only at the English root.
export const metadata = pageMetadata({ path: "/divisional", ...TRADITION_PAGES["/divisional"] });

export default function Page() {
  return <DivisionalClient />;
}
