'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';
import { PageTransition, Stagger } from '@/components/ui/PageTransition';
import { TraditionGlyph, FeatureGlyph } from '@/components/icons';

/**
 * Per-tradition accent palette for the hero card. Each tradition gets
 * a richer wash than the original 10%-opacity heroClass — it should
 * read as the room's centerpiece, not a barely-tinted neutral.
 *
 * Mirrors My Day's section treatment: a soft gradient background,
 * a colored icon plinth, and a colored uppercase tag.
 */
const TRADITION_PALETTE: Record<TraditionId, {
  /** Hero gradient — tailwind from-* via-* to-* tokens at noticeable opacity. */
  heroBg: string;
  /** Radial glow color matched to the tradition. */
  heroGlow: string;
  /** Icon plinth bg + border colors. */
  plinthBg: string;
  plinthBorder: string;
  /** Tag pill (matches plinth). */
  tagBg: string;
  tagBorder: string;
  tagText: string;
  /** Section header accent. */
  sectionAccent: string;
}> = {
  VEDIC: {
    heroBg: 'from-amber-500/25 via-orange-500/12 to-transparent',
    heroGlow: 'rgba(255,150,40,0.35)',
    plinthBg: 'bg-amber-500/20',
    plinthBorder: 'border-amber-500/50',
    tagBg: 'bg-amber-500/15',
    tagBorder: 'border-amber-500/40',
    tagText: 'text-amber-700',
    sectionAccent: 'text-amber-700',
  },
  WESTERN: {
    heroBg: 'from-sky-500/25 via-indigo-500/10 to-transparent',
    heroGlow: 'rgba(56,189,248,0.35)',
    plinthBg: 'bg-sky-500/20',
    plinthBorder: 'border-sky-500/50',
    tagBg: 'bg-sky-500/15',
    tagBorder: 'border-sky-500/40',
    tagText: 'text-sky-700',
    sectionAccent: 'text-sky-700',
  },
  CHINESE: {
    heroBg: 'from-red-500/25 via-rose-500/12 to-transparent',
    heroGlow: 'rgba(239,68,68,0.32)',
    plinthBg: 'bg-red-500/20',
    plinthBorder: 'border-red-500/50',
    tagBg: 'bg-red-500/15',
    tagBorder: 'border-red-500/40',
    tagText: 'text-red-700',
    sectionAccent: 'text-red-700',
  },
  HELLENISTIC: {
    heroBg: 'from-violet-500/25 via-purple-500/12 to-transparent',
    heroGlow: 'rgba(167,139,250,0.35)',
    plinthBg: 'bg-violet-500/20',
    plinthBorder: 'border-violet-500/50',
    tagBg: 'bg-violet-500/15',
    tagBorder: 'border-violet-500/40',
    tagText: 'text-violet-700',
    sectionAccent: 'text-violet-700',
  },
  HORARY: {
    heroBg: 'from-teal-500/25 via-cyan-500/12 to-transparent',
    heroGlow: 'rgba(45,212,191,0.35)',
    plinthBg: 'bg-teal-500/20',
    plinthBorder: 'border-teal-500/50',
    tagBg: 'bg-teal-500/15',
    tagBorder: 'border-teal-500/40',
    tagText: 'text-teal-700',
    sectionAccent: 'text-teal-700',
  },
  MEDICAL: {
    heroBg: 'from-emerald-500/25 via-green-500/12 to-transparent',
    heroGlow: 'rgba(52,211,153,0.35)',
    plinthBg: 'bg-emerald-500/20',
    plinthBorder: 'border-emerald-500/50',
    tagBg: 'bg-emerald-500/15',
    tagBorder: 'border-emerald-500/40',
    tagText: 'text-emerald-700',
    sectionAccent: 'text-emerald-700',
  },
};

/**
 * Per-feature accent map. Echoes My Day's pattern where each card
 * (Favorable Today emerald, Best to Avoid red, Career & Work primary,
 * Today's Mantra accent, Planetary Transit purple, …) gets its own
 * hue so the page reads as a varied dashboard, not a uniform grid.
 *
 * Keys are feature `slug` values from `WEB_TRADITIONS`. Unknown
 * slugs fall back to the tradition's primary plinth color.
 */
