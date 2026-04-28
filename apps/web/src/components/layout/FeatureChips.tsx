'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  WEB_TRADITIONS,
  SLUG_TO_TRADITION,
  type TraditionId,
} from '@/lib/traditions';
import { useTranslation } from '@/i18n';
import { tapScale } from '@/lib/motion';

export default function FeatureChips() {
  const pathname = usePathname() ?? '/';
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  // Feature chips belong to a specific tradition's navigation. Only render
  // them when the URL is actually inside that tradition — otherwise (home,
  // /profile, /pricing, /reports, /kundli, /chat, …) they're noise that
  // misrepresents where the user is.
  const firstSegment = pathname.split('/').filter(Boolean)[0] ?? '';
  const activeId: TraditionId | null = SLUG_TO_TRADITION[firstSegment] ?? null;
  if (!activeId) return null;
  const cfg = WEB_TRADITIONS[activeId];

  const readLabel = (path: string, fallback: string): string => {
    const parts = path.split('.');
    let node: any = t;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) node = node[part];
      else return fallback;
    }
    return typeof node === 'string' ? node : fallback;
  };

  const chipBase =
    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-colors duration-200 border focus-ring';

  const chipActive =
    'bg-primary-500/12 text-primary-300 border-primary-500/45 font-medium';

  const chipIdle =
    'text-surface-50/55 border-white/[0.08] hover:text-surface-50 hover:border-white/[0.18] hover:bg-white/[0.04]';

  const chipDisabled =
    'text-surface-50/25 border-white/[0.04] cursor-not-allowed';

  return (
    <div className="sticky top-[120px] z-30 bg-surface-950/60 backdrop-blur-xl border-b border-white/[0.03]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-2.5 overflow-x-auto no-scrollbar">
        <ul
          className="flex flex-nowrap gap-1.5 sm:gap-2 justify-start lg:justify-center"
          role="tablist"
        >
          {cfg.features.map((f) => {
            const isActive = pathname === f.href;
            const label = readLabel(f.labelKey, f.slug);

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
                <li key={f.slug} className="shrink-0">
                  <span
                    className={`${chipBase} ${chipDisabled}`}
                    aria-disabled="true"
                  >
                    {body}
                  </span>
                </li>
              );
            }
            return (
              <motion.li
                key={f.slug}
                whileTap={reduce ? undefined : tapScale}
                className="shrink-0"
              >
                <Link
                  href={f.href}
                  className={`${chipBase} ${isActive ? chipActive : chipIdle}`}
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
