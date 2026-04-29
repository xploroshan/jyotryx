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

  // Feature chips render as an underlined tab strip beneath the tradition
  // pills, so the visual hierarchy reads tradition (filled pill) → feature
  // (underline tab) instead of two competing rows of pills.
  const tabBase =
    'relative flex items-center gap-1.5 py-2.5 text-[13px] whitespace-nowrap transition-colors duration-200 focus-ring';

  return (
    <div className="sticky top-[120px] z-30 bg-surface-50/85 backdrop-blur-xl border-b border-surface-900/[0.06]">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 overflow-x-auto no-scrollbar">
        <ul
          className="flex flex-nowrap gap-5 sm:gap-7 justify-start lg:justify-center"
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

            const tabState = isActive
              ? 'text-surface-900 font-semibold'
              : 'text-surface-900/55 hover:text-surface-900';

            if (!f.available) {
              return (
                <li key={f.slug} className="shrink-0">
                  <span
                    className={`${tabBase} text-surface-900/25 cursor-not-allowed`}
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
                  className={`${tabBase} ${tabState}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {body}
                  {isActive && (
                    <motion.span
                      layoutId="feature-underline"
                      aria-hidden
                      className="absolute left-0 right-0 -bottom-[1px] h-[2px] rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, #ff4d00 0%, #ffb627 100%)',
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