const FEATURE_PALETTE: Record<string, {
  bg: string;       // card background gradient
  iconBg: string;   // icon plinth bg
  iconText: string; // icon color
  border: string;   // card border
}> = {
  // Vedic
  chat:         { bg: 'from-indigo-500/12 to-transparent', iconBg: 'bg-indigo-500/15', iconText: 'text-indigo-700', border: 'border-indigo-500/25' },
  kundli:       { bg: 'from-primary-500/15 to-transparent', iconBg: 'bg-primary-500/20', iconText: 'text-primary-700', border: 'border-primary-500/30' },
  matching:     { bg: 'from-pink-500/12 to-transparent', iconBg: 'bg-pink-500/15', iconText: 'text-pink-700', border: 'border-pink-500/25' },
  horoscope:    { bg: 'from-purple-500/12 to-transparent', iconBg: 'bg-purple-500/15', iconText: 'text-purple-700', border: 'border-purple-500/25' },
  panchang:     { bg: 'from-accent-500/12 to-transparent', iconBg: 'bg-accent-500/15', iconText: 'text-accent-700', border: 'border-accent-500/25' },
  muhurat:      { bg: 'from-sky-500/12 to-transparent', iconBg: 'bg-sky-500/15', iconText: 'text-sky-700', border: 'border-sky-500/25' },
  dasha:        { bg: 'from-emerald-500/12 to-transparent', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-700', border: 'border-emerald-500/25' },
  dosha:        { bg: 'from-red-500/12 to-transparent', iconBg: 'bg-red-500/15', iconText: 'text-red-700', border: 'border-red-500/25' },
  divisional:   { bg: 'from-amber-500/12 to-transparent', iconBg: 'bg-amber-500/15', iconText: 'text-amber-700', border: 'border-amber-500/25' },
  'kp-astrology': { bg: 'from-cyan-500/12 to-transparent', iconBg: 'bg-cyan-500/15', iconText: 'text-cyan-700', border: 'border-cyan-500/25' },
  palmistry:    { bg: 'from-rose-500/12 to-transparent', iconBg: 'bg-rose-500/15', iconText: 'text-rose-700', border: 'border-rose-500/25' },
  numerology:   { bg: 'from-teal-500/12 to-transparent', iconBg: 'bg-teal-500/15', iconText: 'text-teal-700', border: 'border-teal-500/25' },
  tarot:        { bg: 'from-violet-500/12 to-transparent', iconBg: 'bg-violet-500/15', iconText: 'text-violet-700', border: 'border-violet-500/25' },
  vastu:        { bg: 'from-emerald-500/12 to-transparent', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-700', border: 'border-emerald-500/25' },
  // Western
  natal:        { bg: 'from-primary-500/12 to-transparent', iconBg: 'bg-primary-500/15', iconText: 'text-primary-700', border: 'border-primary-500/25' },
  transits:     { bg: 'from-sky-500/12 to-transparent', iconBg: 'bg-sky-500/15', iconText: 'text-sky-700', border: 'border-sky-500/25' },
  synastry:     { bg: 'from-pink-500/12 to-transparent', iconBg: 'bg-pink-500/15', iconText: 'text-pink-700', border: 'border-pink-500/25' },
  // Chinese
  bazi:         { bg: 'from-red-500/12 to-transparent', iconBg: 'bg-red-500/15', iconText: 'text-red-700', border: 'border-red-500/25' },
  zodiac:       { bg: 'from-amber-500/12 to-transparent', iconBg: 'bg-amber-500/15', iconText: 'text-amber-700', border: 'border-amber-500/25' },
  'flying-stars': { bg: 'from-yellow-500/12 to-transparent', iconBg: 'bg-yellow-500/15', iconText: 'text-yellow-700', border: 'border-yellow-500/25' },
  // Hellenistic
  profections:  { bg: 'from-violet-500/12 to-transparent', iconBg: 'bg-violet-500/15', iconText: 'text-violet-700', border: 'border-violet-500/25' },
  'zodiacal-releasing': { bg: 'from-indigo-500/12 to-transparent', iconBg: 'bg-indigo-500/15', iconText: 'text-indigo-700', border: 'border-indigo-500/25' },
  // Horary
  ask:          { bg: 'from-teal-500/12 to-transparent', iconBg: 'bg-teal-500/15', iconText: 'text-teal-700', border: 'border-teal-500/25' },
  history:      { bg: 'from-slate-500/12 to-transparent', iconBg: 'bg-slate-500/15', iconText: 'text-slate-700', border: 'border-slate-500/25' },
  // Medical
  decumbiture:  { bg: 'from-red-500/12 to-transparent', iconBg: 'bg-red-500/15', iconText: 'text-red-700', border: 'border-red-500/25' },
  'body-zodiac': { bg: 'from-emerald-500/12 to-transparent', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-700', border: 'border-emerald-500/25' },
};

export default function TraditionDashboard({ traditionId }: { traditionId: TraditionId }) {
  const { t } = useTranslation();
  const cfg = WEB_TRADITIONS[traditionId];
  const palette = TRADITION_PALETTE[traditionId];

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
    <PageTransition className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-14">
      {/* Hero — tradition-tinted gradient card with a bright glow. The
          tradition's accent color now actually reads (vs. the old 10%
          overlay), echoing My Day's strongly-tinted Planetary Transit
          and Today's Remedy panels. */}
      <section className={`relative overflow-hidden rounded-3xl card-cream shadow-warm-md px-8 sm:px-12 py-12 sm:py-14 mb-12 bg-gradient-to-br ${palette.heroBg}`}>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 w-[560px] h-[560px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${palette.heroGlow} 0%, transparent 70%)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 bottom-[-30%] w-[420px] h-[420px] rounded-full opacity-60"
          style={{
            background: `radial-gradient(circle, ${palette.heroGlow} 0%, transparent 70%)`,
          }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-8">
          <div className={`shrink-0 grid place-items-center w-28 h-28 rounded-3xl ${palette.plinthBg} border ${palette.plinthBorder} ${palette.tagText}`} style={{ boxShadow: `0 0 48px -8px ${palette.heroGlow}` }}>
            <TraditionGlyph id={traditionId} size={64} weight={1.4} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${palette.tagBg} border ${palette.tagBorder} ${palette.tagText} uppercase tracking-[0.18em] mb-4`}>
              {name}
            </span>
            <h1
              className="font-display font-semibold text-surface-950 tracking-[-0.01em] leading-[1.0]"
              style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
            >
              {name}
            </h1>
            {tagline && (
              <p className="mt-4 text-base sm:text-lg text-emphasis max-w-2xl leading-relaxed">
                {tagline}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Feature tiles — each feature gets its own accent color so the
          grid reads as a varied dashboard rather than a uniform row of
          orange icons. Same gradient-and-icon-plinth treatment used by
          My Day's "Favorable Today / Best to Avoid / Career" cards. */}
      <section>
        <h2 className={`text-[12px] uppercase tracking-[0.22em] ${palette.sectionAccent} font-semibold mb-6`}>
          {exploreCta}
        </h2>
        <Stagger.Container className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {cfg.features.map((f) => {
            const label = readLabel(f.labelKey, f.slug);
            const fp = FEATURE_PALETTE[f.slug] ?? {
              bg: 'from-primary-500/12 to-transparent',
              iconBg: palette.plinthBg,
              iconText: palette.tagText,
              border: palette.tagBorder,
            };
            const tile = (
              <div
                className={`group rounded-2xl p-6 h-full flex items-center gap-4 bg-gradient-to-br ${fp.bg} border ${fp.border} card-cream-hover shadow-warm-sm transition-all ${
                  f.available
                    ? 'hover:shadow-warm-md'
                    : 'opacity-50 cursor-not-allowed pointer-events-none'
                }`}
              >
                <div className={`shrink-0 grid place-items-center w-12 h-12 rounded-xl ${fp.iconBg} border ${fp.border} ${fp.iconText} transition-transform group-hover:scale-105`}>
                  <FeatureGlyph slug={f.slug} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base sm:text-lg font-semibold text-surface-950 leading-tight">
                    {label}
                  </h3>
                  {!f.available && (
                    <p className="mt-1 text-xs text-secondary">
                      {readLabel('traditionsUi.comingSoon', 'Coming soon')}
                    </p>
                  )}
                </div>
              </div>
            );
            if (!f.available) {
              return (
                <Stagger.Item key={f.slug} className="block">
                  <div aria-disabled="true">{tile}</div>
                </Stagger.Item>
              );
            }
            return (
              <Stagger.Item key={f.slug} className="block">
                <Link href={f.href} className="block focus-ring rounded-2xl">
                  {tile}
                </Link>
              </Stagger.Item>
            );
          })}
        </Stagger.Container>
      </section>
    </PageTransition>
  );
}
