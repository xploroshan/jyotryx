import { articlesForTool } from "@/lib/learn/articles";

/**
 * "Related guides" — server-rendered links from a TOOL page to the Learn
 * articles that support it, inverted from each article's own `toolLinks`.
 *
 * Closes the internal-link loop the SEO audit flagged (O3): articles already
 * link into their tool pages, but tool pages linked to zero articles. Tool
 * pages attract the most internal + external links, so linking them to the
 * guides passes authority down to the editorial cluster and gives Googlebot
 * a crawlable path into it — while giving users the "learn more" next step.
 *
 * Renders nothing when no article declares this tool (safe on every page).
 */
export function RelatedGuides({
  path,
  heading = "Related guides",
  intro = "Understand the concepts behind this tool:",
}: {
  /** Tool route path, e.g. "/kundli" or "/matching". */
  path: string;
  heading?: string;
  intro?: string;
}) {
  const articles = articlesForTool(path);
  if (articles.length === 0) return null;

  return (
    <section
      aria-label={heading}
      className="mx-auto max-w-6xl px-4 py-8 border-t border-black/[0.06]"
    >
      <h2 className="text-lg font-semibold text-surface-950 mb-1">{heading}</h2>
      <p className="text-sm text-[rgba(12,8,5,0.66)] mb-5">{intro}</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <li key={a.slug}>
            <a
              href={`/learn/${a.slug}`}
              className="group block h-full rounded-xl border border-black/[0.08] bg-[rgba(255,252,245,0.5)] p-4 transition-colors hover:border-primary-400/40 hover:bg-[rgba(255,252,245,0.85)]"
            >
              <span className="block text-sm font-semibold text-surface-950 group-hover:text-primary-500">
                {a.title}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-[rgba(12,8,5,0.62)]">
                {a.description}
              </span>
              <span className="mt-2 inline-block text-xs font-medium text-primary-500">
                Read the guide →
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default RelatedGuides;
