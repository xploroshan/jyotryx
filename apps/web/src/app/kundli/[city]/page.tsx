import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  SEO_CITIES,
  findCityBySlug,
  listCitySlugs,
  nearbyCities,
  contrastCities,
} from '@/lib/seo/cities';
import { fetchPanchang, SITE_ORIGIN } from '@/lib/seo/server-api';
import { jsonLdHtml, faqLd, breadcrumbLd } from '@/lib/seo/json-ld';

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
 * Statically generated for the top-50 city list with DAILY ISR: the page
 * embeds today's live panchang for the city (sunrise/tithi/nakshatra via
 * fetchPanchang — the same URL+revalidate the /panchang/[city] pages use,
 * so the data comes from Next's shared fetch cache at ~zero extra cost).
 * The live values are what make each city page genuinely unique instead of
 * a name-swapped template ("doorway page" pattern the SEO review flagged).
 */
// The param space is CLOSED (generateStaticParams enumerates every valid
// value), so reject everything else at the ROUTER with a real HTTP 404.
// Without this, notFound() thrown inside a streamed render (the root
// loading.tsx makes responses stream) can only inject a meta-noindex into an
// HTTP 200 — the "soft-404 at site scale" the SEO audit measured live.
export const dynamicParams = false;

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

  const title = `Free Kundli for ${city.name} — Vedic Birth Chart`;
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
      siteName: 'MyAstro360',
      images: [{ url: '/og', width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og'] },
  };
}

