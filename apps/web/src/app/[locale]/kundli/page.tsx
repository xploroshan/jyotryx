import type { Metadata } from 'next';
import { Suspense } from 'react';
import { isLocale } from '@/i18n/locales';
import { getServerTranslations } from '@/i18n/server';
import { localizedFeatureMetadata } from '@/lib/seo/page-metadata';
import { getFeatureContent } from '@/lib/seo/feature-content';
import { FeatureSeoSection } from '@/components/seo/FeatureSeoSection';
import { LanguageLinkRow } from '@/components/seo/LanguageLinkRow';
import FeatureHeader from '@/components/editorial/FeatureHeader';
import { FeatureGlyph } from '@/components/icons';
import KundliClient from '@/app/kundli/KundliClient';

const PATH = '/kundli';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === 'en') return {};
  return localizedFeatureMetadata(locale, PATH);
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const content = getFeatureContent(locale, PATH);
  // Server-rendered H1 in the page's own language — KundliClient sits inside
  // a null-fallback Suspense (useSearchParams), so its markup is absent from
  // initial HTML. Using the same dictionary strings the client store renders
  // avoids any hydration flash.
  const t = isLocale(locale) ? await getServerTranslations(locale) : null;
  return (
    <>
      {t && (
        <FeatureHeader
          tint="amber"
          eyebrow={t.kundli.badge}
          eyebrowIcon={<FeatureGlyph slug="kundli" size={18} />}
          headline={`${t.kundli.title} {em}${t.kundli.titleHighlight}{/em}`}
          tagline={t.kundli.description}
        />
      )}
      {/*
        CLS guard, mirroring the root /kundli page: with a `null` fallback
        KundliClient contributed zero height on first paint and then expanded
        to the birth-details form on hydration, shoving FeatureSeoSection down
        (0.43 CLS on /hi/kundli). The fallback reserves the form's height
        (~743px at Lighthouse's 412px mobile width) — keep in sync with
        app/kundli/page.tsx if the form changes.
      */}
      <Suspense fallback={<div className="min-h-[743px]" aria-hidden />}>
        <KundliClient />
      </Suspense>
      <FeatureSeoSection content={content} />
      {isLocale(locale) && <LanguageLinkRow path={PATH} currentLocale={locale} />}
    </>
  );
}
