import { jsonLdHtml, faqLd } from "@/lib/seo/json-ld";

/**
 * Visible FAQ block + FAQPage JSON-LD from the SAME array — the single-source
 * pattern Google's guidelines require (schema content must be present on the
 * page). Extracted from FeatureSeoSection so /learn articles and any future
 * page reuse it instead of hand-rolling a divergent copy.
 *
 * Pure server component.
 */
export function FaqSection({
  heading,
  faqs,
  className = "surface-card p-6",
}: {
  heading: string;
  faqs: { q: string; a: string }[];
  className?: string;
}) {
  if (faqs.length === 0) return null;
  return (
    <div className={className}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd(faqs)) }}
      />
      <h2 className="text-lg font-semibold text-surface-950 mb-3">{heading}</h2>
      <dl className="divide-y divide-[rgba(12,8,5,0.08)]">
        {faqs.map((f) => (
          <div key={f.q} className="py-3 first:pt-0 last:pb-0">
            <dt className="text-sm font-medium text-surface-950 mb-1">{f.q}</dt>
            <dd className="text-sm leading-relaxed text-[rgba(12,8,5,0.7)]">{f.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
