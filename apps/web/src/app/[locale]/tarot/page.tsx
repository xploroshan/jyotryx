import type { Metadata } from 'next';
import { isLocale } from '@/i18n/locales';
import { localizedMetadata } from '@/lib/seo/page-metadata';
import { FEATURE_PAGES } from '@/lib/seo/feature-pages';
import TarotClient from '@/app/tarot/TarotClient';

const PATH = '/tarot';

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
  return <TarotClient />;
}
