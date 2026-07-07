'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation, type Locale } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import { LOCALE_LABELS, switchHref } from '@/lib/seo/locale-links';

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const pathname = usePathname() ?? '/';
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

  const current = LOCALE_LABELS.find((l) => l.code === locale) || LOCALE_LABELS[0];

  const itemClass = (code: Locale) =>
    `w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${
      locale === code
        ? 'text-primary-700 bg-primary-500/10 font-medium'
        : 'text-emphasis hover:text-surface-950 hover:bg-[rgba(255,252,245,0.86)]'
    }`;

  const check = (code: Locale) =>
    locale === code ? (
      <svg className="w-4 h-4 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ) : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border divider bg-[rgba(255,252,245,0.78)] text-xs font-medium text-secondary hover:text-emphasis transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.467.732-3.558" />
        </svg>
        {current.label}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {/* Always in the DOM (CSS-hidden when closed) so the locale anchors are
          present in server-rendered HTML — the switcher contributes crawlable
          links to the /<locale> tree instead of being invisible to crawlers. */}
      <div
        className={`absolute right-0 top-full mt-1.5 w-44 v2-surface py-1.5 z-50 max-h-80 overflow-y-auto shadow-xl shadow-black/10 ${
          open ? '' : 'hidden'
        }`}
      >
        {LOCALE_LABELS.map((l) => {
          // URL is the source of truth: when the current page has an
          // equivalent in l's tree, switching NAVIGATES there (so users get
          // localized SSR HTML + shareable localized URLs); the store write
          // rides along for persistence. Routes with no localized variant
          // (e.g. /reports) keep the old store-only behavior.
          const href = switchHref(l.code, pathname);
          return href !== null ? (
            <Link
              key={l.code}
              href={href}
              prefetch={false}
              onClick={() => handleSelect(l.code)}
              className={itemClass(l.code)}
            >
              <span>{l.native}</span>
              {check(l.code)}
            </Link>
          ) : (
            <button key={l.code} onClick={() => handleSelect(l.code)} className={itemClass(l.code)}>
              <span>{l.native}</span>
              {check(l.code)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
