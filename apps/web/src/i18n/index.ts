'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { en, type TranslationKeys } from './en';
import { hi } from './hi';
import { ta } from './ta';
import { te } from './te';
import { bn } from './bn';
import { mr } from './mr';
import { gu } from './gu';
import { kn } from './kn';
import { ml } from './ml';
import { pa } from './pa';
import { or_ } from './or';
import { as_ } from './as';

export type Locale = 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr' | 'gu' | 'kn' | 'ml' | 'pa' | 'or' | 'as';

export const SUPPORTED_LOCALES: Locale[] = [
  'en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as',
];

const translations: Record<Locale, TranslationKeys> = {
  en, hi, ta, te, bn, mr, gu, kn, ml, pa, or: or_, as: as_,
};

/**
 * Detects the user's preferred locale from the browser.
 *
 * Reads `navigator.language` (and `navigator.languages`) and maps the primary
 * subtag to a supported Indian-language locale. Falls back to English if no
 * match is found or if running on the server.
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
  /** True once the user has explicitly chosen a locale (persists across reloads). */
  userSet: boolean;
  setLocale: (locale: Locale, opts?: { userSet?: boolean }) => void;
  /** Reset to system default (used on logout). */
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
      // On rehydrate, if the user never explicitly set a locale, re-detect from
      // the current browser language so that a new user on the same device sees
      // their system language on first visit.
      onRehydrateStorage: () => (state) => {
        if (state && !state.userSet) {
          const sys = detectSystemLocale();
          if (state.locale !== sys) state.locale = sys;
        }
      },
    },
  ),
);

export function useTranslation(): {
  t: TranslationKeys;
  locale: Locale;
  setLocale: (l: Locale, opts?: { userSet?: boolean }) => void;
  resetLocale: () => void;
} {
  const { locale, setLocale, resetLocale } = useI18nStore();
  return { t: translations[locale], locale, setLocale, resetLocale };
}

export { type TranslationKeys };
