'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  WEB_TRADITIONS,
  resolveActiveTradition,
  type TraditionId,
} from '@/lib/traditions';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/lib/store';

/**
 * Tier-2 navigation: wrapping rail of icon + label chips showing every
 * feature for the currently-active tradition. Chips wrap onto multiple
 * rows instead of horizontally scrolling, so the user sees everything
 * at a glance (Vedic has 14 items and was overflowing before).
 *
 * Pulls the feature list from `WEB_TRADITIONS[active].features` — adding
 * a new feature to the registry is a one-line change.
 */
export default function FeatureChips() {
  const pathname = usePathname() ?? '/';
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const activeId: TraditionId = resolveActiveTradition({
    pathname,
    primaryTradition: user?.primaryTradition ?? null,
    astrologyTraditions: user?.astrologyTraditions,
  });
  const cfg = WEB_TRADITIONS[activeId];
  // Don't render on /my-day — My Day is standalone, no Vedic chips below.
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
    <div className="sticky top-[176px] z-30 bg-surface-950/60 backdrop-blur-md border-b border-white/[0.04]">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <ul className="flex flex-wrap gap-2 sm:gap-2.5 justify-start lg:justify-center">
          {cfg.features.map((f) => {
            const isActive = pathname === f.href;
            const label = readLabel(f.labelKey, f.slug);
            const chipBase =
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] whitespace-nowrap transition-all border';
            const chipState = isActive
              ? 'bg-white text-surface-950 border-white shadow-[0_4px_14px_-2px] shadow-white/20'
              : 'glass text-white/75 border-white/[0.08] hover:text-white hover:border-white/25 hover:-translate-y-0.5';
            const body = (
              <>
                {f.icon && (
                  <span
                    className="text-[14px] leading-none"
                    style={{
                      filter: isActive
                        ? 'none'
                        : 'drop-shadow(0 1px 2px rgba(255,255,255,0.25))',
                    }}
                    aria-hidden
                  >
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
                    className={`${chipBase} glass text-white/40 border-white/[0.06] cursor-not-allowed`}
                    aria-disabled="true"
                  >
                    {body}
                  </span>
                </li>
              );
            }
            return (
              <li key={f.slug}>
                <Link
                  href={f.href}
                  className={`${chipBase} ${chipState}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {body}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
