import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  SEO_CITIES,
  findCityBySlug,
  listCitySlugs,
} from '@/lib/seo/cities';
import { fetchPanchang, SITE_ORIGIN } from '@/lib/seo/server-api';

/**
 * Server-rendered SEO landing page for "Panchang for <city>".
 *
 * Why a separate route from /panchang:
 *   • The existing /panchang is a "use client" component that geolocates
 *     the user and renders interactively. Search engines need crawlable,
 *     URL-distinct, rich-content variants per city — that's this route.
 *   • These pages are statically generated for the top-50 city list in
 *     `cities.ts` (sitemap-listed, link-juice from the directory page).
 *   • Daily ISR keeps the panchang current without rebuilding the
 *     entire web app every morning.
 *
 * The page is intentionally text-heavy and self-contained so that a
 * Google snippet rendered from the first 160 characters reads well,
 * and the long-form below provides the "value-add" signal that pure
 * dynamic pages don't carry.
 */

// Daily revalidate. Panchang changes once per local day; the API itself
// caches the underlying ephemeris computation, so a 24h ISR on the page
// is safe and keeps build time low.
// Pre-render every city in the directory at build time. Anything not in
// the list 404s rather than triggering on-demand SSG (keeps the URL
// surface tight + sitemap-aligned).

export function generateStaticParams() {
  return listCitySlugs().map((city) => ({ city }));
}

