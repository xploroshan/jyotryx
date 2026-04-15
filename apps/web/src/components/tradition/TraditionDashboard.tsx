'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';
import Orb3D from '@/components/ui/Orb3D';

/**
 * Shared aggregator used by every per-tradition dashboard page
 * (`/vedic`, `/chinese`, `/western`, `/hellenistic`, `/horary`, `/medical`).
 *
 * Glass hero with a 3D orb (color-tinted to the tradition), followed by
 * a grid of glass feature tiles pulled from the tradition registry. The
 * tradition-specific flavour (palette, icon, feature list, tagline)
 * comes from `WEB_TRADITIONS[traditionId]`, so each page is a one-line
 * `<TraditionDashboard traditionId="…" />`.
 */

// Per-tradition orb tint — mirrors TRADITION_HERO_COLORS but expressed
// as gradient-stop Tailwind classes consumable by Orb3D.
const ORB_TINTS: Record<TraditionId, { from: string; via: string; to: string }> = {
  VEDIC: { from: 'from-amber-400/80', via: 'via-orange-500/40', to: 'to-transparent' },
  WESTERN: { from: 'from-sky-400/80', via: 'via-blue-500/40', to: 'to-transparent' },
  CHINESE: { from: 'from-red-400/80', via: 'via-rose-500/40', to: 'to-transparent' },
  HELLENISTIC: { from: 'from-violet-400/80', via: 'via-purple-500/40', to: 'to-transparent' },
  HORARY: { from: 'from-teal-400/80', via: 'via-cyan-500/40', to: 'to-transparent' },
  MEDICAL: { from: 'from-emerald-400/80', via: 'via-green-500/40', to: 'to-transparent' },
};

export default function TraditionDashboard({ traditionId }: { traditionId: TraditionId }) {
  const { t } = useTranslation();
  const cfg = WEB_TRADITIONS[traditionId];
  const tint = ORB_TINTS[traditionId];

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
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Glass hero with 3D orb */}
      <section
        className={`relative overflow-hidden rounded-3xl glass-strong bg-gradient-to-br ${cfg.heroClass} ring-1 px-6 sm:px-10 py-10 mb-8`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative z-10">
          <div className="shrink-0">
            <Orb3D fromClass={tint.from} viaClass={tint.via} toClass={tint.to} size={120} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl" aria-hidden>{cfg.icon}</span>
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.badgeClass}`}
              >
                {name}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              {name}
            </h1>
            {tagline && (
              <p className="mt-2 text-sm sm:text-base text-white/70 max-w-2xl">{tagline}</p>
            )}
          </div>
        </div>

        {/* Decorative background blur */}
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />
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
                className={`glass p-5 rounded-2xl h-full flex flex-col justify-between transition-all ${
                  f.available
                    ? 'hover:-translate-y-0.5 hover:ring-1 hover:ring-white/20 hover:shadow-[0_12px_32px_-10px] hover:shadow-primary-500/20'
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
