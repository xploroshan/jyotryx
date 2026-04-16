'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';
import Orb3D from '@/components/ui/Orb3D';

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
    <div className="mx-auto max-w-6xl px-5 sm:px-8 py-8 fade-in-up">
      {/* Hero */}
      <section
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${cfg.heroClass} border border-white/[0.06] px-8 sm:px-12 py-12 mb-10`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 relative z-10">
          <div className="shrink-0">
            <Orb3D fromClass={tint.from} viaClass={tint.via} toClass={tint.to} size={110} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="text-2xl" aria-hidden>{cfg.icon}</span>
              <span
                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${cfg.badgeClass}`}
              >
                {name}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {name}
            </h1>
            {tagline && (
              <p className="mt-3 text-base text-white/50 max-w-2xl leading-relaxed">{tagline}</p>
            )}
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/[0.03] blur-3xl pointer-events-none" />
      </section>

      {/* Feature tiles */}
      <section>
        <h2 className="text-[13px] uppercase tracking-widest text-white/40 font-medium mb-5">
          {exploreCta}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cfg.features.map((f) => {
            const label = readLabel(f.labelKey, f.slug);
            const tile = (
              <div
                className={`rounded-2xl bg-white/[0.02] border border-white/[0.06] p-6 h-full flex flex-col justify-between transition-all duration-300 ${
                  f.available
                    ? 'hover:-translate-y-1 hover:border-white/[0.12] hover:bg-white/[0.04] hover:shadow-[0_16px_48px_-16px_rgba(99,102,241,0.15)]'
                    : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {f.icon && (
                      <span className="text-lg" aria-hidden>{f.icon}</span>
                    )}
                    <h3 className="text-base font-semibold text-white">{label}</h3>
                  </div>
                </div>
                {!f.available && (
                  <p className="mt-4 text-xs text-white/30">
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
