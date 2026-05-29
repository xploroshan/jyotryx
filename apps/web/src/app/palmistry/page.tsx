import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import PalmistryClient from "./PalmistryClient";

export const metadata = pageMetadata({ path: "/palmistry", ...FEATURE_PAGES["/palmistry"], hreflang: true });

export default function Page() {
  return <PalmistryClient />;
}
