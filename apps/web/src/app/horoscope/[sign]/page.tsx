import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ZODIAC_SIGNS, findSignBySlug, listSignSlugs } from '@/lib/seo/zodiac';
import { fetchHoroscope, SITE_ORIGIN } from '@/lib/seo/server-api';
import { localeUrl } from '@/lib/seo/page-metadata';
import { LANDING_LOCALES } from '@/i18n/locales';
import { ZodiacGlyph } from '@/components/icons/astro';

/**
 * Server-rendered SEO landing page for "<sign> daily horoscope today".
 *
 * The existing /horoscope page is "use client" + reads i18n translations
 * from a hook, so it's not crawlable as separate per-sign URLs. This
 * route fills the SEO-shaped hole: 12 statically-generated pages, daily
 * ISR for the forecast text, full structured data, and a CTA back to
 * the interactive page.
 */

export function generateStaticParams() {
  return listSignSlugs().map((sign) => ({ sign }));
}

interface RouteProps {
  params: Promise<{ sign: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { sign: slug } = await params;
  const sign = findSignBySlug(slug);
  if (!sign) return {};

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const title = `${sign.name} Horoscope Today — ${today} | myastro360`;
  const description = `Today's ${sign.name} (${sign.symbol}) horoscope: love, career, health and lucky number. ${sign.name} is a ${sign.modality.toLowerCase()} ${sign.element.toLowerCase()} sign ruled by ${sign.rulingPlanet}, born between ${sign.dateRange}.`;
  const canonical = `${SITE_ORIGIN}/horoscope/${sign.slug}`;

  // Reciprocal hreflang for the locales this landing page is published in.
  const languages: Record<string, string> = {};
  for (const l of LANDING_LOCALES) languages[l] = localeUrl(l, `/horoscope/${sign.slug}`);
  languages['x-default'] = localeUrl('en', `/horoscope/${sign.slug}`);

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonical,
      siteName: 'myastro360',
      images: [{ url: '/og', width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og'] },
  };
}

export default async function HoroscopeSignPage({ params }: RouteProps) {
  const { sign: slug } = await params;
  const sign = findSignBySlug(slug);
  if (!sign) notFound();

  const horoscope = await fetchHoroscope(sign.slug, 'daily');
  const today = new Date();
  const todayDisplay = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const jsonLdArticle = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${sign.name} Horoscope — ${todayDisplay}`,
    datePublished: today.toISOString(),
    dateModified: today.toISOString(),
    author: { '@type': 'Organization', name: 'myastro360' },
    publisher: {
      '@type': 'Organization',
      name: 'myastro360',
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/favicon.svg` },
    },
    mainEntityOfPage: `${SITE_ORIGIN}/horoscope/${sign.slug}`,
    description:
      horoscope?.forecast?.slice(0, 200) ??
      `Daily ${sign.name} horoscope covering love, career, health and lucky numbers.`,
  };
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Horoscope', item: `${SITE_ORIGIN}/horoscope` },
      { '@type': 'ListItem', position: 3, name: sign.name, item: `${SITE_ORIGIN}/horoscope/${sign.slug}` },
    ],
  };

  // Single source of truth for the FAQ: rendered visibly below AND emitted
  // as FAQPage structured data, so the two never drift (Google requires the
  // schema content to be present on the page).
  const faqs: { q: string; a: string }[] = [
    {
      q: `What dates does the ${sign.name} zodiac sign cover?`,
      a: `${sign.name} (${sign.symbol}) covers birthdays between ${sign.dateRange}. This is the Western/tropical sun-sign range; in Vedic (sidereal) astrology the dates shift by roughly three weeks, which is why your Vedic moon sign can differ from your sun sign.`,
    },
    {
      q: `What element and ruling planet govern ${sign.name}?`,
      a: `${sign.name} is a ${sign.modality.toLowerCase()} ${sign.element.toLowerCase()} sign ruled by ${sign.rulingPlanet}. Its element shapes temperament, its modality describes how it acts, and its ruling planet colours its core motivations.`,
    },
    {
      q: `Is the sun sign horoscope enough, or do I need my full kundli?`,
      a: `A sun-sign horoscope is a broad daily snapshot for everyone born under ${sign.name}. For guidance specific to you, your Vedic kundli uses your exact date, time, and place of birth to calculate your moon sign (rashi) and ascendant (lagna), which matter more than the sun sign in Vedic astrology.`,
    },
    {
      q: `How often is the ${sign.name} horoscope updated?`,
      a: `The ${sign.name} forecast on this page is refreshed every day. Weekly, monthly, and yearly horoscopes are also available inside myastro360.`,
    },
  ];
  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 fade-in-up">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />

        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[rgba(12,8,5,0.46)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-surface-950">Home</Link></li>
            <li>›</li>
            <li><Link href="/horoscope" className="hover:text-surface-950">Horoscope</Link></li>
            <li>›</li>
            <li className="text-emphasis">{sign.name}</li>
          </ol>
        </nav>

        <header className="mb-6 flex items-start gap-4">
          <ZodiacGlyph sign={sign.slug} size={52} className="text-primary-700 shrink-0" />
          <div>
            <h1 className="text-3xl font-bold text-gradient">
              {sign.name} Horoscope Today
            </h1>
            <p className="text-sm text-[rgba(12,8,5,0.55)] mt-2">
              {todayDisplay} · {sign.dateRange} · Ruled by {sign.rulingPlanet}
            </p>
          </div>
        </header>

        {/* Period switcher — internal links to the weekly/monthly/yearly variants */}
        <nav aria-label="Horoscope period" className="mb-6 flex flex-wrap gap-2">
          <span
            aria-current="page"
            className="px-3 py-1.5 rounded-lg text-sm bg-primary-500/15 text-primary-300"
          >
            Daily
          </span>
          {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
            <Link
              key={p}
              href={`/horoscope/${sign.slug}/${p}`}
              className="px-3 py-1.5 rounded-lg text-sm bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.92)] text-emphasis transition-colors capitalize"
            >
              {p}
            </Link>
          ))}
        </nav>

        {/* Forecast */}
        <section className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">Today's forecast</h2>
          {horoscope ? (
            <>
              <p className="text-sm text-emphasis leading-relaxed mb-4">{horoscope.forecast}</p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {horoscope.lucky_color && (
                  <Stat label="Lucky colour" value={horoscope.lucky_color} />
                )}
                {horoscope.lucky_number !== undefined && (
                  <Stat label="Lucky number" value={String(horoscope.lucky_number)} />
                )}
                {horoscope.compatibility && (
                  <Stat label="Compatible with" value={horoscope.compatibility} />
                )}
              </dl>
            </>
          ) : (
            <p className="text-sm text-[rgba(12,8,5,0.55)]">
              Today's forecast is being prepared — please refresh in a moment.
            </p>
          )}
        </section>

        {/* Sign profile */}
        <article className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">About {sign.name}</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-5">
            <Stat label="Element"  value={sign.element} />
            <Stat label="Modality" value={sign.modality} />
            <Stat label="Ruler"    value={sign.rulingPlanet} />
            <Stat label="Dates"    value={sign.dateRange} />
          </dl>
          <p className="text-sm text-emphasis leading-relaxed mb-3">
            {sign.name} is a {sign.modality.toLowerCase()} {sign.element.toLowerCase()} sign
            ruled by {sign.rulingPlanet}. People born between {sign.dateRange} carry the
            archetypes of {sign.name} as their <em>sun sign</em>; in Vedic astrology your moon
            sign and ascendant matter even more, so a {sign.name} sun chart can pair with a very
            different moon (rashi) personality.
          </p>
          <p className="text-sm text-emphasis leading-relaxed">
            Want the full picture instead of just the sun sign?{' '}
            <Link href="/kundli" className="text-primary-300 hover:text-primary-300">
              Generate your free Vedic kundli →
            </Link>
          </p>
        </article>

        {/* FAQ — visible content mirrored by the FAQPage JSON-LD above */}
        <section className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">
            {sign.name} horoscope — frequently asked questions
          </h2>
          <dl className="space-y-4 text-sm">
            {faqs.map((f) => (
              <Faq key={f.q} q={f.q} a={f.a} />
            ))}
          </dl>
        </section>

        {/* All signs nav */}
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">Other zodiac signs</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {ZODIAC_SIGNS.map((s) => (
              <Link
                key={s.slug}
                href={`/horoscope/${s.slug}`}
                aria-current={s.slug === sign.slug ? 'page' : undefined}
                className={`flex flex-col items-center p-3 rounded-lg transition-colors ${
                  s.slug === sign.slug
                    ? 'bg-primary-500/15 text-primary-300'
                    : 'bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.92)] text-emphasis'
                }`}
              >
                <ZodiacGlyph sign={s.slug} size={24} />
                <span className="text-xs mt-1">{s.name}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[rgba(12,8,5,0.46)]">{label}</dt>
      <dd className="text-sm text-surface-950 mt-0.5">{value}</dd>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-l-2 border-primary-500/30 pl-3">
      <dt className="font-medium text-surface-950">{q}</dt>
      <dd className="text-emphasis mt-1 leading-relaxed">{a}</dd>
    </div>
  );
}
