import type { Metadata } from "next";
import { SITE_ORIGIN } from "./server-api";

interface PageMetaInput {
  title: string;
  description: string;
  /** Route path beginning with "/", e.g. "/numerology" (or "/" for home). */
  path: string;
  keywords?: string[];
}

/**
 * Builds per-page metadata with a SELF-referencing canonical plus matching
 * OpenGraph/Twitter cards.
 *
 * Centralised on purpose: the root layout previously set a static
 * `alternates.canonical: "/"`, which Next inherits into every page that
 * doesn't override it — silently canonicalising all feature pages to the
 * homepage. Routing every page through this helper guarantees a correct
 * self-canonical and keeps titles/descriptions unique per page.
 */
export function pageMetadata({ title, description, path, keywords }: PageMetaInput): Metadata {
  const url = `${SITE_ORIGIN}${path === "/" ? "" : path}`;
  return {
    title,
    description,
    ...(keywords ? { keywords } : {}),
    // Relative canonical is resolved against `metadataBase` by Next.
    alternates: { canonical: path },
    // NOTE: Next shallow-merges `openGraph`, so a page that sets it does NOT
    // inherit the layout's images — we must include the card here explicitly.
    openGraph: {
      title,
      description,
      url,
      type: "website",
      siteName: "myastro360",
      images: [{ url: "/og", width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og"] },
  };
}

