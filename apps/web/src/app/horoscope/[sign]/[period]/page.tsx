import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ZODIAC_SIGNS, findSignBySlug, listSignSlugs } from '@/lib/seo/zodiac';
import { fetchHoroscope, SITE_ORIGIN } from '@/lib/seo/server-api';
import { jsonLdHtml } from '@/lib/seo/json-ld';
import { localeUrl } from '@/lib/seo/page-metadata';
import { LANDING_LOCALES } from '@/i18n/locales';
import { ZodiacGlyph } from '@/components/icons/astro';

/**
 * Server-rendered SEO landing pages for the longer horoscope periods —
 * "<sign> weekly/monthly/yearly horoscope". Daily lives at the parent
 * /horoscope/[sign] route; this sibling covers the three other periods,
 * which carry their own large search volume ("leo weekly horoscope",
 * "scorpio horoscope 2026").
 *
 * Content is real, not boilerplate: the forecast text is fetched per
 * period from the same API the interactive app uses, so each page has a
 * distinct, period-appropriate body rather than a thin variant.
 *
 * 12 signs × 3 periods = 36 statically-generated pages, listed in the
 * sitemap and ISR-refreshed on the period's natural cadence.
 */

type Period = 'weekly' | 'monthly' | 'yearly';

const PERIODS: Record<Period, { label: string; adjective: string; cadence: string }> = {
  weekly: { label: 'Weekly', adjective: 'this week', cadence: 'every week' },
  monthly: { label: 'Monthly', adjective: 'this month', cadence: 'every month' },
  yearly: { label: 'Yearly', adjective: 'this year', cadence: 'every year' },
};

function isPeriod(value: string): value is Period {
  return value === 'weekly' || value === 'monthly' || value === 'yearly';
}

export function generateStaticParams() {
  const periods: Period[] = ['weekly', 'monthly', 'yearly'];
  return listSignSlugs().flatMap((sign) => periods.map((period) => ({ sign, period })));
}

