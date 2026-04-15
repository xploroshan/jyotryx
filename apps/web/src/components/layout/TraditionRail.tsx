'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
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
 * Tier-1 navigation: chunky frosted-glass pills, one per astrology
 * tradition. Swiggy-style horizontally scrollable row; active pill
 * lifts, glows saffron, and a shared layout underline animates between
 * buttons.
 *
 * "My Day" is the first pill — it's not a tradition but a cross-cutting
 * personalized summary, so it gets the most prominent placement.
 *
 * Pairs with `FeatureChips.tsx` below it (Tier-2).
 */
export default function TraditionRail() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, user, updatePrimaryTradition } = useAuthStore();
  const activeRef = useRef<HTMLElement | null>(null);

  const activeId: TraditionId = resolveActiveTradition({
    pathname,
    primaryTradition: user?.primaryTradition ?? null,
    astrologyTraditions: user?.astrologyTraditions,
  });
  const isMyDayActive = pathname.startsWith('/my-day');

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
  }, [activeId, isMyDayActive]);

  const handleSelect = (id: TraditionId, slug: string) => {
    updatePrimaryTradition(id);
    router.push(`/${slug}`);
    if (isAuthenticated) {
      api.put('/users/me', { primaryTradition: id }).catch(() => {});
    }
  };

  const pillShell =
    'meatball w-[84px] h-[68px] sm:w-[96px] sm:h-[72px] flex flex-col items-center justify-center gap-0.5';

  return (
    <div
      className="sticky top-14 z-40 bg-surface-950/70 backdrop-blur-xl border-b border-white/[0.06]"
      role="tablist"
      aria-label={(t as any).nav?.switchTradition ?? 'Switch tradition'}
    >
      <div className="mx-auto max-w-7xl px-4 overflow-x-auto no-scrollbar">
        <ul className="flex gap-5 sm:gap-7 lg:gap-9 py-4 justify-start lg:justify-center">
          {/* My Day — special first pill (cross-tradition personalized summary) */}
          <li className="flex flex-col items-center gap-2 shrink-0">
            <motion.div whileTap={{ scale: 0.94 }}>
              <Link
                ref={isMyDayActive ? (activeRef as any) : undefined}
                href="/my-day"
                role="tab"
                aria-selected={isMyDayActive}
                aria-label={t.nav.myDay}
                className={`${pillShell} ${isMyDayActive ? 'active' : ''}`}
              >
                <span
                  className="text-[24px] leading-none relative z-10"
                  style={{
                    filter: isMyDayActive
                      ? 'drop-shadow(0 2px 6px rgba(250, 204, 21, 0.45))'
                      : 'drop-shadow(0 1px 3px rgba(255,255,255,0.2))',
                  }}
                  aria-hidden
                >
                  ☀️
                </span>
                {isMyDayActive && (
                  <motion.span
                    layoutId="meatball-glow"
                    className="absolute inset-[-4px] rounded-[1.75rem] bg-gradient-to-br from-primary-500/30 via-accent-500/20 to-transparent blur-md -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
            <span
              className={`text-[11px] font-semibold tracking-wide transition-colors whitespace-nowrap ${
                isMyDayActive ? 'text-white' : 'text-white/60'
              }`}
            >
              {t.nav.myDay}
            </span>
          </li>

          {TRADITION_LIST.map((cfg) => {
            const isActive = !isMyDayActive && cfg.id === activeId;
            const label = readLabel(cfg.labelKey, cfg.slug);
            return (
              <li key={cfg.id} className="flex flex-col items-center gap-2 shrink-0">
                <motion.button
                  ref={isActive ? (activeRef as any) : undefined}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => handleSelect(cfg.id, cfg.slug)}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={label}
                  className={`${pillShell} ${isActive ? 'active' : ''}`}
                >
                  <span
                    className="text-[26px] leading-none relative z-10"
                    style={{
                      filter: isActive
                        ? 'drop-shadow(0 2px 6px rgba(250, 204, 21, 0.45))'
                        : 'drop-shadow(0 1px 3px rgba(255,255,255,0.2))',
                    }}
                    aria-hidden
                  >
                    {cfg.icon}
                  </span>
                  {isActive && (
                    <motion.span
                      layoutId="meatball-glow"
                      className="absolute inset-[-4px] rounded-[1.75rem] bg-gradient-to-br from-primary-500/30 via-accent-500/20 to-transparent blur-md -z-10"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.button>
                <span
                  className={`text-[11px] font-semibold tracking-wide transition-colors whitespace-nowrap ${
                    isActive ? 'text-white' : 'text-white/60'
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
