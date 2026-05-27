/**
 * Editorial dark hero band — the typography-led, per-tint cosmic header
 * shared by every tradition landing AND every feature/sub-route page.
 *
 * Originally extracted from TraditionDashboard so the hero treatment
 * propagates uniformly across:
 *   - 6 tradition landings (/vedic, /western, /chinese, /hellenistic,
 *     /horary, /medical)
 *   - 8 form-driven feature pages (/kundli, /panchang, /muhurat,
 *     /horoscope, /vastu, /numerology, /tarot, /matching)
 *   - ~15 sub-route pages under each tradition
 *
 * Each surface picks a tint by name; this component owns the colour
 * mapping so it can change in one place.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

/** Named tints — pick one per surface. */
export type EditorialTint =
  | 'amber'   // Vedic, kundli, panchang, muhurat
  | 'sky'     // Western, horoscope
  | 'red'     // Chinese
  | 'violet'  // Hellenistic, tarot
  | 'teal'    // Horary, numerology
  | 'emerald' // Medical, vastu
  | 'pink'    // Matching
  | 'indigo'  // Sub-routes (default)
  | 'purple'; // Optional extra

interface TintTokens {
  /** rgba color for the hero radial glow. */
  glow: string;
  /** Tailwind text class for the eyebrow tag on the dark band. */
  tagTextOnDark: string;
  /** Tailwind bg/border classes for the eyebrow tag chip. */
  tagBgOnDark: string;
  tagBorderOnDark: string;
  /** Italic accent inside the headline. */
  italicOnDark: string;
  /** Section accent in the cream body. */
  tagText: string;
}

export const EDITORIAL_TINTS: Record<EditorialTint, TintTokens> = {
  amber:   { glow: 'rgba(255,150,40,0.42)',  tagText: 'text-amber-700',  tagTextOnDark: 'text-amber-300/90',  tagBgOnDark: 'bg-amber-500/15',  tagBorderOnDark: 'border-amber-500/30',  italicOnDark: 'text-amber-200' },
  sky:     { glow: 'rgba(56,189,248,0.42)',  tagText: 'text-sky-700',    tagTextOnDark: 'text-sky-300/90',    tagBgOnDark: 'bg-sky-500/15',    tagBorderOnDark: 'border-sky-500/30',    italicOnDark: 'text-sky-200' },
  red:     { glow: 'rgba(239,68,68,0.42)',   tagText: 'text-red-700',    tagTextOnDark: 'text-red-300/90',    tagBgOnDark: 'bg-red-500/15',    tagBorderOnDark: 'border-red-500/30',    italicOnDark: 'text-red-200' },
  violet:  { glow: 'rgba(167,139,250,0.42)', tagText: 'text-violet-700', tagTextOnDark: 'text-violet-300/90', tagBgOnDark: 'bg-violet-500/15', tagBorderOnDark: 'border-violet-500/30', italicOnDark: 'text-violet-200' },
  teal:    { glow: 'rgba(45,212,191,0.42)',  tagText: 'text-teal-700',   tagTextOnDark: 'text-teal-300/90',   tagBgOnDark: 'bg-teal-500/15',   tagBorderOnDark: 'border-teal-500/30',   italicOnDark: 'text-teal-200' },
  emerald: { glow: 'rgba(52,211,153,0.42)',  tagText: 'text-emerald-700',tagTextOnDark: 'text-emerald-300/90',tagBgOnDark: 'bg-emerald-500/15',tagBorderOnDark: 'border-emerald-500/30',italicOnDark: 'text-emerald-200' },
  pink:    { glow: 'rgba(236,72,153,0.42)',  tagText: 'text-pink-700',   tagTextOnDark: 'text-pink-300/90',   tagBgOnDark: 'bg-pink-500/15',   tagBorderOnDark: 'border-pink-500/30',   italicOnDark: 'text-pink-200' },
  indigo:  { glow: 'rgba(99,102,241,0.42)',  tagText: 'text-indigo-700', tagTextOnDark: 'text-indigo-300/90', tagBgOnDark: 'bg-indigo-500/15', tagBorderOnDark: 'border-indigo-500/30', italicOnDark: 'text-indigo-200' },
  purple:  { glow: 'rgba(168,85,247,0.42)',  tagText: 'text-purple-700', tagTextOnDark: 'text-purple-300/90', tagBgOnDark: 'bg-purple-500/15', tagBorderOnDark: 'border-purple-500/30', italicOnDark: 'text-purple-200' },
};

export interface EditorialHeroProps {
  tint: EditorialTint;
  /** Small uppercase eyebrow above the title (e.g. "Vedic", "Kundli"). */
  eyebrow: string;
  /** Optional icon node rendered inside the eyebrow chip. */
  eyebrowIcon?: ReactNode;
  /** Headline. Mark the italicised half with `{em}…{/em}`. */
  headline: string;
  /** Optional small meta line under the title (birth details, date, etc.). */
  metaLine?: string;
  /** Optional fallback paragraph if there's no metaLine (longer prose). */
  tagline?: string;
  /** Pill chips under the meta line. Tones are Tailwind text classes. */
  chips?: { label: string; tone?: string }[];
  /** Single CTA button. */
  heroCta?: { label: string; href: string };
}

function replaceAlpha(rgba: string, newAlpha: number): string {
  return rgba.replace(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/, `rgba($1, $2, $3, ${newAlpha})`);
}

export default function EditorialHero({
  tint,
  eyebrow,
  eyebrowIcon,
  headline,
  metaLine,
  tagline,
  chips,
  heroCta,
}: EditorialHeroProps) {
  const t = EDITORIAL_TINTS[tint];

  // Split on `{em}…{/em}` so the italic half can be styled distinctly.
  const m = headline.match(/^(.*?)\{em\}(.*?)\{\/em\}(.*?)$/);
  const before = m ? m[1] : headline;
  const em = m ? m[2] : '';
  const after = m ? m[3] : '';

  return (
    <section className="relative overflow-hidden bg-surface-950 text-white">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            `radial-gradient(ellipse 120% 80% at 80% 20%, ${t.glow} 0%, ${replaceAlpha(t.glow, 0.18)} 35%, transparent 65%), radial-gradient(ellipse 80% 60% at 20% 90%, ${replaceAlpha(t.glow, 0.22)} 0%, transparent 60%)`,
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
          {eyebrowIcon !== undefined && (
            <div className={`grid place-items-center w-9 h-9 rounded-lg border ${t.tagBgOnDark} ${t.tagBorderOnDark} ${t.tagTextOnDark}`}>
              {eyebrowIcon}
            </div>
          )}
          <span className={`text-[11px] font-medium uppercase tracking-[0.24em] ${t.tagTextOnDark}`}>
            {eyebrow}
          </span>
        </div>

        <h1
          className="font-display font-semibold tracking-[-0.015em] leading-[0.95] text-white"
          style={{ fontSize: 'clamp(40px, 6.5vw, 80px)' }}
        >
          {before}
          {em && <span className={`italic ${t.italicOnDark}`}>{em}</span>}
          {after}
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
            className={`mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${t.tagBgOnDark} ${t.tagBorderOnDark} ${t.tagTextOnDark} hover:bg-white/10`}
          >
            {heroCta.label} →
          </Link>
        )}
      </div>
    </section>
  );
}
