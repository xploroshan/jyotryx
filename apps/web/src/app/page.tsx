import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import HomeClient from "./HomeClient";

export const metadata = pageMetadata({ path: "/", ...FEATURE_PAGES["/"], hreflang: true });

export default function Page() {
  return <HomeClient />;
}
