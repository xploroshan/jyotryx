import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SEO_CITIES, findCityBySlug } from '@/lib/seo/cities';
import { fetchPanchang, SITE_ORIGIN } from '@/lib/seo/server-api';
import { jsonLdHtml, articleLd, faqLd } from '@/lib/seo/json-ld';
import { todayIST } from '@/lib/seo/dates';
import { localizedMetadata, localeUrl } from '@/lib/seo/page-metadata';
import { getServerTranslations } from '@/i18n/server';
import { prefixedPanchangLocale, PANCHANG_LOCALES, PREBUILD_PANCHANG_LOCALES } from '@/i18n/locales';
import { LanguageLinkRow } from '@/components/seo/LanguageLinkRow';
import { PANCHANG_CITY_CONTENT_LOCALE, interpolateCity } from '@/lib/seo/panchang-city-content';

/**
 * Localized daily Panchang landing page per city (Phase 2, Tier B).
 *
 * Panchang is data-driven: the values come from the API's locale-aware
 * endpoint (translated tithi/nakshatra/etc.), the field labels from the
 * human-translated dictionary, and the city name from the city's localized
 * `i18n` entry. No machine-translated prose.
 */

// Prebuild only the high-volume locale(s); the rest of PANCHANG_LOCALES are
// generated on demand via ISR (dynamicParams stays default-true) so the build
// doesn't fan out to 6 × 50 locale-aware panchang fetches. All locales remain
// crawlable and sitemap-listed.
export function generateStaticParams() {
  return PREBUILD_PANCHANG_LOCALES.flatMap((locale) =>
    SEO_CITIES.map((city) => ({ locale, city: city.slug })),
  );
}

interface RouteProps {
  params: Promise<{ locale: string; city: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale: rawLocale, city: slug } = await params;
  const locale = prefixedPanchangLocale(rawLocale);
  const city = findCityBySlug(slug);
  if (!locale || !city) return {};

  const t = await getServerTranslations(locale);
  const cityName = (city.i18n as Record<string, string>)[locale] ?? city.name;

  return localizedMetadata({
    locale,
    path: `/panchang/${city.slug}`,
    title: `${cityName} ${t.panchang.titleHighlight}`,
    description: t.panchang.description,
    hreflangLocales: PANCHANG_LOCALES,
  });
}

export default async function LocalizedPanchangCityPage({ params }: RouteProps) {
  const { locale: rawLocale, city: slug } = await params;
  const locale = prefixedPanchangLocale(rawLocale);
  const city = findCityBySlug(slug);
  if (!locale || !city) notFound();

  const t = await getServerTranslations(locale);
  const p = t.panchang;
  const cityName = (city.i18n as Record<string, string>)[locale] ?? city.name;
  const panchang = await fetchPanchang(city.lat, city.lng, undefined, locale);
  // Translated long-form template (per-locale, {city}-interpolated). Locales
  // without a translation render the data table only — and stay out of the
  // sitemap until their template lands (see panchang-city-content.ts).
  const content = PANCHANG_CITY_CONTENT_LOCALE[locale];
  const faqs = content ? interpolateCity(content.faqs, cityName) : null;
  const canonical = localeUrl(locale, `/panchang/${city.slug}`);

  const jsonLdArticle = articleLd({
    headline: `${cityName} ${p.titleHighlight}`,
    url: canonical,
    inLanguage: locale,
    datePublished: todayIST(),
    contentLocation: { name: `${city.name}, ${city.state}, India`, latitude: city.lat, longitude: city.lng },
  });

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 fade-in-up">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdArticle) }} />

        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[rgba(12,8,5,0.66)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={`/${locale}`} className="hover:text-surface-950">MyAstro360</Link></li>
            <li>›</li>
            <li className="text-emphasis">{cityName} {p.titleHighlight}</li>
          </ol>
        </nav>

        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gradient">{cityName} {p.titleHighlight}</h1>
        </header>

        {panchang ? (
          <section className="surface-card p-6 mb-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Row label={p.tithi} value={panchang.tithi} />
              <Row label={p.nakshatraLabel} value={panchang.nakshatra} />
              <Row label={p.yoga} value={panchang.yoga} />
              <Row label={p.karana} value={panchang.karana} />
              <Row label={p.vara} value={panchang.vara} />
              <Row label={p.sunrise} value={panchang.sunrise} />
              <Row label={p.sunset} value={panchang.sunset} />
              <Row label={p.moonrise} value={panchang.moonrise} />
              <Row label={p.rahuKaal} value={panchang.rahukaal} tone="warning" />
              <Row label={p.gulikaKaal} value={panchang.gulikakaal} tone="warning" />
              <Row label={p.yamakantaka} value={panchang.yamakantaka} tone="warning" />
            </dl>
          </section>
        ) : (
          <section className="surface-card p-6 mb-6">
            <p className="text-sm text-[rgba(12,8,5,0.72)]">{p.retry}</p>
          </section>
        )}

        {content && faqs && (
          <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd(faqs)) }} />
            <article className="surface-card p-6 mb-6">
              {interpolateCity(content.intro, cityName).map((para) => (
                <p key={para.slice(0, 24)} className="text-sm text-emphasis leading-relaxed mb-3">{para}</p>
              ))}
              <h2 className="text-base font-semibold text-surface-950 mt-5 mb-2">
                {content.inauspiciousHeading}
              </h2>
              <p className="text-sm text-emphasis leading-relaxed mb-3">{content.inauspiciousBody}</p>
              <h2 className="text-base font-semibold text-surface-950 mt-5 mb-2">
                {interpolateCity(content.computedHeading, cityName)}
              </h2>
              <p className="text-sm text-emphasis leading-relaxed">
                {interpolateCity(content.computedBody, cityName)}
              </p>
            </article>
            <section className="surface-card p-6 mb-6">
              <h2 className="text-lg font-semibold text-surface-950 mb-3">
                {interpolateCity(content.faqHeading, cityName)}
              </h2>
              <dl className="space-y-4 text-sm">
                {faqs.map((f) => (
                  <div key={f.q} className="border-l-2 border-primary-500/30 pl-3">
                    <dt className="font-medium text-surface-950">{f.q}</dt>
                    <dd className="text-emphasis mt-1 leading-relaxed">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}

        <LanguageLinkRow path={`/panchang/${city.slug}`} currentLocale={locale} locales={PANCHANG_LOCALES} />
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[rgba(12,8,5,0.06)] pb-2">
      <dt className="text-[rgba(12,8,5,0.66)]">{label}</dt>
      <dd className={tone === 'warning' ? 'text-amber-600 font-medium' : 'text-surface-950 font-medium'}>
        {value}
      </dd>
    </div>
  );
}
