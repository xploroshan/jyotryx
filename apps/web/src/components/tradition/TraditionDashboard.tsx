'use client';

/**
 * Shared editorial layout for the tradition landing pages.
 *
 * Structurally a mirror of /vedic: a dark, typography-led hero band
 * with a per-tradition tint, an optional content slot (where each
 * tradition fills in its own "Today" / "Your sign" / "Ask a question"
 * panel), and a compact features dock at the bottom.
 *
 * Per-tradition data is the page's responsibility — this shell only
 * draws the chrome.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS, type TraditionId } from '@/lib/traditions';
import { TraditionGlyph, FeatureGlyph } from '@/components/icons';

// ─── Per-tradition tint (echoes the hero glow on the dark band) ───────
const TINT: Record<TraditionId, {
  /** rgba color for the hero radial glow + section accents. */
  glow: string;
  /** Tailwind text class for chips + uppercase tags. */
  tagText: string;
  /** Tailwind text class for the orange-on-dark eyebrow tag. */
  tagTextOnDark: string;
  /** Tailwind bg class for the eyebrow tag on the dark band. */
  tagBgOnDark: string;
  tagBorderOnDark: string;
  /** Italic accent color inside the headline. */
  italicOnDark: string;
}> = {
  VEDIC:       { glow: 'rgba(255,150,40,0.42)',  tagText: 'text-amber-700',  tagTextOnDark: 'text-amber-300/90', tagBgOnDark: 'bg-amber-500/15',  tagBorderOnDark: 'border-amber-500/30',  italicOnDark: 'text-amber-200' },
  WESTERN:     { glow: 'rgba(56,189,248,0.42)',  tagText: 'text-sky-700',    tagTextOnDark: 'text-sky-300/90',   tagBgOnDark: 'bg-sky-500/15',    tagBorderOnDark: 'border-sky-500/30',    italicOnDark: 'text-sky-200' },
  CHINESE:     { glow: 'rgba(239,68,68,0.42)',   tagText: 'text-red-700',    tagTextOnDark: 'text-red-300/90',   tagBgOnDark: 'bg-red-500/15',    tagBorderOnDark: 'border-red-500/30',    italicOnDark: 'text-red-200' },
  HELLENISTIC: { glow: 'rgba(167,139,250,0.42)', tagText: 'text-violet-700', tagTextOnDark: 'text-violet-300/90',tagBgOnDark: 'bg-violet-500/15', tagBorderOnDark: 'border-violet-500/30', italicOnDark: 'text-violet-200' },
  HORARY:      { glow: 'rgba(45,212,191,0.42)',  tagText: 'text-teal-700',   tagTextOnDark: 'text-teal-300/90',  tagBgOnDark: 'bg-teal-500/15',   tagBorderOnDark: 'border-teal-500/30',   italicOnDark: 'text-teal-200' },
  MEDICAL:     { glow: 'rgba(52,211,153,0.42)',  tagText: 'text-emerald-700',tagTextOnDark: 'text-emerald-300/90',tagBgOnDark: 'bg-emerald-500/15',tagBorderOnDark: 'border-emerald-500/30',italicOnDark: 'text-emerald-200' },
};

export interface TraditionDashboardProps {
  traditionId: TraditionId;
  /** Display headline — full string with the italicised half marked
   *  by `{em}…{/em}`. Defaults to the tradition's localized name. */
  headline?: string;
  /** Small meta line under the title (e.g. user's birth coordinates). */
  metaLine?: string;
  /** Chip line under the meta (e.g. "Leo Sun · Earth Element"). Each
   *  chip is a { label, tone } pair; tones are Tailwind text classes. */
  chips?: { label: string; tone?: string }[];
  /** Optional CTA button rendered under the chip line on the hero
   *  (used by /horary for "Ask a question now"). */
  heroCta?: { label: string; href: string };
  /** Slot for the per-tradition content — usually "Today" + chart
   *  cards. Rendered between the hero and the features dock. */
  personalContent?: ReactNode;
}

