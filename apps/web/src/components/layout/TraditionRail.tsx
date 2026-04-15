'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePathname, useRouter } from 'next/navigation';
import {
  TRADITION_LIST,
  resolveActiveTradition,
  type TraditionId,
} from '@/lib/traditions';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

/**
 * Tier-1 navigation: circular "meatball" buttons, one per astrology
 * tradition. Swiggy-style horizontally scrollable row; the active
 * tradition lifts, gets a saffron ring-glow, and a shared layout
 * underline animates between buttons.
 *
 * Pairs with `FeatureChips.tsx` below it (Tier-2).
 */
export default function TraditionRail() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, user, updatePrimaryTradition } = useAuthStore();
  const activeRef = useRef<HTMLButtonElement | null>(null);

  const activeId: TraditionId = resolveActiveTradition({
    pathname,
    primaryTradition: user?.primaryTradition ?? null,
    astrologyTraditions: user?.astrologyTraditions,
  });

  // Translate label from i18n path (e.g. "traditionsUi.vedic.name")
  const readLabel = (path: string, fallback: string): string => {
    const parts = path.split('.');
    let node: any = t;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) node = node[part];
      else return fallback;
    }
    return typeof node === 'string' ? node : fallback;
  };

  // Auto-scroll the active pill into view on mobile
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [activeId]);

  const handleSelect = (id: TraditionId, slug: string) => {
    updatePrimaryTradition(id);
    router.push(`/${slug}`);
    if (isAuthenticated) {
      api.put('/users/me', { primaryTradition: id }).catch(() => {});
    }
  };

  return (
    <div
      className="sticky top-14 z-40 bg-surface-950/70 backdrop-blur-xl border-b border-white/[0.06]"
      role="tablist"
      aria-label={(t as any).nav?.switchTradition ?? 'Switch tradition'}
    >
      <div className="mx-auto max-w-7xl px-4 overflow-x-auto no-scrollbar">
        <ul className="flex gap-6 sm:gap-8 lg:gap-10 py-4 justify-start lg:justify-center">
          {TRADITION_LIST.map((cfg) => {
            const isActive = cfg.id === activeId;
            const label = readLabel(cfg.labelKey, cfg.slug);
            return (
              <li key={cfg.id} className="flex flex-col items-center gap-2 shrink-0">
                <motion.button
                  ref={isActive ? activeRef : undefined}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handleSelect(cfg.id, cfg.slug)}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={label}
                  className={`meatball w-[72px] h-[60px] sm:w-20 sm:h-[64px] ${isActive ? 'active' : ''} ${
                    isActive
                      ? 'glass-strong ring-2 ring-primary-400/60 shadow-[0_10px_30px_-8px] shadow-primary-500/40'
                      : 'glass hover:ring-1 hover:ring-white/20'
                  }`}
                >
                  <span
                    className="text-[26px] leading-none"
                    style={{
                      filter: isActive
                        ? 'drop-shadow(0 2px 6px rgba(250, 204, 21, 0.45))'
                        : 'drop-shadow(0 1px 3px rgba(255,255,255,0.15))',
                    }}
                    aria-hidden
                  >
                    {cfg.icon}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="meatball-glow"
                      className="absolute inset-[-4px] rounded-[1.5rem] bg-gradient-to-br from-primary-500/30 via-accent-500/20 to-transparent blur-sm -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.button>
                <span
                  className={`text-[11px] font-medium tracking-wide transition-colors whitespace-nowrap ${
                    isActive ? 'text-white' : 'text-white/55'
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
