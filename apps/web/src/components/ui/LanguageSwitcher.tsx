'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation, type Locale } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

const locales: { code: Locale; label: string; native: string }[] = [
  { code: 'en', label: 'EN', native: 'English' },
  { code: 'hi', label: 'हि', native: 'हिन्दी' },
  { code: 'ta', label: 'த', native: 'தமிழ்' },
  { code: 'te', label: 'తె', native: 'తెలుగు' },
  { code: 'bn', label: 'বা', native: 'বাংলা' },
  { code: 'mr', label: 'म', native: 'मराठी' },
  { code: 'gu', label: 'ગુ', native: 'ગુજરાતી' },
  { code: 'kn', label: 'ಕ', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'മ', native: 'മലയാളം' },
  { code: 'pa', label: 'ਪੰ', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'ଓ', native: 'ଓଡ଼ିଆ' },
  { code: 'as', label: 'অ', native: 'অসমীয়া' },
];

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /**
   * Applies the chosen locale to the i18n store (marking it as a user-set
   * choice so it survives rehydration) and, when the user is authenticated,
   * persists the choice to the backend so it's restored on next login.
   */
  const handleSelect = (code: Locale) => {
    setLocale(code, { userSet: true });
    setOpen(false);
    if (isAuthenticated) {
      // Fire-and-forget — UI updates immediately; server sync is best-effort.
      api.put('/users/me', { preferredLanguage: code }).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = locales.find((l) => l.code === locale) || locales[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border divider bg-surface-900/[0.03] text-xs font-medium text-surface-900/60 hover:text-surface-900/80 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.467.732-3.558" />
        </svg>
        {current.label}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border divider bg-surface-100 shadow-xl shadow-black/30 py-1.5 z-50 max-h-80 overflow-y-auto">
          {locales.map((l) => (
            <button
              key={l.code}
              onClick={() => handleSelect(l.code)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
                locale === l.code
                  ? 'text-primary-600 bg-primary-600/10'
                  : 'text-surface-900/60 hover:text-surface-900 hover:bg-surface-900/[0.04]'
              }`}
            >
              <span>{l.native}</span>
              {locale === l.code && (
                <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
