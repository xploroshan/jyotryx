import type { Metadata } from 'next';
import { isLocale } from '@/i18n/locales';
import { localizedFeatureMetadata } from '@/lib/seo/page-metadata';
import { getFeatureContent } from '@/lib/seo/feature-content';
import { FeatureSeoSection } from '@/components/seo/FeatureSeoSection';
import { LanguageLinkRow } from '@/components/seo/LanguageLinkRow';
import VastuClient from '@/app/vastu/VastuClient';

const PATH = '/vastu';

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
  return (
    <>
      <VastuClient />
      <FeatureSeoSection content={content} />
      {isLocale(locale) && <LanguageLinkRow path={PATH} currentLocale={locale} />}
    </>
  );
}
