import type { Metadata } from 'next';
import { isLocale } from '@/i18n/locales';
import { localizedMetadata } from '@/lib/seo/page-metadata';
import { FEATURE_PAGES } from '@/lib/seo/feature-pages';
import NumerologyClient from '@/app/numerology/NumerologyClient';

const PATH = '/numerology';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === 'en') return {};
  return localizedMetadata({ locale, path: PATH, ...FEATURE_PAGES[PATH] });
}

export default function Page() {
  return <NumerologyClient />;
}
