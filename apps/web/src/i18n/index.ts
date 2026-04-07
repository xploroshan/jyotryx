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

const translations: Record<Locale, TranslationKeys> = {
  en, hi, ta, te, bn, mr, gu, kn, ml, pa, or: or_, as: as_,
};

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
