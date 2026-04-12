'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useState, useEffect } from 'react';

// English is always statically loaded (type source + instant fallback)
import { en, type TranslationKeys } from './en';

export type Locale = 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr' | 'gu' | 'kn' | 'ml' | 'pa' | 'or' | 'as';

export const SUPPORTED_LOCALES: Locale[] = [
  'en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as',
];

// Dynamic locale loaders — each non-English locale is loaded on demand
const localeLoaders: Record<string, () => Promise<TranslationKeys>> = {
  hi: () => import('./hi').then(m => m.hi),
  ta: () => import('./ta').then(m => m.ta),
  te: () => import('./te').then(m => m.te),
  bn: () => import('./bn').then(m => m.bn),
  mr: () => import('./mr').then(m => m.mr),
  gu: () => import('./gu').then(m => m.gu),
  kn: () => import('./kn').then(m => m.kn),
  ml: () => import('./ml').then(m => m.ml),
  pa: () => import('./pa').then(m => m.pa),
  or: () => import('./or').then(m => m.or_),
  as: () => import('./as').then(m => m.as_),
};

// In-memory cache for loaded locale translations
const loadedLocales = new Map<Locale, TranslationKeys>();
loadedLocales.set('en', en);

async function loadLocale(locale: Locale): Promise<TranslationKeys> {
  const cached = loadedLocales.get(locale);
  if (cached) return cached;

  const loader = localeLoaders[locale];
  if (!loader) return en;

  try {
    const translations = await loader();
    loadedLocales.set(locale, translations);
    return translations;
  } catch {
    return en; // Fallback to English on load failure
  }
}

/**
 * Detects the user's preferred locale from the browser.
 */
export function detectSystemLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const candidates: string[] = [];
  if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
  if (navigator.language) candidates.push(navigator.language);
  for (const raw of candidates) {
    const primary = raw.toLowerCase().split(/[-_]/)[0];
    if ((SUPPORTED_LOCALES as string[]).includes(primary)) {
      return primary as Locale;
    }
  }
  return 'en';
}

interface I18nState {
  locale: Locale;
  userSet: boolean;
  setLocale: (locale: Locale, opts?: { userSet?: boolean }) => void;
  resetLocale: () => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: detectSystemLocale(),
      userSet: false,
      setLocale: (locale: Locale, opts?: { userSet?: boolean }) =>
        set({ locale, userSet: opts?.userSet !== false }),
      resetLocale: () => set({ locale: detectSystemLocale(), userSet: false }),
    }),
    {
      name: 'jyotron-locale',
      onRehydrateStorage: () => (state) => {
        if (state && !state.userSet) {
          const sys = detectSystemLocale();
          if (state.locale !== sys) state.locale = sys;
        }
      },
    },
  ),
);

/**
 * Hook that provides translations for the current locale.
 * English is always available instantly; other locales load async.
 */
export function useTranslation(): {
  t: TranslationKeys;
  locale: Locale;
  setLocale: (l: Locale, opts?: { userSet?: boolean }) => void;
  resetLocale: () => void;
} {
  const { locale, setLocale, resetLocale } = useI18nStore();
  const [t, setT] = useState<TranslationKeys>(loadedLocales.get(locale) ?? en);

  useEffect(() => {
    let cancelled = false;
    loadLocale(locale).then((loaded) => {
      if (!cancelled) setT(loaded);
    });
    return () => { cancelled = true; };
  }, [locale]);

  return { t, locale, setLocale, resetLocale };
}

export { type TranslationKeys };
