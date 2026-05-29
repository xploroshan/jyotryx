import { en, type TranslationKeys } from './en';
import type { Locale } from './locales';

/**
 * Server-side translation loader.
 *
 * The locale dictionaries are plain data modules (no 'use client'), so they
 * import cleanly into Server Components and render translated HTML during
 * SSR/SSG — which is what the client store in ./index.ts cannot do
 * per-request. This mirrors that client loader map but runs on the server.
 */
const loaders: Record<Exclude<Locale, 'en'>, () => Promise<TranslationKeys>> = {
  hi: () => import('./hi').then((m) => m.hi),
  ta: () => import('./ta').then((m) => m.ta),
  te: () => import('./te').then((m) => m.te),
  bn: () => import('./bn').then((m) => m.bn),
  mr: () => import('./mr').then((m) => m.mr),
  gu: () => import('./gu').then((m) => m.gu),
  kn: () => import('./kn').then((m) => m.kn),
  ml: () => import('./ml').then((m) => m.ml),
  pa: () => import('./pa').then((m) => m.pa),
  or: () => import('./or').then((m) => m.or_),
  as: () => import('./as').then((m) => m.as_),
};

export async function getServerTranslations(locale: Locale): Promise<TranslationKeys> {
  if (locale === 'en') return en;
  try {
    return await loaders[locale]();
  } catch {
    return en;
  }
}
