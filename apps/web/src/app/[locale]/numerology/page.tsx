import type { Metadata } from 'next';
import { isLocale } from '@/i18n/locales';
import { localizedFeatureMetadata } from '@/lib/seo/page-metadata';
import NumerologyClient from '@/app/numerology/NumerologyClient';

const PATH = '/numerology';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === 'en') return {};
  return localizedFeatureMetadata(locale, PATH);
}

export default function Page() {
  return <NumerologyClient />;
}
