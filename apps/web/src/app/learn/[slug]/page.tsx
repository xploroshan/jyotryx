import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findArticleBySlug, listArticleSlugs, LEARN_ARTICLES } from "@/lib/learn/articles";
import { pageMetadata } from "@/lib/seo/page-metadata";
import { jsonLdHtml, articleLd, breadcrumbLd, definedTermLd, howToLd } from "@/lib/seo/json-ld";
import { FaqSection } from "@/components/seo/FaqSection";
import { SITE_ORIGIN } from "@/lib/seo/server-api";

/**
 * /learn/[slug] — article template. Fully server-rendered from the typed
 * content modules; Article + Breadcrumb JSON-LD via the shared builders, FAQ
 * via FaqSection (visible + schema from one array), and a mandatory tool CTA
 * so every article feeds authority into its product page.
 */

// The param space is CLOSED (generateStaticParams enumerates every valid
// value), so reject everything else at the ROUTER with a real HTTP 404.
// Without this, notFound() thrown inside a streamed render (the root
// loading.tsx makes responses stream) can only inject a meta-noindex into an
// HTTP 200 — the "soft-404 at site scale" the SEO audit measured live.
export const dynamicParams = false;

export function generateStaticParams() {
  return listArticleSlugs().map((slug) => ({ slug }));
}

interface RouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const article = findArticleBySlug(slug);
  if (!article) return {};
  const md = pageMetadata({
    path: `/learn/${article.slug}`,
    title: article.title,
    description: article.description,
    keywords: article.keywords,
  });
  return {
    ...md,
    openGraph: { ...md.openGraph, type: "article" },
  };
}

export default async function LearnArticlePage({ params }: RouteProps) {
  const { slug } = await params;
  const article = findArticleBySlug(slug);
  if (!article) notFound();

  const url = `${SITE_ORIGIN}/learn/${article.slug}`;
  const jsonLdArticle = articleLd({
    headline: article.title,
    description: article.description,
    url,
    datePublished: new Date(article.datePublished),
    dateModified: new Date(article.dateModified),
    inLanguage: "en",
  });
  const jsonLdBreadcrumb = breadcrumbLd([
    { name: "Home", url: SITE_ORIGIN },
    { name: "Learn", url: `${SITE_ORIGIN}/learn` },
    { name: article.hero.headline, url },
  ]);
  const jsonLdDefinedTerm = article.definedTerm
    ? definedTermLd({
        name: article.definedTerm.term,
        description: article.definedTerm.definition,
        url,
      })
    : undefined;
  const jsonLdHowTo = article.howTo
    ? howToLd({ name: article.howTo.heading, steps: article.howTo.steps, url })
    : undefined;

  const related = article.related
    .map((s) => LEARN_ARTICLES.find((a) => a.slug === s))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 fade-in-up">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdArticle) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdBreadcrumb) }}
        />
        {jsonLdDefinedTerm && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdDefinedTerm) }}
          />
        )}
        {jsonLdHowTo && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdHowTo) }}
          />
        )}

        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[rgba(12,8,5,0.66)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-surface-950">Home</Link></li>
            <li>›</li>
            <li><Link href="/learn" className="hover:text-surface-950">Learn</Link></li>
            <li>›</li>
            <li className="text-emphasis">{article.hero.headline}</li>
          </ol>
        </nav>

        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-primary-400 font-semibold mb-2">
            {article.hero.eyebrow}
          </p>
          <h1 className="text-3xl font-bold text-gradient text-balance">{article.hero.headline}</h1>
          <p className="text-sm text-secondary mt-3 max-w-2xl">{article.hero.tagline}</p>
          {article.definedTerm && (
            <dl className="mt-4 max-w-2xl rounded-lg bg-[rgba(255,252,245,0.78)] p-4">
              <dt className="text-sm font-semibold text-surface-950">{article.definedTerm.term}</dt>
              <dd className="text-sm leading-relaxed text-[rgba(12,8,5,0.7)] mt-1">
                {article.definedTerm.definition}
              </dd>
            </dl>
          )}
        </header>

        <article>
          {article.sections.map((section) => (
            <section key={section.heading} className="surface-card p-6 mb-5">
              <h2 className="text-lg font-semibold text-surface-950 mb-3">{section.heading}</h2>
              {section.paragraphs.map((para) => (
                <p
                  key={para.slice(0, 32)}
                  className="text-sm leading-relaxed text-[rgba(12,8,5,0.7)] mb-3 last:mb-0"
                >
                  {para}
                </p>
              ))}
              {section.bullets && (
                <ul className="list-disc pl-5 space-y-1.5 text-sm leading-relaxed text-[rgba(12,8,5,0.7)] mt-2">
                  {section.bullets.map((b) => (
                    <li key={b.slice(0, 32)}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>

        {article.howTo && (
          <section className="surface-card p-6 mb-5">
            <h2 className="text-lg font-semibold text-surface-950 mb-3">{article.howTo.heading}</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed text-[rgba(12,8,5,0.7)]">
              {article.howTo.steps.map((step) => (
                <li key={step.slice(0, 32)}>{step}</li>
              ))}
            </ol>
          </section>
        )}

        <FaqSection
          heading="Frequently asked questions"
          faqs={article.faqs}
          className="surface-card p-6 mb-5"
        />

        {/* Tool CTA — the article→product link is the point of the hub. */}
        <section className="surface-card p-6 mb-5">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">Put it to work</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {article.toolLinks.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className="block p-3 rounded-lg bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.92)] transition-colors"
              >
                <p className="text-sm font-medium text-surface-950">{t.label} →</p>
                <p className="text-xs text-[rgba(12,8,5,0.72)] mt-1">{t.blurb}</p>
              </Link>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section className="surface-card p-6">
            <h2 className="text-lg font-semibold text-surface-950 mb-3">Keep learning</h2>
            <ul className="space-y-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/learn/${r.slug}`}
                    className="text-sm text-primary-300 hover:text-primary-400"
                  >
                    {r.hero.headline} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
