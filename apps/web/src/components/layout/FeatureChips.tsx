'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  WEB_TRADITIONS,
  resolveActiveTradition,
  type TraditionId,
} from '@/lib/traditions';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';
import { tapScale } from '@/lib/motion';

export default function FeatureChips() {
  const pathname = usePathname() ?? '/';
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const reduce = useReducedMotion();

  const activeId: TraditionId = resolveActiveTradition({
    pathname,
    primaryTradition: user?.primaryTradition ?? null,
    astrologyTraditions: user?.astrologyTraditions,
  });
  const cfg = WEB_TRADITIONS[activeId];
  if (pathname.startsWith('/my-day')) return null;

  const readLabel = (path: string, fallback: string): string => {
    const parts = path.split('.');
    let node: any = t;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) node = node[part];
      else return fallback;
    }
    return typeof node === 'string' ? node : fallback;
  };

  return (
    <div className="sticky top-[124px] z-30 bg-surface-950/60 backdrop-blur-xl border-b border-white/[0.03]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-2.5">
        <ul className="flex flex-wrap gap-1.5 sm:gap-2 justify-start lg:justify-center">
          {cfg.features.map((f) => {
            const isActive = pathname === f.href;
            const label = readLabel(f.labelKey, f.slug);

            const chipBase =
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] whitespace-nowrap transition-all duration-200 border';

            const chipState = isActive
              ? 'bg-white text-surface-950 border-white/90 font-medium shadow-[0_2px_12px_-2px_rgba(255,255,255,0.15)]'
              : 'text-white/50 border-transparent hover:text-white/80 hover:bg-white/[0.04]';

            const disabledChip =
              'text-white/20 border-transparent cursor-not-allowed';

            const body = (
              <>
                {f.icon && (
                  <span className="text-[13px] leading-none" aria-hidden>
                    {f.icon}
                  </span>
                )}
                <span>{label}</span>
              </>
            );

            if (!f.available) {
              return (
                <li key={f.slug}>
                  <span
                    className={`${chipBase} ${disabledChip}`}
                    aria-disabled="true"
                  >
                    {body}
                  </span>
                </li>
              );
            }
            return (
              <motion.li key={f.slug} whileTap={reduce ? undefined : tapScale}>
                <Link
                  href={f.href}
                  className={`${chipBase} ${chipState}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {body}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
