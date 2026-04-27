import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  SEO_CITIES,
  findCityBySlug,
  listCitySlugs,
} from '@/lib/seo/cities';
import { SITE_ORIGIN } from '@/lib/seo/server-api';

/**
 * "Free Kundli for <city>" SEO landing page.
 *
 * The URL pattern targets the high-volume "free kundli {city}" query —
 * the page itself is a marketing/SEO surface (rich text + FAQ + JSON-LD)
 * that funnels into the existing /kundli generator with the city
 * pre-filled via `?place=`. This separation keeps the generator
 * uncomplicated for logged-in users while giving the SEO traffic a
 * crawlable, content-heavy target distinct from the interactive app.
 *
 * Static-generated for the top-50 city list with infrequent ISR (the
 * content here is evergreen — only the page boilerplate changes).
 */

// Evergreen content; weekly ISR is enough to pick up any KB tweaks.
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

  const title = `Free Kundli for ${city.name} — Vedic Birth Chart | Jyotron`;
  const description = `Generate your free, accurate Vedic Kundli (janma kundali) for ${city.name}. Computed from Swiss Ephemeris using ${city.name}'s exact coordinates and Lahiri ayanamsa — full rasi, navamsa, dasha, doshas, and yogas in seconds.`;
  const canonical = `${SITE_ORIGIN}/kundli/${city.slug}`;

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

