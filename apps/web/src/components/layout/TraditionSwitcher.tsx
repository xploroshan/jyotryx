'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  TRADITION_LIST,
  WEB_TRADITIONS,
  resolveActiveTradition,
  type TraditionId,
} from '@/lib/traditions';

/**
 * Dropdown used in the navbar to switch between astrology traditions.
 * Modeled on `LanguageSwitcher`.
 *
 * Behaviour:
 *   - Current tradition resolves to the URL path segment when a user is
 *     already inside a namespaced route (e.g. `/chinese/bazi`), otherwise
 *     falls back to `user.primaryTradition`, then to the first of their
 *     `astrologyTraditions`, then to `VEDIC`.
 *   - Selecting a tradition navigates to its dashboard
 *     (`/{slug}`, e.g. `/chinese`).
 *   - For signed-in users, selection persists to the backend so their
 *     default experience follows them on next login. The persistence is
 *     fire-and-forget — UI updates immediately.
 */
export default function TraditionSwitcher() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const { t } = useTranslation();
  const { user, isAuthenticated, updatePrimaryTradition } = useAuthStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeId: TraditionId = resolveActiveTradition({
    pathname,
    primaryTradition: user?.primaryTradition ?? null,
    astrologyTraditions: user?.astrologyTraditions,
  });
  const active = WEB_TRADITIONS[activeId];

  const handleSelect = (id: TraditionId) => {
    setOpen(false);
    const cfg = WEB_TRADITIONS[id];
    updatePrimaryTradition(id);
    router.push(`/${cfg.slug}`);
    if (isAuthenticated) {
      api.put('/users/me', { primaryTradition: id }).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const readLabel = (path: string): string => {
    // Walk the i18n key path (e.g. "traditionsUi.chinese.name"). On any
    // miss we fall back to the raw key so the UI still renders.
    const parts = path.split('.');
    let node: any = t;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) node = node[part];
      else return path;
    }
    return typeof node === 'string' ? node : path;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border divider bg-white/[0.03] text-xs font-medium text-white/70 hover:text-white transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={(t as any).nav?.switchTradition ?? 'Switch tradition'}
      >
        <span className="text-sm leading-none" aria-hidden>{active.icon}</span>
        <span>{readLabel(active.labelKey)}</span>
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border divider bg-surface-900 shadow-xl shadow-black/30 py-1.5 z-50"
          role="listbox"
        >
          {TRADITION_LIST.map((cfg) => (
            <button
              key={cfg.id}
              onClick={() => handleSelect(cfg.id)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors ${
                cfg.id === activeId
                  ? 'text-primary-400 bg-primary-600/10'
                  : 'text-white/70 hover:text-white hover:bg-white/[0.04]'
              }`}
              role="option"
              aria-selected={cfg.id === activeId}
            >
              <span className="text-base leading-none" aria-hidden>{cfg.icon}</span>
              <span className="flex-1">{readLabel(cfg.labelKey)}</span>
              {cfg.id === activeId && (
                <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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
