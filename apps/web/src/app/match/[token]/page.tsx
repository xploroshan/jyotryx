import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchSharedMatch, SITE_ORIGIN } from "@/lib/seo/server-api";
import SharedMatchView from "@/components/match/SharedMatchView";

interface RouteProps {
  params: Promise<{ token: string }>;
}

// generateMetadata and the page render both need the snapshot. Wrapping the
// (no-store) fetch in React's per-request cache() collapses them into a single
// upstream call, so a visit bumps the view counter once rather than twice.
const getSharedMatch = cache((token: string) => fetchSharedMatch(token));

/**
 * Public, link-only view of a shared Kundli-match result.
 *
 * These are private share artifacts, not SEO surfaces — hence `noindex` and a
 * per-token OG card so the link previews richly on WhatsApp / social while
 * staying out of search. The snapshot holds no birth details.
 */
export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { token } = await params;
  const data = await getSharedMatch(token);
  if (!data) {
    return { title: "Shared compatibility result | myastro360", robots: { index: false, follow: false } };
  }

  const pair = `${data.personAName} & ${data.personBName}`;
  const title = `${pair} — ${data.percentage}% Kundli compatibility | myastro360`;
  const description = `${pair} scored ${data.totalScore}/${data.maxScore} (${data.percentage}%) on Ashtakoota Guna Milan. See the full koota-by-koota breakdown on myastro360.`;
  const url = `${SITE_ORIGIN}/match/${token}`;
  const ogImage = `/match/${token}/og`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      siteName: "myastro360",
      images: [{ url: ogImage, width: 1200, height: 630, alt: pair }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function SharedMatchPage({ params }: RouteProps) {
  const { token } = await params;
  const data = await getSharedMatch(token);
  if (!data) notFound();
  return <SharedMatchView data={data} />;
}