export default async function KundliCityPage({ params }: RouteProps) {
  const { city: slug } = await params;
  const city = findCityBySlug(slug);
  if (!city) notFound();

  const ctaHref = `/kundli?place=${encodeURIComponent(city.name)}`;

  // FAQPage JSON-LD — Google still ranks city × service pages with FAQ
  // snippets for India/astrology even after the 2023 rich-result trim;
  // worst case the schema is silently dropped and the page reads fine
  // as plain HTML.
  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `Is the kundli for ${city.name} free on Jyotron?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes — generating a Vedic kundli (janma kundali) for ${city.name} is free for every signed-up user. The first chart costs no credits, and you can come back to view it any time without re-entering your details.`,
        },
      },
      {
        '@type': 'Question',
        name: `Why does Jyotron compute the kundli for ${city.name}'s exact coordinates?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The ascendant (lagna) and house cusps depend on the local horizon at your time of birth. Using ${city.name}'s exact latitude (${city.lat.toFixed(4)}) and longitude (${city.lng.toFixed(4)}) — instead of a national centroid — gives you the same accuracy a professional astrologer working in ${city.name} would.`,
        },
      },
      {
        '@type': 'Question',
        name: `Which ayanamsa does Jyotron use for ${city.name}?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Lahiri ayanamsa, the canonical sidereal zero point used by every standard Indian panchang and recognised by the Indian government's Calendar Reform Committee. All sidereal calculations — kundli, dasha, transits — use it consistently.`,
        },
      },
      {
        '@type': 'Question',
        name: 'What does the kundli include?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A full Vedic chart includes: rasi (D-1) chart, navamsa (D-9), Vimshottari dasha periods with sub-periods, planetary positions with degree/nakshatra, house lordships, key yogas, and dosha checks (Manglik, Kaal Sarp, Pitra, Nadi).',
        },
      },
      {
        '@type': 'Question',
        name: 'How accurate is the chart?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Charts are computed from Swiss Ephemeris, the same astronomical engine used by professional astrologers and academic researchers worldwide. Re-running the chart with the same inputs returns the same result byte-for-byte; nothing is randomised.',
        },
      },
    ],
  };
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN },
      { '@type': 'ListItem', position: 2, name: 'Kundli', item: `${SITE_ORIGIN}/kundli` },
      { '@type': 'ListItem', position: 3, name: 'Cities', item: `${SITE_ORIGIN}/kundli/cities` },
      { '@type': 'ListItem', position: 4, name: city.name, item: `${SITE_ORIGIN}/kundli/${city.slug}` },
    ],
  };

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-surface-950" />
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 fade-in-up">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
        />

        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-white/40">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-white">Home</Link></li>
            <li>›</li>
            <li><Link href="/kundli" className="hover:text-white">Kundli</Link></li>
            <li>›</li>
            <li><Link href="/kundli/cities" className="hover:text-white">Cities</Link></li>
            <li>›</li>
            <li className="text-white/70">{city.name}</li>
          </ol>
        </nav>

        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gradient">
            Free Kundli for {city.name}, {city.state}
          </h1>
          <p className="text-sm text-white/60 mt-2 max-w-2xl">
            Generate your full Vedic birth chart calculated from Swiss Ephemeris using{' '}
            {city.name}'s exact coordinates and Lahiri ayanamsa.
          </p>
        </header>

        {/* Primary CTA */}
        <section className="surface-card p-6 mb-6">
          <p className="text-sm text-white/70 mb-4">
            Enter your date of birth and time of birth — the place is already set to{' '}
            <span className="text-white font-medium">{city.name}</span>. You'll get your rasi
            chart, navamsa (D-9), dasha periods, planetary placements, and dosha analysis in
            seconds.
          </p>
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg btn-primary text-white text-sm font-medium"
          >
            Generate my kundli for {city.name} →
          </Link>
        </section>

        {/* SEO long-form */}
        <article className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            What you'll get in your {city.name} kundli
          </h2>
          <ul className="text-sm text-white/70 space-y-2 mb-5 list-disc pl-5">
            <li><strong>Rasi (D-1) chart</strong> — placement of the nine grahas across the twelve houses, drawn for your exact time and place of birth.</li>
            <li><strong>Navamsa (D-9) and divisional charts</strong> — the marriage and dharma chart used for compatibility, plus D-2, D-3, D-7, D-10 and other vargas through D-60.</li>
            <li><strong>Vimshottari dasha</strong> — Mahadasha and Antardasha periods with start and end dates so you know which planet is currently shaping your life.</li>
            <li><strong>Doshas</strong> — Manglik, Kaal Sarp, Pitra and Nadi dosha detection with severity, plus the classical remedies prescribed for each.</li>
            <li><strong>Yogas</strong> — Raja yogas, Dhana yogas, Pancha Mahapurusha and other classical combinations identified from your placements.</li>
            <li><strong>Sade Sati</strong> — your current Saturn-over-Moon phase (rising, peak, or setting) with phase-specific guidance.</li>
          </ul>

          <h2 className="text-lg font-semibold text-white mb-3">
            Why {city.name}'s coordinates matter
          </h2>
          <p className="text-sm text-white/70 leading-relaxed mb-3">
            The ascendant (<em>lagna</em>) — the rashi rising on the eastern horizon at your
            birth — depends on your geographic location. {city.name} sits at{' '}
            {Math.abs(city.lat).toFixed(2)}°{city.lat >= 0 ? 'N' : 'S'}, {Math.abs(city.lng).toFixed(2)}°{city.lng >= 0 ? 'E' : 'W'},
            so the rising sign at, say, 6:00 AM in {city.name} is different from the same time in
            Mumbai or Kolkata. National-average kundli generators ignore this and produce charts
            that can be a sign or two off. Jyotron uses {city.name}'s exact coordinates, so the
            lagna, house cusps and planetary house placements match what a professional
            astrologer working in {city.name} would draw by hand.
          </p>

          <h2 className="text-lg font-semibold text-white mb-3">
            How accurate is the calculation?
          </h2>
          <p className="text-sm text-white/70 leading-relaxed mb-3">
            Every chart on Jyotron is computed from <strong>Swiss Ephemeris</strong> — the same
            astronomical engine used by professional astrologers, academic researchers, and
            standard panchangs. We use the canonical <strong>Lahiri ayanamsa</strong> for
            sidereal positions (recognised by the Indian government's Calendar Reform Committee)
            and apply nutation, precession and aberration corrections automatically. Re-running a
            chart with the same inputs always returns identical results — nothing here is
            randomised or AI-generated.
          </p>

          <h2 className="text-lg font-semibold text-white mb-3">
            Frequently asked questions about the {city.name} kundli
          </h2>
          <dl className="space-y-4 text-sm">
            <Faq
              q={`Is my data shared with anyone in ${city.name}?`}
              a="No. Your birth details are stored privately to your account and used only to compute the chart. You can export or delete everything from your profile at any time, and we never share or sell user data."
            />
            <Faq
              q="What if I don't know my exact time of birth?"
              a="The Vedic chart is most accurate with a known time of birth. Without one, the rasi positions of the slow-moving planets are still correct, but the ascendant and house cusps cannot be calculated reliably. If you have only a hospital admission slip, use that — it's usually within a few minutes of the actual birth."
            />
            <Faq
              q={`Can I generate a kundli for someone else who was born in ${city.name}?`}
              a={`Yes — you can generate kundlis for as many people as you like. Most users start with their own and then add charts for partners, children and parents.`}
            />
          </dl>
        </article>

        {/* Cross-links */}
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            More astrology tools for {city.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href={`/panchang/${city.slug}`}
              className="block p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <p className="text-sm font-medium text-white">Today's Panchang for {city.name}</p>
              <p className="text-xs text-white/50 mt-1">Tithi, nakshatra, sunrise, Rahu Kaal.</p>
            </Link>
            <Link
              href="/matching"
              className="block p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
            >
              <p className="text-sm font-medium text-white">Kundli Matching (Ashtakoota)</p>
              <p className="text-xs text-white/50 mt-1">36-guna milan score and dosha check.</p>
            </Link>
          </div>
          <p className="text-xs text-white/40 mt-5">
            Born somewhere else?{' '}
            <Link href="/kundli/cities" className="text-primary-300 hover:text-primary-200">
              Browse all {SEO_CITIES.length} cities →
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="border-l-2 border-primary-500/30 pl-3">
      <dt className="font-medium text-white">{q}</dt>
      <dd className="text-white/70 mt-1 leading-relaxed">{a}</dd>
    </div>
  );
}
