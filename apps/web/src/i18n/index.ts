'use client';

import { createContext, useContext } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { en, type TranslationKeys } from './en';
import { hi } from './hi';

export type Locale = 'en' | 'hi';

const translations: Record<Locale, TranslationKeys> = { en, hi };

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale: Locale) => set({ locale }),
    }),
    { name: 'jyotron-locale' },
  ),
);

export function useTranslation(): { t: TranslationKeys; locale: Locale; setLocale: (l: Locale) => void } {
  const { locale, setLocale } = useI18nStore();
  return { t: translations[locale], locale, setLocale };
}

export { type TranslationKeys };
