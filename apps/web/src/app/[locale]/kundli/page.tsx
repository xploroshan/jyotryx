import type { Metadata } from 'next';
import { Suspense } from 'react';
import { isLocale } from '@/i18n/locales';
import { localizedMetadata } from '@/lib/seo/page-metadata';
import { FEATURE_PAGES } from '@/lib/seo/feature-pages';
import KundliClient from '@/app/kundli/KundliClient';

const PATH = '/kundli';

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
  // KundliClient reads useSearchParams → needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <KundliClient />
    </Suspense>
  );
}