export default function TraditionDashboard({
  traditionId,
  headline,
  metaLine,
  chips,
  heroCta,
  personalContent,
}: TraditionDashboardProps) {
  const { t } = useTranslation();
  const cfg = WEB_TRADITIONS[traditionId];
  const tint = TINT[traditionId];

  const readLabel = (path: string, fallback?: string): string => {
    const parts = path.split('.');
    let node: any = t;
    for (const part of parts) {
      if (node && typeof node === 'object' && part in node) node = node[part];
      else return fallback ?? path;
    }
    return typeof node === 'string' ? node : (fallback ?? path);
  };

  const traditionName = readLabel(cfg.labelKey, cfg.slug);
  const tagline = readLabel(cfg.taglineKey, '');
  const exploreCta = readLabel('traditionsUi.heroCta', 'Explore features');
  const comingSoon = readLabel('traditionsUi.comingSoon', 'Coming soon');

  const displayHeadline = headline ?? `Your {em}${traditionName.toLowerCase()}{/em} reading`;
  // Split on {em}…{/em} so the inner span can be styled distinctly.
  const headlineParts = (() => {
    const m = displayHeadline.match(/^(.*?)\{em\}(.*?)\{\/em\}(.*?)$/);
    if (!m) return { before: displayHeadline, em: '', after: '' };
    return { before: m[1], em: m[2], after: m[3] };
  })();

  return (
    <div>
      {/* ─── Editorial dark hero band ──────────────────────────────── */}
      <section className="relative overflow-hidden bg-surface-950 text-white">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              `radial-gradient(ellipse 120% 80% at 80% 20%, ${tint.glow} 0%, ${replaceAlpha(tint.glow, 0.18)} 35%, transparent 65%), radial-gradient(ellipse 80% 60% at 20% 90%, ${replaceAlpha(tint.glow, 0.22)} 0%, transparent 60%)`,
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              'radial-gradient(1px 1px at 25% 30%, white 50%, transparent), radial-gradient(1px 1px at 60% 70%, white 50%, transparent), radial-gradient(1.5px 1.5px at 75% 20%, white 50%, transparent), radial-gradient(1px 1px at 40% 80%, white 50%, transparent), radial-gradient(1px 1px at 10% 60%, white 50%, transparent), radial-gradient(1px 1px at 90% 50%, white 50%, transparent)',
            backgroundSize: '400px 400px',
          }}
        />

        <div className="relative mx-auto max-w-6xl px-5 sm:px-8 py-16 sm:py-20">
          <div className="flex items-center gap-2.5 mb-6">
            <div className={`grid place-items-center w-9 h-9 rounded-lg border ${tint.tagBgOnDark} ${tint.tagBorderOnDark} ${tint.tagTextOnDark}`}>
              <TraditionGlyph id={traditionId} size={18} weight={1.4} />
            </div>
            <span className={`text-[11px] font-medium uppercase tracking-[0.24em] ${tint.tagTextOnDark}`}>
              {traditionName}
            </span>
          </div>

          <h1
            className="font-display font-semibold tracking-[-0.015em] leading-[0.95] text-white"
            style={{ fontSize: 'clamp(44px, 7vw, 88px)' }}
          >
            {headlineParts.before}
            {headlineParts.em && (
              <span className={`italic ${tint.italicOnDark}`}>{headlineParts.em}</span>
            )}
            {headlineParts.after}
          </h1>

          {metaLine && (
            <p className="mt-5 text-sm sm:text-[15px] text-white/60 font-light tracking-wide">
              {metaLine}
            </p>
          )}

          {!metaLine && tagline && (
            <p className="mt-5 text-base sm:text-lg text-white/65 font-light max-w-2xl leading-relaxed">
              {tagline}
            </p>
          )}

          {chips && chips.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm sm:text-base font-medium">
              {chips.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-white/30 select-none">·</span>}
                  <span className={c.tone ?? 'text-white/85'}>{c.label}</span>
                </span>
              ))}
            </div>
          )}

          {heroCta && (
            <Link
              href={heroCta.href}
              className={`mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${tint.tagBgOnDark} ${tint.tagBorderOnDark} ${tint.tagTextOnDark} hover:bg-white/10`}
            >
              {heroCta.label} →
            </Link>
          )}
        </div>
      </section>

      {personalContent}

      {/* ─── Compact features dock ─────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
          <p className={`text-[11px] uppercase tracking-[0.24em] font-semibold mb-1 ${tint.tagText}`}>
            Go deeper
          </p>
          <h2 className="font-display text-2xl sm:text-3xl text-surface-950 mb-6">
            {exploreCta}
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {cfg.features.map((f) => {
              const label = readLabel(f.labelKey, f.slug);
              if (!f.available) {
                return (
                  <div
                    key={f.slug}
                    className="px-4 py-3 rounded-lg bg-[#fbf7ec] border border-[rgba(26,20,16,0.10)] opacity-50 cursor-not-allowed"
                    title={comingSoon}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`${tint.tagText} opacity-60`}>
                        <FeatureGlyph slug={f.slug} size={18} />
                      </span>
                      <span className="text-sm font-medium text-secondary truncate">{label}</span>
                    </div>
                  </div>
                );
              }
              return (
                <Link
                  key={f.slug}
                  href={f.href}
                  className="group px-4 py-3 rounded-lg bg-[#fbf7ec] border border-[rgba(26,20,16,0.10)] hover:border-primary-500/40 hover:bg-white hover:shadow-warm-sm transition-all flex items-center gap-3 focus-ring"
                >
                  <span className={`${tint.tagText} group-hover:scale-110 transition-transform`}>
                    <FeatureGlyph slug={f.slug} size={18} />
                  </span>
                  <span className="text-sm font-medium text-emphasis group-hover:text-surface-950 truncate flex-1">
                    {label}
                  </span>
                  <span className={`${tint.tagText} opacity-0 group-hover:opacity-100 transition-opacity text-xs`}>→</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Replace the alpha component of an rgba(...) string. */
function replaceAlpha(rgba: string, newAlpha: number): string {
  return rgba.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, `rgba($1, $2, $3, ${newAlpha})`);
}