interface RouteProps {
  params: Promise<{ city: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { city: slug } = await params;
  const city = findCityBySlug(slug);
  if (!city) return {};

  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const title = `Panchang for ${city.name}, ${city.state} — ${today} | Jyotron`;
  const description = `Today's Hindu calendar (Panchang) for ${city.name}: tithi, nakshatra, yoga, karana, sunrise, sunset, Rahu Kaal, Gulika Kaal and Yamakantaka — calculated from Swiss Ephemeris for ${city.name}'s exact latitude and longitude.`;
  const canonical = `${SITE_ORIGIN}/panchang/${city.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'article',
      url: canonical,
      siteName: 'Jyotron',
    },
    twitter: { card: 'summary', title, description },
  };
}

export default async function PanchangCityPage({ params }: RouteProps) {
  const { city: slug } = await params;
  const city = findCityBySlug(slug);
  if (!city) notFound();

  const panchang = await fetchPanchang(city.lat, city.lng);
  const today = new Date();
  const todayDisplay = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // JSON-LD structured data — Article + BreadcrumbList. We deliberately
  // emit two separate scripts so that, if Google's parser silently
  // rejects one (schema.org keeps tightening their requirements), the
  // other still lands.
  const jsonLdArticle = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Panchang for ${city.name} — ${todayDisplay}`,
    datePublished: today.toISOString(),
    dateModified: today.toISOString(),
    author: { '@type': 'Organization', name: 'Jyotron' },
    publisher: {
      '@type': 'Organization',
      name: 'Jyotron',
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/favicon.svg` },
    },
    mainEntityOfPage: `${SITE_ORIGIN}/panchang/${city.slug}`,
    description: `Today's Hindu calendar details for ${city.name}, computed from Swiss Ephemeris.`,
    contentLocation: {
      '@type': 'Place',
      name: `${city.name}, ${city.state}, India`,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: city.lat,
        longitude: city.lng,
      },
    },
  };
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Panchang', item: `${SITE_ORIGIN}/panchang` },
      { '@type': 'ListItem', position: 3, name: 'Cities', item: `${SITE_ORIGIN}/panchang/cities` },
      { '@type': 'ListItem', position: 4, name: city.name, item: `${SITE_ORIGIN}/panchang/${city.slug}` },
    ],
  };

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-surface-950" />
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 fade-in-up">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
        />

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-white/40">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-white">Home</Link>
            </li>
            <li>›</li>
            <li>
              <Link href="/panchang" className="hover:text-white">Panchang</Link>
            </li>
            <li>›</li>
            <li>
              <Link href="/panchang/cities" className="hover:text-white">Cities</Link>
            </li>
            <li>›</li>
            <li className="text-white/70">{city.name}</li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gradient">
            Panchang for {city.name}, {city.state}
          </h1>
          <p className="text-sm text-white/50 mt-2">{todayDisplay}</p>
        </header>

        {panchang ? (
          <section className="surface-card p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Today's Panchang</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Row label="Tithi"          value={panchang.tithi} />
              <Row label="Nakshatra"      value={panchang.nakshatra} />
              <Row label="Yoga"           value={panchang.yoga} />
              <Row label="Karana"         value={panchang.karana} />
              <Row label="Vara (weekday)" value={panchang.vara} />
              <Row label="Sunrise"        value={panchang.sunrise} />
              <Row label="Sunset"         value={panchang.sunset} />
              <Row label="Moonrise"       value={panchang.moonrise} />
              <Row label="Rahu Kaal"      value={panchang.rahukaal}    tone="warning" />
              <Row label="Gulika Kaal"    value={panchang.gulikakaal}  tone="warning" />
              <Row label="Yamakantaka"    value={panchang.yamakantaka} tone="warning" />
            </dl>
            <p className="text-xs text-white/40 mt-4">
              Computed from Swiss Ephemeris using {city.name}'s coordinates ({city.lat.toFixed(4)},{' '}
              {city.lng.toFixed(4)}). Reload this page for tomorrow's panchang — it auto-refreshes
              once per day.
            </p>
          </section>
        ) : (
          <section className="surface-card p-6 mb-6 text-sm text-white/50">
            Panchang data is being calculated — please refresh in a moment.
          </section>
        )}

        {/* SEO long-form */}
        <article className="surface-card p-6 mb-6 prose-invert prose-sm max-w-none">
          <h2 className="text-lg font-semibold text-white mb-3">
            What is the Panchang and why does it matter for {city.name}?
          </h2>
          <p className="text-sm text-white/70 leading-relaxed mb-3">
            The Panchang is the traditional Hindu almanac that tracks five (
            <em>pancha-anga</em>, "five limbs") astronomical elements: <strong>tithi</strong> (lunar
            day), <strong>nakshatra</strong> (lunar mansion), <strong>yoga</strong>{' '}
            (sun-moon angular relation), <strong>karana</strong> (half-tithi), and{' '}
            <strong>vara</strong> (weekday). Every shubh muhurat — wedding date, griha-pravesh,
            vehicle purchase, naamkaran — is derived from these five.
          </p>
          <p className="text-sm text-white/70 leading-relaxed mb-3">
            Because tithi and nakshatra change at different times in different cities (the moon
            rises later in {city.name} than in cities further west), a national panchang can be off
            by hours. The values above are calculated for {city.name}'s exact latitude and
            longitude, so the sunrise, sunset, Rahu Kaal and Gulika Kaal you see are accurate to
            the minute.
          </p>
          <h3 className="text-base font-semibold text-white mt-5 mb-2">
            Inauspicious periods to avoid in {city.name}
          </h3>
          <p className="text-sm text-white/70 leading-relaxed mb-3">
            <strong>Rahu Kaal</strong>, <strong>Gulika Kaal</strong> and{' '}
            <strong>Yamakantaka</strong> are short windows traditionally avoided for new
            beginnings (signing contracts, starting a journey, beginning a yagya). Routine
            activities are unaffected; the conventional wisdom is to defer time-bound first acts
            outside these windows.
          </p>
          <h3 className="text-base font-semibold text-white mt-5 mb-2">
            How {city.name}'s panchang is computed
          </h3>
          <p className="text-sm text-white/70 leading-relaxed">
            Jyotron uses <strong>Swiss Ephemeris</strong> (the same astronomical engine used by
            professional astrologers and academic researchers) and the canonical{' '}
            <strong>Lahiri ayanamsa</strong> for sidereal calculations. Sunrise and sunset are
            geocoded for {city.name}'s coordinates rather than the Indian Standard Time meridian,
            so they reflect actual local horizon events.
          </p>
        </article>

        {/* Cross-links */}
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold text-white mb-3">More for {city.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href={`/kundli/${city.slug}`}
              className="block p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <p className="text-sm font-medium text-white">Free Kundli for {city.name}</p>
              <p className="text-xs text-white/50 mt-1">
                Full Vedic birth chart calculated from Swiss Ephemeris.
              </p>
            </Link>
            <Link
              href="/muhurat"
              className="block p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <p className="text-sm font-medium text-white">Find an auspicious muhurat</p>
              <p className="text-xs text-white/50 mt-1">
                Wedding, griha-pravesh, vehicle, name-giving.
              </p>
            </Link>
          </div>

          <p className="text-xs text-white/40 mt-5">
            Looking for another city?{' '}
            <Link href="/panchang/cities" className="text-primary-300 hover:text-primary-200">
              Browse all {SEO_CITIES.length} cities →
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string | number | undefined;
  tone?: 'default' | 'warning';
}) {
  const v = value === undefined || value === '' ? '—' : String(value);
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-1.5">
      <dt className="text-xs uppercase tracking-wide text-white/40">{label}</dt>
      <dd className={`text-sm ${tone === 'warning' ? 'text-amber-300' : 'text-white'}`}>{v}</dd>
    </div>
  );
}
