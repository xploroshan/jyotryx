import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import MuhuratClient from "./MuhuratClient";

export const metadata = pageMetadata({ path: "/muhurat", ...FEATURE_PAGES["/muhurat"], hreflang: true });

export default function Page() {
  return <MuhuratClient />;
}