interface RouteProps {
  params: Promise<{ sign: string; period: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { sign: slug, period } = await params;
  const sign = findSignBySlug(slug);
  if (!sign || !isPeriod(period)) return {};

  const meta = PERIODS[period];
  const yearSuffix = period === 'yearly' ? ` ${new Date().getFullYear()}` : '';
  const title = `${sign.name} ${meta.label} Horoscope${yearSuffix} | myastro360`;
  const description = `${sign.name} (${sign.symbol}) ${meta.label.toLowerCase()} horoscope — love, career, money and health predictions for ${meta.adjective}. ${sign.name} is a ${sign.modality.toLowerCase()} ${sign.element.toLowerCase()} sign ruled by ${sign.rulingPlanet}.`;
  const canonical = `${SITE_ORIGIN}/horoscope/${sign.slug}/${period}`;

  const languages: Record<string, string> = {};
  for (const l of LANDING_LOCALES) languages[l] = localeUrl(l, `/horoscope/${sign.slug}/${period}`);
  languages['x-default'] = localeUrl('en', `/horoscope/${sign.slug}/${period}`);

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: { title, description, type: 'article', url: canonical, siteName: 'myastro360', images: [{ url: '/og', width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: ['/og'] },
  };
}

export default async function HoroscopePeriodPage({ params }: RouteProps) {
  const { sign: slug, period } = await params;
  const sign = findSignBySlug(slug);
  if (!sign || !isPeriod(period)) notFound();

  const meta = PERIODS[period];
  const horoscope = await fetchHoroscope(sign.slug, period);
  const today = new Date();

  const periodLinks: { key: string; label: string; href: string }[] = [
    { key: 'daily', label: 'Daily', href: `/horoscope/${sign.slug}` },
    { key: 'weekly', label: 'Weekly', href: `/horoscope/${sign.slug}/weekly` },
    { key: 'monthly', label: 'Monthly', href: `/horoscope/${sign.slug}/monthly` },
    { key: 'yearly', label: 'Yearly', href: `/horoscope/${sign.slug}/yearly` },
  ];

  const jsonLdArticle = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${sign.name} ${meta.label} Horoscope`,
    datePublished: today.toISOString(),
    dateModified: today.toISOString(),
    author: { '@type': 'Organization', name: 'myastro360' },
    publisher: {
      '@type': 'Organization',
      name: 'myastro360',
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/favicon.svg` },
    },
    mainEntityOfPage: `${SITE_ORIGIN}/horoscope/${sign.slug}/${period}`,
    description:
      horoscope?.forecast?.slice(0, 200) ??
      `${sign.name} ${meta.label.toLowerCase()} horoscope covering love, career, money and health.`,
  };
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Horoscope', item: `${SITE_ORIGIN}/horoscope` },
      { '@type': 'ListItem', position: 3, name: sign.name, item: `${SITE_ORIGIN}/horoscope/${sign.slug}` },
      {
        '@type': 'ListItem',
        position: 4,
        name: `${meta.label} Horoscope`,
        item: `${SITE_ORIGIN}/horoscope/${sign.slug}/${period}`,
      },
    ],
  };

  const faqs: { q: string; a: string }[] = [
    {
      q: `How often is the ${sign.name} ${meta.label.toLowerCase()} horoscope updated?`,
      a: `It refreshes ${meta.cadence}. You can also read ${sign.name}'s daily forecast and the other periods from the links at the top of this page.`,
    },
    {
      q: `Is the ${meta.label.toLowerCase()} horoscope based on the sun sign or moon sign?`,
      a: `This forecast is a general guide for everyone born under ${sign.name}. For predictions specific to you — based on your moon sign (rashi) and ascendant (lagna) — generate your free Vedic kundli with your exact date, time and place of birth.`,
    },
    {
      q: `What does the ${sign.name} ${meta.label.toLowerCase()} horoscope cover?`,
      a: `It looks at the major life areas for ${meta.adjective}: love and relationships, career and work, money and finances, and health and wellbeing.`,
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdArticle) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdBreadcrumb) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdFaq) }} />

        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[rgba(12,8,5,0.66)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-surface-950">Home</Link></li>
            <li>›</li>
            <li><Link href="/horoscope" className="hover:text-surface-950">Horoscope</Link></li>
            <li>›</li>
            <li><Link href={`/horoscope/${sign.slug}`} className="hover:text-surface-950">{sign.name}</Link></li>
            <li>›</li>
            <li className="text-emphasis">{meta.label}</li>
          </ol>
        </nav>

        <header className="mb-6 flex items-start gap-4">
          <ZodiacGlyph sign={sign.slug} size={52} className="text-primary-700 shrink-0" />
          <div>
            <h1 className="text-3xl font-bold text-gradient">
              {sign.name} {meta.label} Horoscope
            </h1>
            <p className="text-sm text-[rgba(12,8,5,0.72)] mt-2">
              {sign.dateRange} · Ruled by {sign.rulingPlanet}
            </p>
          </div>
        </header>

        {/* Period switcher */}
        <nav aria-label="Horoscope period" className="mb-6 flex flex-wrap gap-2">
          {periodLinks.map((p) => (
            <Link
              key={p.key}
              href={p.href}
              aria-current={p.key === period ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                p.key === period
                  ? 'bg-primary-500/15 text-primary-300'
                  : 'bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.92)] text-emphasis'
              }`}
            >
              {p.label}
            </Link>
          ))}
        </nav>

        {/* Forecast */}
        <section className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">
            {sign.name} forecast for {meta.adjective}
          </h2>
          {horoscope ? (
            <>
              <p className="text-sm text-emphasis leading-relaxed mb-4">{horoscope.forecast}</p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {horoscope.lucky_color && <Stat label="Lucky colour" value={horoscope.lucky_color} />}
                {horoscope.lucky_number !== undefined && (
                  <Stat label="Lucky number" value={String(horoscope.lucky_number)} />
                )}
                {horoscope.compatibility && <Stat label="Compatible with" value={horoscope.compatibility} />}
              </dl>
            </>
          ) : (
            <p className="text-sm text-[rgba(12,8,5,0.72)]">
              This forecast is being prepared — please refresh in a moment.
            </p>
          )}
        </section>

        {/* Sign profile */}
        <article className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">About {sign.name}</h2>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-5">
            <Stat label="Element" value={sign.element} />
            <Stat label="Modality" value={sign.modality} />
            <Stat label="Ruler" value={sign.rulingPlanet} />
            <Stat label="Dates" value={sign.dateRange} />
          </dl>
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
            {sign.name} {meta.label.toLowerCase()} horoscope — frequently asked questions
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
                href={`/horoscope/${s.slug}/${period}`}
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
      <dt className="text-xs uppercase tracking-wide text-[rgba(12,8,5,0.66)]">{label}</dt>
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
