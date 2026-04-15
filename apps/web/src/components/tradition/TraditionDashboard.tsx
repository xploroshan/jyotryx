'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';

/**
 * Shared aggregator used by every per-tradition dashboard page
 * (`/vedic`, `/chinese`, `/western`, `/hellenistic`, `/horary`, `/medical`).
 *
 * Renders a coloured hero + a grid of feature tiles pulled from the
 * tradition registry. The tradition-specific flavour (palette, icon,
 * feature list, tagline) comes from `WEB_TRADITIONS[traditionId]`, so
 * each page is a one-line `<TraditionDashboard traditionId="…" />`.
 */
export default function TraditionDashboard({ traditionId }: { traditionId: TraditionId }) {
  const { t } = useTranslation();
  const cfg = WEB_TRADITIONS[traditionId];

  const readLabel = (path: string, fallback?: string): string => {
    const parts = path.split('.');
    let node: any = t;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) node = node[part];
      else return fallback ?? path;
    }
    return typeof node === 'string' ? node : (fallback ?? path);
  };

  const name = readLabel(cfg.labelKey, cfg.slug);
  const tagline = readLabel(cfg.taglineKey, '');
  const exploreCta = readLabel('traditionsUi.heroCta', 'Explore features');

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 pt-20">
      {/* Hero */}
      <section
        className={`rounded-3xl bg-gradient-to-br ${cfg.heroClass} ring-1 px-6 sm:px-10 py-10 mb-8`}
      >
        <div className="flex items-start sm:items-center gap-4">
          <span className="text-5xl sm:text-6xl leading-none" aria-hidden>
            {cfg.icon}
          </span>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              {name}
            </h1>
            {tagline && (
              <p className="mt-2 text-sm sm:text-base text-white/70 max-w-2xl">{tagline}</p>
            )}
          </div>
        </div>
      </section>

      {/* Feature tiles */}
      <section>
        <h2 className="text-xs uppercase tracking-wider text-white/50 font-medium mb-4">
          {exploreCta}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cfg.features.map((f) => {
            const label = readLabel(f.labelKey, f.slug);
            const tile = (
              <div
                className={`surface-card p-5 rounded-2xl h-full flex flex-col justify-between transition-all ${
                  f.available
                    ? 'hover:ring-white/20 hover:-translate-y-0.5'
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-white">{label}</h3>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.badgeClass}`}
                  >
                    {name}
                  </span>
                </div>
                {!f.available && (
                  <p className="mt-3 text-xs text-white/50">
                    {readLabel('traditionsUi.comingSoon', 'Coming soon')}
                  </p>
                )}
              </div>
            );
            if (!f.available) {
              return (
                <div key={f.slug} aria-disabled="true">
                  {tile}
                </div>
              );
            }
            return (
              <Link key={f.slug} href={f.href} className="block">
                {tile}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
