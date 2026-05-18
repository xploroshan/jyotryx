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
import { TraditionGlyph } from '@/components/icons';

/* "My Day" sits outside the tradition registry, so it gets its own
   inline glyph rather than reusing VedicIcon. A simple sun reads
   universally as "today". */
function SunGlyph({ size = 15, active = false }: { size?: number; active?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 1.7 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 3.5v2.5M12 18v2.5M3.5 12H6M18 12h2.5M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M5.6 18.4l1.7-1.7M16.7 7.3l1.7-1.7" />
    </svg>
  );
}

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

  // Cream-glass rail. Active pill = orange brand fill; inactive sits
  // flat with a hairline border that lifts on hover. Same chrome on
  // every page, but only paints an "active" pill when the URL is
  // actually inside the matching tradition.
  const pillBase =
    'relative flex items-center gap-2 px-5 py-2 rounded-full text-[15px] font-medium transition-colors duration-300 focus-ring';
  const pillActive =
    'text-white shadow-[0_10px_28px_-10px_rgba(255,77,0,0.55)]';
  const pillInactive =
    'text-emphasis hover:bg-black/[0.05]';

  return (
    <div
      className="sticky top-16 z-40 glass border-b hairline"
      role="tablist"
      aria-label={(t as any).nav?.switchTradition ?? 'Switch tradition'}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 overflow-x-auto no-scrollbar">
        <ul className="flex gap-2.5 sm:gap-4 py-3 justify-start lg:justify-center">
          {/* My Day */}
          <li className="shrink-0">
            <motion.div whileTap={{ scale: 0.96 }}>
              <Link
                ref={isMyDayActive ? (activeRef as any) : undefined}
                href="/my-day"
                role="tab"
                aria-selected={isMyDayActive}
                aria-label={t.nav.myDay}
                className={`${pillBase} ${isMyDayActive ? pillActive : pillInactive}`}
              >
                {isMyDayActive && (
                  <motion.span
                    layoutId="tradition-indicator"
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-primary-500 -z-10"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <SunGlyph size={20} active={isMyDayActive} />
                <span className={isMyDayActive ? 'font-display font-semibold' : ''}>
                  {t.nav.myDay}
                </span>
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
                  className={`${pillBase} ${isActive ? pillActive : pillInactive}`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="tradition-indicator"
                      aria-hidden
                      className="absolute inset-0 rounded-full bg-primary-500 -z-10"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <TraditionGlyph id={cfg.id} size={20} />
                  <span className={isActive ? 'font-display font-semibold' : ''}>
                    {label}
                  </span>
                </motion.button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
