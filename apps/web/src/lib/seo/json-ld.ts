import { SITE_ORIGIN } from './server-api';

/**
 * Serialize a value to a JSON-LD string that is safe to embed inside a
 * <script type="application/ld+json"> via dangerouslySetInnerHTML.
 *
 * JSON.stringify does not escape `<`, `>`, `&`, or the U+2028/U+2029 line
 * separators, so raw or model-generated values could break out of the
 * <script> element (e.g. a `</script>` inside an LLM-written forecast) and
 * execute as markup. Escaping them to their \uXXXX forms keeps the JSON
 * valid while making `</script>` / HTML-comment breakout impossible.
 */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}


/**
 * Shared schema.org builders. Every page previously hand-built its JSON-LD
 * inline, which is how the audit's structured-data drift happened (favicon
 * as publisher logo, render-time datePublished churn, FAQ markup diverging
 * from the visible FAQ). Building through these keeps the Organization
 * entity, logo and date semantics identical everywhere.
 */

export const ORG_ID = `${SITE_ORIGIN}/#organization`;

/**
 * The canonical Organization node (root layout). `sameAs` entries are the
 * owner's real profiles \u2014 add them here as they exist; an empty list is
 * valid and better than fabricated links.
 */
export function organizationLd(opts: { sameAs?: string[] } = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'MyAstro360',
    url: SITE_ORIGIN,
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_ORIGIN}/logo.svg`,
    },
    ...(opts.sameAs && opts.sameAs.length > 0 ? { sameAs: opts.sameAs } : {}),
  };
}

/** Compact Organization reference for author/publisher fields. */
export function orgRef() {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'MyAstro360',
    logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/logo.svg` },
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MyAstro360',
    url: SITE_ORIGIN,
    publisher: { '@id': ORG_ID },
  };
}

export function breadcrumbLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function articleLd(opts: {
  headline: string;
  description?: string;
  url: string;
  /** Stable period-start date (see dates.ts) \u2014 NOT render time. */
  datePublished: Date;
  dateModified?: Date;
  inLanguage?: string;
  /** Absolute image URL; defaults to the /og card. */
  image?: string;
  contentLocation?: { name: string; latitude: number; longitude: number };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    ...(opts.description ? { description: opts.description } : {}),
    ...(opts.inLanguage ? { inLanguage: opts.inLanguage } : {}),
    datePublished: opts.datePublished.toISOString(),
    dateModified: (opts.dateModified ?? opts.datePublished).toISOString(),
    author: orgRef(),
    publisher: orgRef(),
    mainEntityOfPage: opts.url,
    image: [opts.image ?? `${SITE_ORIGIN}/og`],
    ...(opts.contentLocation
      ? {
          contentLocation: {
            '@type': 'Place',
            name: opts.contentLocation.name,
            geo: {
              '@type': 'GeoCoordinates',
              latitude: opts.contentLocation.latitude,
              longitude: opts.contentLocation.longitude,
            },
          },
        }
      : {}),
  };
}

/**
 * FAQPage from the SAME array the page renders visibly \u2014 pass the rendered
 * list, never a parallel copy (Google requires schema content to be present
 * on the page).
 */
export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/**
 * Glossary entry for a /learn article. Every DefinedTerm points at the same
 * DefinedTermSet (the /learn hub) so the glossary reads as one entity.
 */
export function definedTermLd(opts: { name: string; description: string; url: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      '@id': `${SITE_ORIGIN}/learn#glossary`,
      name: 'MyAstro360 Vedic astrology glossary',
      url: `${SITE_ORIGIN}/learn`,
    },
  };
}

/**
 * HowTo from the SAME steps the page renders visibly — pass the rendered
 * list, never a parallel copy.
 */
export function howToLd(opts: {
  name: string;
  description?: string;
  url: string;
  steps: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: opts.name,
    ...(opts.description ? { description: opts.description } : {}),
    url: opts.url,
    step: opts.steps.map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text,
    })),
  };
}

/** Service node for a product/tool page, provided by the canonical Org. */
export function serviceLd(opts: {
  name: string;
  serviceType: string;
  description: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: opts.name,
    serviceType: opts.serviceType,
    description: opts.description,
    url: opts.url,
    provider: orgRef(),
    areaServed: ['India', 'Indian diaspora worldwide'],
  };
}

export function itemListLd(name: string, items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: it.url,
    })),
  };
}