/* ─── Shared content-band primitives ─────────────────────────────── */

/** Editorial section header used by tradition pages: small caps
 *  eyebrow + display-serif title.
 *
 *  Pages import this so they don't reach into the component file
 *  structure or duplicate the typography styles. */
export function SectionHead({
  eyebrow,
  title,
  trailing,
  tone,
}: {
  eyebrow: string;
  title: string;
  trailing?: ReactNode;
  /** Tradition tint for the eyebrow. */
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-6">
      <div>
        <p className={`text-[11px] uppercase tracking-[0.24em] font-semibold ${tone ?? 'text-primary-700'}`}>
          {eyebrow}
        </p>
        <h2 className="font-display text-2xl sm:text-3xl text-surface-950 mt-1">
          {title}
        </h2>
      </div>
      {trailing}
    </div>
  );
}

/** Compact stat card for "Today's Sky" rows. */
export function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warn' | 'good';
}) {
  const palette =
    tone === 'warn'
      ? 'bg-amber-500/8 border-amber-500/25 text-amber-800'
      : tone === 'good'
      ? 'bg-emerald-500/8 border-emerald-500/25 text-emerald-800'
      : 'bg-[#fbf7ec] border-[rgba(26,20,16,0.10)] text-surface-950';
  return (
    <div className={`p-4 rounded-xl border ${palette.replace(/text-\S+/, '')}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[rgba(12,8,5,0.55)] mb-1.5 font-medium">{label}</p>
      <p className={`font-display text-lg sm:text-xl leading-tight ${tone === 'warn' ? 'text-amber-800' : tone === 'good' ? 'text-emerald-800' : 'text-surface-950'}`}>{value}</p>
    </div>
  );
}

/** Larger "chart card" used by /vedic for ascendant/moon/sun/dasha
 *  and by other traditions for sign / element / animal etc. */
export function FactCard({
  eyebrow,
  headline,
  subline,
  note,
  accent = 'primary',
  toneText,
}: {
  eyebrow: string;
  headline: string;
  subline?: string;
  note?: string;
  accent?: 'amber' | 'slate' | 'primary' | 'indigo' | 'yellow' | 'red' | 'pink' | 'emerald' | 'purple' | 'sky' | 'violet' | 'teal' | 'rose';
  toneText?: string;
}) {
  const accentBg: Record<string, string> = {
    amber: 'from-amber-500/10', slate: 'from-slate-500/10', primary: 'from-primary-500/10',
    indigo: 'from-indigo-500/10', yellow: 'from-yellow-500/10', red: 'from-red-500/10',
    pink: 'from-pink-500/10', emerald: 'from-emerald-500/10', purple: 'from-purple-500/10',
    sky: 'from-sky-500/10', violet: 'from-violet-500/10', teal: 'from-teal-500/10', rose: 'from-rose-500/10',
  };
  const accentRule: Record<string, string> = {
    amber: 'bg-amber-500', slate: 'bg-slate-500', primary: 'bg-primary-500',
    indigo: 'bg-indigo-500', yellow: 'bg-yellow-500', red: 'bg-red-500',
    pink: 'bg-pink-500', emerald: 'bg-emerald-500', purple: 'bg-purple-500',
    sky: 'bg-sky-500', violet: 'bg-violet-500', teal: 'bg-teal-500', rose: 'bg-rose-500',
  };
  return (
    <div className={`relative overflow-hidden p-6 sm:p-7 rounded-2xl bg-gradient-to-br ${accentBg[accent]} to-transparent border border-[rgba(26,20,16,0.10)] bg-[#fbf7ec]`}>
      <span className={`absolute left-0 top-6 bottom-6 w-[3px] rounded-r ${accentRule[accent]}`} aria-hidden />
      <p className="text-[10px] uppercase tracking-[0.22em] text-[rgba(12,8,5,0.55)] font-semibold pl-3">{eyebrow}</p>
      <p className={`mt-2 font-display text-3xl sm:text-4xl leading-none tracking-tight pl-3 ${toneText ?? 'text-surface-950'}`}>{headline}</p>
      {subline && <p className="mt-2 text-sm text-emphasis pl-3">{subline}</p>}
      {note && <p className="mt-3 text-[13px] text-secondary leading-relaxed italic font-display pl-3">{note}</p>}
    </div>
  );
}
