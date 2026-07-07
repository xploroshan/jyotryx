import { pageMetadata } from "@/lib/seo/page-metadata";
import { FEATURE_PAGES } from "@/lib/seo/feature-pages";
import { LanguageLinkRow } from "@/components/seo/LanguageLinkRow";
import HomeClient from "./HomeClient";

export const metadata = pageMetadata({ path: "/", ...FEATURE_PAGES["/"], hreflang: true, absoluteTitle: true });

export default function Page() {
  return (
    <>
      <HomeClient />
      <LanguageLinkRow path="/" />
    </>
  );
}
