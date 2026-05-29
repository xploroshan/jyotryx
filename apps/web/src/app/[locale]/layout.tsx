import { notFound } from 'next/navigation';
import { isLocale, PREFIXED_LOCALES } from '@/i18n/locales';
import { getServerTranslations } from '@/i18n/server';
import { I18nProvider } from '@/i18n/I18nProvider';

/**
 * Localized route segment. English lives at the root (no prefix); this
 * segment serves the other 11 languages at `/<locale>/…`. Because Next
 * prioritises static routes over a dynamic segment, the existing root
 * routes (e.g. `/numerology`) are untouched — only `/hi/numerology` etc.
 * resolve here.
 *
 * The locale's dictionary is loaded on the SERVER and handed to the client
 * tree via I18nProvider, so `useTranslation()` renders the right language
 * in the SSR HTML.
 */
export function generateStaticParams() {
  return PREFIXED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  // English is served at the root, not under a prefix; anything that isn't a
  // supported non-default locale is a 404 here.
  if (!isLocale(locale) || locale === 'en') notFound();

  const messages = await getServerTranslations(locale);

  return (
    <I18nProvider locale={locale} messages={messages}>
      {children}
    </I18nProvider>
  );
}
