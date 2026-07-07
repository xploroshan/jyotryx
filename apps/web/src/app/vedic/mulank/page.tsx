import { pageMetadata } from "@/lib/seo/page-metadata";
import { TRADITION_PAGES } from "@/lib/seo/tradition-pages";
import VedicMulankClient from "./VedicMulankClient";

// Thin server wrapper: owns the route's metadata (title/canonical/OG) while
// the interactive tool stays a client component. No hreflang — tradition
// pages exist only at the English root.
export const metadata = pageMetadata({ path: "/vedic/mulank", ...TRADITION_PAGES["/vedic/mulank"] });

export default function Page() {
  return <VedicMulankClient />;
}
