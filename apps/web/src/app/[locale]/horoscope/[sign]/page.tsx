import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ZODIAC_SIGNS, findSignBySlug, listSignSlugs } from '@/lib/seo/zodiac';
import { fetchHoroscope, SITE_ORIGIN } from '@/lib/seo/server-api';
import { jsonLdHtml, articleLd, faqLd } from '@/lib/seo/json-ld';
import { todayIST } from '@/lib/seo/dates';
import { localizedMetadata, localeUrl } from '@/lib/seo/page-metadata';
import { getServerTranslations } from '@/i18n/server';
import { en } from '@/i18n/en';
import { interpolate, buildFaqs } from '@/i18n/interpolate';
import {
  isLocale,
  type Locale,
  LANDING_LOCALES,
  PREBUILD_LANDING_LOCALES,
} from '@/i18n/locales';
import { LanguageLinkRow } from '@/components/seo/LanguageLinkRow';
import { ZodiacGlyph } from '@/components/icons/astro';

/**
 * Localized SEO landing page for "<sign> horoscope" (Phase 2, Tier B).
 *
 * Unlike the English route, the visible copy here is sourced entirely from
 * the existing human-translated locale dictionary + the API's locale-aware
 * forecast — NO machine-translated prose. The FAQ section is built from the
 * locale dictionary's `horoscopeLanding` templates (same source the English
 * route uses via en.ts), so the visible FAQs and the FAQPage JSON-LD stay in
 * the page's own language. Enabled for the LANDING_LOCALES only.
 */

export function generateStaticParams() {
  return PREBUILD_LANDING_LOCALES.flatMap((locale) =>
    listSignSlugs().map((sign) => ({ locale, sign })),
  );
}

interface RouteProps {
  params: Promise<{ locale: string; sign: string }>;
}

function landingLocale(locale: string): Locale | null {
  return isLocale(locale) && locale !== 'en' && LANDING_LOCALES.includes(locale)
    ? (locale as Locale)
    : null;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale: rawLocale, sign: slug } = await params;
  const locale = landingLocale(rawLocale);
  const sign = findSignBySlug(slug);
  if (!locale || !sign) return {};

  const t = await getServerTranslations(locale);
  const signName = (t.horoscope as Record<string, string>)[sign.slug] ?? sign.name;
  const horoscopeWord = t.horoscope.titleHighlight;

  return localizedMetadata({
    locale,
    path: `/horoscope/${sign.slug}`,
    title: `${signName} ${horoscopeWord}`,
    description: t.horoscope.description,
    hreflangLocales: LANDING_LOCALES,
  });
}

export default async function LocalizedHoroscopeSignPage({ params }: RouteProps) {
  const { locale: rawLocale, sign: slug } = await params;
  const locale = landingLocale(rawLocale);
  const sign = findSignBySlug(slug);
  if (!locale || !sign) notFound();

  const t = await getServerTranslations(locale);
  const h = t.horoscope as Record<string, string>;
  const signName = h[sign.slug] ?? sign.name;
  const elementLabel = h[sign.element.toLowerCase()] ?? sign.element;
  const horoscopeWord = t.horoscope.titleHighlight;

  const horoscope = await fetchHoroscope(sign.slug, 'daily', undefined, locale);

  const canonical = localeUrl(locale, `/horoscope/${sign.slug}`);
  const jsonLdArticle = articleLd({
    headline: `${signName} ${horoscopeWord}`,
    url: canonical,
    inLanguage: locale,
    datePublished: todayIST(),
  });
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'MyAstro360', item: localeUrl(locale, '/') },
      { '@type': 'ListItem', position: 2, name: `${signName} ${horoscopeWord}`, item: canonical },
    ],
  };

  // FAQ — single source for the visible section and the FAQPage JSON-LD,
  // built from the locale dictionary's templates. Entity tokens use localized
  // values where the dictionary has them (sign name, element) and fall back
  // to the English entity data otherwise (date range, modality, planet).
  // Until every locale dictionary carries horoscopeLanding.*, fall back to
  // the English templates at runtime (the i18n parity test tracks the gap).
  const landing = t.horoscopeLanding ?? en.horoscopeLanding;
  const faqTokens = {
    sign: signName,
    symbol: sign.symbol,
    dateRange: sign.dateRange,
    modality: sign.modality.toLowerCase(),
    element: elementLabel,
    rulingPlanet: sign.rulingPlanet,
  };
  const faqs = buildFaqs(landing.faqs, faqTokens);
  const jsonLdFaq = faqLd(faqs);

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 fade-in-up">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdArticle) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdBreadcrumb) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdFaq) }} />

        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[rgba(12,8,5,0.66)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={`/${locale}`} className="hover:text-surface-950">MyAstro360</Link></li>
            <li>›</li>
            <li className="text-emphasis">{signName} {horoscopeWord}</li>
          </ol>
        </nav>

        <header className="mb-6 flex items-start gap-4">
          <ZodiacGlyph sign={sign.slug} size={52} className="text-primary-700 shrink-0" />
          <div>
            <h1 className="text-3xl font-bold text-gradient">
              {signName} {horoscopeWord}
            </h1>
            <p className="mt-2 inline-block rounded-full bg-primary-500/15 px-3 py-1 text-xs text-primary-300">
              {elementLabel}
            </p>
          </div>
        </header>

        {/* Forecast — the substantive, API-localized content */}
        <section className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">{t.horoscope.overview}</h2>
          {horoscope?.forecast ? (
            <>
              <p className="text-sm text-emphasis leading-relaxed mb-4">{horoscope.forecast}</p>
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                {horoscope.lucky_color && <Stat label={t.horoscope.luckyColor} value={horoscope.lucky_color} />}
                {horoscope.lucky_number !== undefined && (
                  <Stat label={t.horoscope.luckyNumbers} value={String(horoscope.lucky_number)} />
                )}
              </dl>
            </>
          ) : (
            <p className="text-sm text-[rgba(12,8,5,0.72)]">{t.horoscope.retry}</p>
          )}
        </section>

        {/* FAQ — visible content mirrored by the FAQPage JSON-LD above */}
        <section className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">
            {interpolate(landing.faqHeading, faqTokens)}
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

        {/* All signs — localized names */}
        <section className="surface-card p-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {ZODIAC_SIGNS.map((s) => (
              <Link
                key={s.slug}
                href={`/${locale}/horoscope/${s.slug}`}
                aria-current={s.slug === sign.slug ? 'page' : undefined}
                className={`flex flex-col items-center p-3 rounded-lg transition-colors ${
                  s.slug === sign.slug
                    ? 'bg-primary-500/15 text-primary-300'
                    : 'bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.92)] text-emphasis'
                }`}
              >
                <ZodiacGlyph sign={s.slug} size={24} />
                <span className="text-xs mt-1">{h[s.slug] ?? s.name}</span>
              </Link>
            ))}
          </div>
        </section>

        <LanguageLinkRow path={`/horoscope/${sign.slug}`} currentLocale={locale} locales={LANDING_LOCALES} />
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
