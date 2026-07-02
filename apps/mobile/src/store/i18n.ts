/**
 * Locale store — mirrors web's `useI18nStore`. Detects the device locale via
 * expo-localization, persists the user's choice via MMKV, and falls back to
 * English. The full 12-language translation corpus is imported from
 * @myastro360/shared once the web i18n objects are migrated there (plan §9);
 * for now this tracks the selected locale so screens can wire `t.*`.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getLocales } from 'expo-localization';
import { SUPPORTED_LOCALES, type Locale } from '@myastro360/shared';
import { zustandMMKVStorage } from '@/lib/mmkv';

export function detectDeviceLocale(): Locale {
  try {
    for (const l of getLocales()) {
      const primary = l.languageCode?.toLowerCase();
      if (primary && (SUPPORTED_LOCALES as readonly string[]).includes(primary)) {
        return primary as Locale;
      }
    }
  } catch {
    // expo-localization's native module is unavailable (unit tests / SSR).
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
      locale: detectDeviceLocale(),
      userSet: false,
      setLocale: (locale, opts) => set({ locale, userSet: opts?.userSet !== false }),
      resetLocale: () => set({ locale: detectDeviceLocale(), userSet: false }),
    }),
    {
      name: 'myastro360-locale',
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
