'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { TranslationKeys } from './en';
import type { Locale } from './locales';

interface I18nContextValue {
  locale: Locale;
  t: TranslationKeys;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Supplies server-loaded translations to client components rendered under a
 * `/[locale]` route. `useTranslation()` prefers this context when present,
 * so the correct language is in the SSR HTML (the client zustand store can't
 * be seeded per-request safely). Routes WITHOUT this provider — the existing
 * English root routes — fall back to the store, unchanged.
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: TranslationKeys;
  children: ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, t: messages }}>{children}</I18nContext.Provider>
  );
}

export function useI18nContext(): I18nContextValue | null {
  return useContext(I18nContext);
}