export default async function KundliCityPage({ params }: RouteProps) {
  const { city: slug } = await params;
  const city = findCityBySlug(slug);
  if (!city) notFound();

  const ctaHref = `/kundli?place=${encodeURIComponent(city.name)}`;

  // Today's live panchang for THIS city (shared fetch cache with
  // /panchang/[city]). Null-tolerant: on failure the section below is
  // omitted and the page renders exactly as before — never a regression.
  const panchang = await fetchPanchang(city.lat, city.lng);
  const todayDisplay = new Date().toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const neighbours = nearbyCities(city.slug, 4);
  const [contrastA, contrastB] = contrastCities(city.slug);

  // ONE faqs array feeds BOTH the visible FAQ <dl> below and the FAQPage
  // JSON-LD — they can no longer diverge (the audit found 5 schema questions
  // that never appeared on the page, a manual-action risk).
  const faqs = [
    {
      q: `Is the kundli for ${city.name} free on MyAstro360?`,
      a: `Yes — generating a Vedic kundli (janma kundali) for ${city.name} is free for every signed-up user. The first chart costs no credits, and you can come back to view it any time without re-entering your details.`,
    },
    {
      q: `Why does MyAstro360 compute the kundli for ${city.name}'s exact coordinates?`,
      a: `The ascendant (lagna) and house cusps depend on the local horizon at your time of birth. Using ${city.name}'s exact latitude (${city.lat.toFixed(4)}) and longitude (${city.lng.toFixed(4)}) — instead of a national centroid — gives you the same accuracy a professional astrologer working in ${city.name} would.`,
    },
    {
      q: `Which ayanamsa does MyAstro360 use for ${city.name}?`,
      a: `Lahiri ayanamsa, the canonical sidereal zero point used by every standard Indian panchang and recognised by the Indian government's Calendar Reform Committee. All sidereal calculations — kundli, dasha, transits — use it consistently.`,
    },
    {
      q: `What if I don't know my exact time of birth?`,
      a: `The Vedic chart is most accurate with a known time of birth. Without one, the rasi positions of the slow-moving planets are still correct, but the ascendant and house cusps cannot be calculated reliably. If you have only a hospital admission slip, use that — it's usually within a few minutes of the actual birth.`,
    },
    {
      q: `Is my data shared with anyone in ${city.name}?`,
      a: `No. Your birth details are stored privately to your account and used only to compute the chart. You can export or delete everything from your profile at any time, and we never share or sell user data.`,
    },
    {
      q: `Can I generate a kundli for someone else who was born in ${city.name}?`,
      a: `Yes — you can generate kundlis for as many people as you like. Most users start with their own and then add charts for partners, children and parents.`,
    },
  ];
  const jsonLdFaq = faqLd(faqs);
  const jsonLdBreadcrumb = breadcrumbLd([
    { name: 'Home', url: SITE_ORIGIN },
    { name: 'Kundli', url: `${SITE_ORIGIN}/kundli` },
    { name: 'Cities', url: `${SITE_ORIGIN}/kundli/cities` },
    { name: city.name, url: `${SITE_ORIGIN}/kundli/${city.slug}` },
  ]);

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 fade-in-up">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdFaq) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdBreadcrumb) }}
        />

        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[rgba(12,8,5,0.66)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-surface-950">Home</Link></li>
            <li>›</li>
            <li><Link href="/kundli" className="hover:text-surface-950">Kundli</Link></li>
            <li>›</li>
            <li><Link href="/kundli/cities" className="hover:text-surface-950">Cities</Link></li>
            <li>›</li>
            <li className="text-emphasis">{city.name}</li>
          </ol>
        </nav>

        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gradient">
            Free Kundli for {city.name}, {city.state}
          </h1>
          <p className="text-sm text-secondary mt-2 max-w-2xl">
            Generate your full Vedic birth chart calculated from Swiss Ephemeris using{' '}
            {city.name}'s exact coordinates and Lahiri ayanamsa.
          </p>
        </header>

        {/* Primary CTA */}
        <section className="surface-card p-6 mb-6">
          <p className="text-sm text-emphasis mb-4">
            Enter your date of birth and time of birth — the place is already set to{' '}
            <span className="text-surface-950 font-medium">{city.name}</span>. You'll get your rasi
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

        {/* Live per-city data — today's panchang snapshot. This is computed
            for the city's own coordinates, so it differs on every city page
            every day (real uniqueness, not template variation). */}
        {panchang && (
          <section className="surface-card p-6 mb-6">
            <h2 className="text-lg font-semibold text-surface-950 mb-1">
              Today in {city.name} — {todayDisplay}
            </h2>
            <p className="text-xs text-[rgba(12,8,5,0.66)] mb-4">
              Live panchang computed for {city.name}'s coordinates ({Math.abs(city.lat).toFixed(2)}°
              {city.lat >= 0 ? 'N' : 'S'}, {Math.abs(city.lng).toFixed(2)}°{city.lng >= 0 ? 'E' : 'W'}).
            </p>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm mb-4">
              <TodayStat label="Sunrise" value={panchang.sunrise} />
              <TodayStat label="Sunset" value={panchang.sunset} />
              <TodayStat label="Moonrise" value={panchang.moonrise} />
              <TodayStat label="Tithi" value={panchang.tithi} />
              <TodayStat label="Nakshatra" value={panchang.nakshatra} />
              <TodayStat label="Rahu Kaal" value={panchang.rahukaal} />
            </dl>
            <p className="text-xs text-emphasis leading-relaxed">
              Why this matters for your kundli: sunrise in {city.name} marks the start of the
              Vedic day and anchors the first lagna; the ascendant then advances roughly one sign
              every two hours at {city.name}'s longitude. A birth time read against the wrong
              city's sunrise can shift the lagna — which is exactly why your chart here is
              computed for {city.name}, not a national reference point.{' '}
              <Link href={`/panchang/${city.slug}`} className="text-primary-300 hover:text-primary-400">
                Full panchang for {city.name} →
              </Link>
            </p>
          </section>
        )}

        {/* SEO long-form */}
        <article className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">
            What you'll get in your {city.name} kundli
          </h2>
          <ul className="text-sm text-emphasis space-y-2 mb-5 list-disc pl-5">
            <li><strong>Rasi (D-1) chart</strong> — placement of the nine grahas across the twelve houses, drawn for your exact time and place of birth.</li>
            <li><strong>Navamsa (D-9) and divisional charts</strong> — the marriage and dharma chart used for compatibility, plus D-2, D-3, D-7, D-10 and other vargas through D-60.</li>
            <li><strong>Vimshottari dasha</strong> — Mahadasha and Antardasha periods with start and end dates so you know which planet is currently shaping your life.</li>
            <li><strong>Doshas</strong> — Manglik, Kaal Sarp, Pitra and Nadi dosha detection with severity, plus the classical remedies prescribed for each.</li>
            <li><strong>Yogas</strong> — Raja yogas, Dhana yogas, Pancha Mahapurusha and other classical combinations identified from your placements.</li>
            <li><strong>Sade Sati</strong> — your current Saturn-over-Moon phase (rising, peak, or setting) with phase-specific guidance.</li>
          </ul>

          <h2 className="text-lg font-semibold text-surface-950 mb-3">
            Why {city.name}'s coordinates matter
          </h2>
          <p className="text-sm text-emphasis leading-relaxed mb-3">
            The ascendant (<em>lagna</em>) — the rashi rising on the eastern horizon at your
            birth — depends on your geographic location. {city.name} sits at{' '}
            {Math.abs(city.lat).toFixed(2)}°{city.lat >= 0 ? 'N' : 'S'}, {Math.abs(city.lng).toFixed(2)}°{city.lng >= 0 ? 'E' : 'W'},
            so the rising sign at, say, 6:00 AM in {city.name} is different from the same moment in{' '}
            {contrastA.name} or {contrastB.name}. National-average kundli generators ignore this and produce charts
            that can be a sign or two off. MyAstro360 uses {city.name}'s exact coordinates, so the
            lagna, house cusps and planetary house placements match what a professional
            astrologer working in {city.name} would draw by hand.
          </p>

          <h2 className="text-lg font-semibold text-surface-950 mb-3">
            How accurate is the calculation?
          </h2>
          <p className="text-sm text-emphasis leading-relaxed mb-3">
            Every chart on MyAstro360 is computed from <strong>Swiss Ephemeris</strong> — the same
            astronomical engine used by professional astrologers, academic researchers, and
            standard panchangs. We use the canonical <strong>Lahiri ayanamsa</strong> for
            sidereal positions (recognised by the Indian government's Calendar Reform Committee)
            and apply nutation, precession and aberration corrections automatically. Re-running a
            chart with the same inputs always returns identical results — nothing here is
            randomised or AI-generated.
          </p>

          <h2 className="text-lg font-semibold text-surface-950 mb-3">
            Frequently asked questions about the {city.name} kundli
          </h2>
          <dl className="space-y-4 text-sm">
            {faqs.map((f) => (
              <Faq key={f.q} q={f.q} a={f.a} />
            ))}
          </dl>
        </article>

        {/* Cross-links */}
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">
            More astrology tools for {city.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href={`/panchang/${city.slug}`}
              className="block p-3 rounded-lg bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.92)] transition-colors"
            >
              <p className="text-sm font-medium text-surface-950">Today's Panchang for {city.name}</p>
              <p className="text-xs text-[rgba(12,8,5,0.72)] mt-1">Tithi, nakshatra, sunrise, Rahu Kaal.</p>
            </Link>
            <Link
              href="/matching"
              className="block p-3 rounded-lg bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.92)] transition-colors"
            >
              <p className="text-sm font-medium text-surface-950">Kundli Matching (Ashtakoota)</p>
              <p className="text-xs text-[rgba(12,8,5,0.72)] mt-1">36-guna milan score and dosha check.</p>
            </Link>
          </div>
          {neighbours.length > 0 && (
            <p className="text-xs text-[rgba(12,8,5,0.66)] mt-5">
              Kundli for nearby cities:{' '}
              {neighbours.map((n, i) => (
                <span key={n.slug}>
                  {i > 0 && ' · '}
                  <Link href={`/kundli/${n.slug}`} className="text-primary-300 hover:text-primary-400">
                    {n.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
          <p className="text-xs text-[rgba(12,8,5,0.66)] mt-3">
            Born somewhere else?{' '}
            <Link href="/kundli/cities" className="text-primary-300 hover:text-primary-300">
              Browse all {SEO_CITIES.length} cities →
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

function TodayStat({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[rgba(12,8,5,0.06)] pb-1.5">
      <dt className="text-xs uppercase tracking-wide text-[rgba(12,8,5,0.66)]">{label}</dt>
      <dd className="text-sm text-surface-950">{value === undefined || value === '' ? '—' : value}</dd>
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
