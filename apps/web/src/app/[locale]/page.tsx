import type { Metadata } from 'next';
import { isLocale } from '@/i18n/locales';
import { localizedFeatureMetadata } from '@/lib/seo/page-metadata';
import { LanguageLinkRow } from '@/components/seo/LanguageLinkRow';
import HomeClient from '@/app/HomeClient';

const PATH = '/';

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
  return (
    <>
      <HomeClient />
      {isLocale(locale) && <LanguageLinkRow path={PATH} currentLocale={locale} />}
    </>
  );
}
