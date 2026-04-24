'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  TRADITION_LIST,
  SLUG_TO_TRADITION,
  type TraditionId,
} from '@/lib/traditions';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { api } from '@/lib/api';

export default function TraditionRail() {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, user, updatePrimaryTradition } = useAuthStore();
  const activeRef = useRef<HTMLElement | null>(null);

  // A pill is only "active" when the URL actually lives inside that
  // tradition's section. Otherwise (home, /profile, /pricing, /kundli, …)
  // nothing is highlighted — the rail becomes pure navigation, not a false
  // indicator of where the user is. The user's saved primaryTradition still
  // drives the default destination when they tap a pill; we just don't
  // paint it as "currently here".
  const firstSegment = pathname.split('/').filter(Boolean)[0] ?? '';
  const activeId: TraditionId | null = SLUG_TO_TRADITION[firstSegment] ?? null;
  const isMyDayActive = pathname.startsWith('/my-day');

  const readLabel = (path: string, fallback: string): string => {
    const parts = path.split('.');
    let node: any = t;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) node = node[part];
      else return fallback;
    }
    return typeof node === 'string' ? node : fallback;
  };

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

  return (
    <div
      className="sticky top-16 z-40 bg-surface-950/70 backdrop-blur-2xl border-b border-white/[0.04]"
      role="tablist"
      aria-label={(t as any).nav?.switchTradition ?? 'Switch tradition'}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 overflow-x-auto no-scrollbar">
        <ul className="flex gap-2 sm:gap-3 py-3 justify-start lg:justify-center">
          {/* My Day */}
          <li className="shrink-0">
            <motion.div whileTap={{ scale: 0.96 }}>
              <Link
                ref={isMyDayActive ? (activeRef as any) : undefined}
                href="/my-day"
                role="tab"
                aria-selected={isMyDayActive}
                aria-label={t.nav.myDay}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 ${
                  isMyDayActive
                    ? 'bg-primary-500/15 text-white border border-primary-500/25'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  ☀️
                </span>
                <span>{t.nav.myDay}</span>
                {isMyDayActive && (
                  <motion.div
                    layoutId="tradition-indicator"
                    className="absolute inset-0 rounded-xl bg-primary-500/10 border border-primary-500/25 -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            </motion.div>
          </li>

          {TRADITION_LIST.map((cfg) => {
            const isActive = !isMyDayActive && cfg.id === activeId;
            const label = readLabel(cfg.labelKey, cfg.slug);
            return (
              <li key={cfg.id} className="shrink-0">
                <motion.button
                  ref={isActive ? (activeRef as any) : undefined}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => handleSelect(cfg.id, cfg.slug)}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={label}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-primary-500/15 text-white border border-primary-500/25'
                      : 'text-white/50 hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {cfg.icon}
                  </span>
                  <span>{label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="tradition-indicator"
                      className="absolute inset-0 rounded-xl bg-primary-500/10 border border-primary-500/25 -z-10"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </motion.button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
