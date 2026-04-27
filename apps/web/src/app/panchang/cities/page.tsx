import type { Metadata } from 'next';
import Link from 'next/link';
import { SEO_CITIES } from '@/lib/seo/cities';
import { SITE_ORIGIN } from '@/lib/seo/server-api';

export const revalidate = 60 * 60 * 24 * 7; // weekly

export const metadata: Metadata = {
  title: `Today's Panchang by City — All ${SEO_CITIES.length} Cities | Jyotron`,
  description: `Today's Hindu calendar (tithi, nakshatra, sunrise, sunset, Rahu Kaal) for the top ${SEO_CITIES.length} Indian cities. Each panchang is calculated from the city's exact coordinates using Swiss Ephemeris.`,
  alternates: { canonical: `${SITE_ORIGIN}/panchang/cities` },
};

const STATE_ORDER: Record<string, number> = {};
SEO_CITIES.forEach((c, i) => {
  if (!(c.state in STATE_ORDER)) STATE_ORDER[c.state] = i;
});

export default function PanchangCitiesIndex() {
  // Group cities by state for a more scannable directory page; sorting
  // by population within each state keeps the most-searched cities at
  // the top of every regional cluster.
  const byState = new Map<string, typeof SEO_CITIES>();
  for (const city of SEO_CITIES) {
    if (!byState.has(city.state)) byState.set(city.state, []);
    byState.get(city.state)!.push(city);
  }
  for (const arr of byState.values()) {
    arr.sort((a, b) => b.population - a.population);
  }
  const states = Array.from(byState.keys()).sort(
    (a, b) => (STATE_ORDER[a] ?? 0) - (STATE_ORDER[b] ?? 0),
  );

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-surface-950" />
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 fade-in-up">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-white/40">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-white">Home</Link></li>
            <li>›</li>
            <li><Link href="/panchang" className="hover:text-white">Panchang</Link></li>
            <li>›</li>
            <li className="text-white/70">Cities</li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gradient">Today's Panchang by City</h1>
          <p className="text-sm text-white/60 mt-2 max-w-2xl">
            Tithi, nakshatra, sunrise, sunset and Rahu Kaal calculated from each city's exact
            coordinates using Swiss Ephemeris. All {SEO_CITIES.length} cities below.
          </p>
        </header>

        <div className="space-y-6">
          {states.map((state) => (
            <section key={state} className="surface-card p-5">
              <h2 className="text-base font-semibold text-white mb-3">{state}</h2>
              <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {byState.get(state)!.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/panchang/${c.slug}`}
                      className="block px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-sm text-white/80 hover:text-white transition-colors"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
