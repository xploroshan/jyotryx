import type { Metadata } from "next";
import HoraryAskClient from "./HoraryAskClient";

// Per-user app surface: excluded from TRADITION_PAGES/sitemap and explicitly
// noindexed (robots.txt disallow blocks crawling, but only noindex actually
// keeps an already-discovered URL out of the index).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Page() {
  return <HoraryAskClient />;
}
