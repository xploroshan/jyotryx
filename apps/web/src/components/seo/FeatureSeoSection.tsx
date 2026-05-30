import type { FeatureContent } from "@/lib/seo/feature-content";

/**
 * Server-rendered SEO content block for the Tier-A feature pages
 * (/numerology, /tarot, …). Sits below the interactive widget and gives the
 * page real, crawlable prose — an explainer, a "how it works" list and an FAQ
 * — plus FAQPage structured data, so the URL stops reading as thin content to
 * search engines.
 *
 * Pure server component (no client JS). Pass the resolved `content` for the
 * page's locale; render nothing when there is none, so a localized page never
 * shows English copy (mixed-language hurts more than an absent section).
 */
export function FeatureSeoSection({ content }: { content: FeatureContent | null | undefined }) {
  if (!content) return null;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <section className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-4" aria-label={content.heading}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="surface-card p-6 mb-6">
        <h2 className="text-xl font-semibold text-surface-950 mb-3">{content.heading}</h2>
        {content.intro.map((para, i) => (
          <p key={i} className="text-sm leading-relaxed text-[rgba(12,8,5,0.7)] mb-3 last:mb-0">
            {para}
          </p>
        ))}
      </div>

      <div className="surface-card p-6 mb-6">
        <h2 className="text-lg font-semibold text-surface-950 mb-3">{content.howItWorks.heading}</h2>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm leading-relaxed text-[rgba(12,8,5,0.7)]">
          {content.howItWorks.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      <div className="surface-card p-6">
        <h2 className="text-lg font-semibold text-surface-950 mb-3">{content.faqHeading}</h2>
        <dl className="divide-y divide-[rgba(12,8,5,0.08)]">
          {content.faqs.map((f, i) => (
            <div key={i} className="py-3 first:pt-0 last:pb-0">
              <dt className="text-sm font-medium text-surface-950 mb-1">{f.q}</dt>
              <dd className="text-sm leading-relaxed text-[rgba(12,8,5,0.7)]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
