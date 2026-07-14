import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findSignBySlug, listSignSlugs } from '@/lib/seo/zodiac';
import { fetchHoroscope, SITE_ORIGIN } from '@/lib/seo/server-api';
import { jsonLdHtml, articleLd, faqLd } from '@/lib/seo/json-ld';
import { periodStartIST } from '@/lib/seo/dates';
import { localizedMetadata, localeUrl } from '@/lib/seo/page-metadata';
import { getServerTranslations } from '@/i18n/server';
import { en } from '@/i18n/en';
import { interpolate, buildFaqs } from '@/i18n/interpolate';
import { prefixedLandingLocale, LANDING_LOCALES, PREBUILD_LANDING_LOCALES } from '@/i18n/locales';
import { LanguageLinkRow } from '@/components/seo/LanguageLinkRow';
import { ZodiacGlyph } from '@/components/icons/astro';

/**
 * Localized weekly/monthly/yearly horoscope landing pages (Phase 2, Tier B).
 * Mirrors app/[locale]/horoscope/[sign] but for the longer periods. Visible
 * copy is dictionary-sourced (sign names, period labels) + the API's
 * locale-aware forecast — no machine-translated prose.
 */

type Period = 'weekly' | 'monthly' | 'yearly';
const PERIODS: Period[] = ['weekly', 'monthly', 'yearly'];
function isPeriod(v: string): v is Period {
  return v === 'weekly' || v === 'monthly' || v === 'yearly';
}

export function generateStaticParams() {
  return PREBUILD_LANDING_LOCALES.flatMap((locale) =>
    listSignSlugs().flatMap((sign) => PERIODS.map((period) => ({ locale, sign, period }))),
  );
}

interface RouteProps {
  params: Promise<{ locale: string; sign: string; period: string }>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { locale: rawLocale, sign: slug, period } = await params;
  const locale = prefixedLandingLocale(rawLocale);
  const sign = findSignBySlug(slug);
  if (!locale || !sign || !isPeriod(period)) return {};

  const t = await getServerTranslations(locale);
  const signName = (t.horoscope as Record<string, string>)[sign.slug] ?? sign.name;
  const periodLabel = t.horoscope[period];

  return localizedMetadata({
    locale,
    path: `/horoscope/${sign.slug}/${period}`,
    title: `${signName} ${periodLabel} ${t.horoscope.titleHighlight}`,
    description: t.horoscope.description,
    hreflangLocales: LANDING_LOCALES,
  });
}

export default async function LocalizedHoroscopePeriodPage({ params }: RouteProps) {
  const { locale: rawLocale, sign: slug, period } = await params;
  const locale = prefixedLandingLocale(rawLocale);
  const sign = findSignBySlug(slug);
  if (!locale || !sign || !isPeriod(period)) notFound();

  const t = await getServerTranslations(locale);
  const h = t.horoscope as Record<string, string>;
  const signName = h[sign.slug] ?? sign.name;
  const elementLabel = h[sign.element.toLowerCase()] ?? sign.element;
  const horoscopeWord = t.horoscope.titleHighlight;
  const periodLabel = t.horoscope[period];

  const horoscope = await fetchHoroscope(sign.slug, period, undefined, locale);
  const canonical = localeUrl(locale, `/horoscope/${sign.slug}/${period}`);

  const jsonLdArticle = articleLd({
    headline: `${signName} ${periodLabel} ${horoscopeWord}`,
    url: canonical,
    inLanguage: locale,
    datePublished: periodStartIST(period),
  });

  // FAQ — single source for the visible section and FAQPage JSON-LD, built
  // from the locale dictionary's periodFaqs templates (mirrors the daily
  // [sign] route). cadence/adjective use localized dictionary phrases so the
  // sentences never inject English into a non-English page.
  const landing = t.horoscopeLanding ?? en.horoscopeLanding;
  const cadenceMap = landing.periodCadence ?? en.horoscopeLanding.periodCadence;
  const adjectiveMap = landing.periodAdjective ?? en.horoscopeLanding.periodAdjective;
  const faqTokens = {
    sign: signName,
    period: periodLabel,
    cadence: (cadenceMap as Record<string, string>)[period],
    adjective: (adjectiveMap as Record<string, string>)[period],
  };
  const faqs = buildFaqs(landing.periodFaqs, faqTokens);
  const jsonLdFaq = faqLd(faqs);

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-10 fade-in-up">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdArticle) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLdFaq) }} />

        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[rgba(12,8,5,0.66)]">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={`/${locale}`} className="hover:text-surface-950">MyAstro360</Link></li>
            <li>›</li>
            <li><Link href={`/${locale}/horoscope/${sign.slug}`} className="hover:text-surface-950">{signName}</Link></li>
            <li>›</li>
            <li className="text-emphasis">{periodLabel}</li>
          </ol>
        </nav>

        <header className="mb-6 flex items-start gap-4">
          <ZodiacGlyph sign={sign.slug} size={52} className="text-primary-700 shrink-0" />
          <div>
            <h1 className="text-3xl font-bold text-gradient">
              {signName} {periodLabel} {horoscopeWord}
            </h1>
            <p className="mt-2 inline-block rounded-full bg-primary-500/15 px-3 py-1 text-xs text-primary-300">
              {elementLabel}
            </p>
          </div>
        </header>

        {/* Period switcher — daily + the three longer periods, all localized */}
        <nav aria-label="Period" className="mb-6 flex flex-wrap gap-2">
          <Link
            href={`/${locale}/horoscope/${sign.slug}`}
            className="px-3 py-1.5 rounded-lg text-sm bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.92)] text-emphasis transition-colors"
          >
            {t.horoscope.daily}
          </Link>
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/${locale}/horoscope/${sign.slug}/${p}`}
              aria-current={p === period ? 'page' : undefined}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                p === period
                  ? 'bg-primary-500/15 text-primary-300'
                  : 'bg-[rgba(255,252,245,0.78)] hover:bg-[rgba(255,252,245,0.92)] text-emphasis'
              }`}
            >
              {t.horoscope[p]}
            </Link>
          ))}
        </nav>

        <section className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">{t.horoscope.overview}</h2>
          {horoscope?.forecast ? (
            <p className="text-sm text-emphasis leading-relaxed">{horoscope.forecast}</p>
          ) : (
            <p className="text-sm text-[rgba(12,8,5,0.72)]">{t.horoscope.retry}</p>
          )}
        </section>

        {/* FAQ — visible content mirrored by the FAQPage JSON-LD above */}
        <section className="surface-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-3">
            {interpolate(landing.periodFaqHeading, faqTokens)}
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

        <LanguageLinkRow path={`/horoscope/${sign.slug}/${period}`} currentLocale={locale} locales={LANDING_LOCALES} />
      </div>
    </div>
  );
}
