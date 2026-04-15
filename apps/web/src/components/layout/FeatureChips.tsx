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
 * Tier-2 navigation: horizontal chips listing the features of the
 * currently-active tradition. Pulls the feature list from
 * `WEB_TRADITIONS[active].features` — zero-config when a new tradition
 * or feature is added to the registry.
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
    <div className="sticky top-[166px] z-30 bg-surface-950/60 backdrop-blur-md border-b border-white/[0.04]">
      <div className="mx-auto max-w-7xl px-4 overflow-x-auto no-scrollbar">
        <ul className="flex gap-2 py-2.5">
          {cfg.features.map((f) => {
            const isActive = pathname === f.href;
            const label = readLabel(f.labelKey, f.slug);
            const chipClass = isActive
              ? 'bg-white text-surface-950 shadow-[0_4px_14px_-2px] shadow-white/20'
              : 'glass text-white/70 hover:text-white';
            if (!f.available) {
              return (
                <li key={f.slug}>
                  <span className="glass text-white/40 px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap cursor-not-allowed">
                    {label}
                  </span>
                </li>
              );
            }
            return (
              <li key={f.slug}>
                <Link
                  href={f.href}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] whitespace-nowrap transition ${chipClass}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
