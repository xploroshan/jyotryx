'use client';

/**
 * Vedic landing — editorial personal dashboard.
 *
 * Replaces the generic feature-launcher grid with a content-first
 * layout: a magazine-style dark hero band that opens on the user's
 * own chart summary, then a "Today's Sky" snapshot from the daily
 * briefing API, then their chart's headline placements (ascendant /
 * moon / sun + current dasha), and finally a compact features dock.
 *
 * Other traditions (Western/Chinese/Hellenistic/Horary/Medical) still
 * fall through to the shared TraditionDashboard — they don't yet have
 * per-tradition data feeds rich enough to fill a personal dashboard.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore, useAuthHydrated } from '@/lib/store';
import { useTranslation } from '@/i18n';
import { WEB_TRADITIONS } from '@/lib/traditions';
import { TraditionGlyph, FeatureGlyph } from '@/components/icons';
import {
  readBriefingCacheSync,
  writeBriefingCache,
} from '@/app/my-day/lib/briefingCache';
import type { DailyBriefing } from '@/app/my-day/lib/types';

interface KundliSummary {
  ascendant: string;
  moonSign: string;
  sunSign: string;
  nakshatra: string;
  dashas?: {
    planet: string;
    startDate: string;
    endDate: string;
    subPeriods?: { planet: string; startDate: string; endDate: string }[];
  }[];
}

const KUNDLI_CACHE_KEY = 'myastro360-vedic-summary';

function readKundliCache(userId: string): KundliSummary | null {
  try {
    const raw = localStorage.getItem(`${KUNDLI_CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: KundliSummary; savedAt: string };
    // Stale after 7 days — chart-level placements are stable; refresh
    // weekly to catch dasha rollovers.
    if (Date.now() - new Date(parsed.savedAt).getTime() > 7 * 86400_000) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
function writeKundliCache(userId: string, data: KundliSummary) {
  try {
    localStorage.setItem(
      `${KUNDLI_CACHE_KEY}:${userId}`,
      JSON.stringify({ data, savedAt: new Date().toISOString() }),
    );
  } catch {
    /* quota / private mode */
  }
}

/** Ascendant → ruling planet (for the editorial "Lord" subtitle). */
const SIGN_LORD: Record<string, string> = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};

/** Short one-line character read for each ascendant. */
const ASCENDANT_NOTE: Record<string, string> = {
  Aries: 'Pioneering, direct, the spark that starts things.',
  Taurus: 'Grounded, sensual, steady through change.',
  Gemini: 'Quick-witted, curious, threading many ideas.',
  Cancer: 'Protective, intuitive, anchored at home.',
  Leo: 'Magnetic, generous, a natural performer.',
  Virgo: 'Precise, useful, devoted to the craft.',
  Libra: 'Diplomatic, aesthetic, balancing the room.',
  Scorpio: 'Intense, perceptive, drawn to the depths.',
  Sagittarius: 'Seeking, philosophical, a wide horizon.',
  Capricorn: 'Disciplined, ambitious, building for time.',
  Aquarius: 'Inventive, principled, a step outside the room.',
  Pisces: 'Imaginative, empathic, dissolving into the larger.',
};

/** Tone color per dasha planet, used for the editorial accent line. */
const PLANET_TONE: Record<string, string> = {
  Sun: 'text-amber-700', Moon: 'text-slate-700', Mars: 'text-red-700',
  Mercury: 'text-emerald-700', Jupiter: 'text-yellow-700',
  Venus: 'text-pink-700', Saturn: 'text-indigo-700',
  Rahu: 'text-purple-700', Ketu: 'text-stone-700',
};

const cfg = WEB_TRADITIONS.VEDIC;

export default function VedicDashboardPage() {
  const { t } = useTranslation();
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const isHydrated = useAuthHydrated();

  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [kundli, setKundli] = useState<KundliSummary | null>(null);
  const [kundliLoading, setKundliLoading] = useState(false);

  // Warm both caches synchronously so the page paints with content,
  // not skeletons, when the user has visited before.
  useEffect(() => {
    if (!user?.id) return;
    const cachedBriefing = readBriefingCacheSync();
    if (cachedBriefing) setBriefing(cachedBriefing);
    const cachedKundli = readKundliCache(user.id);
    if (cachedKundli) setKundli(cachedKundli);
  }, [user?.id]);

  // Refresh briefing in the background — same stale-while-revalidate
  // pattern My Day uses.
  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !accessToken) return;
    api
      .get<DailyBriefing>('/daily-briefing?locale=en', { token: accessToken })
      .then((data) => {
        setBriefing(data);
        if (user?.id) writeBriefingCache(user.id, 'en', data);
      })
      .catch(() => {
        /* ignore — we'll keep showing the cache */
      });
  }, [isHydrated, isAuthenticated, accessToken, user?.id]);

  // Lazy-fetch the kundli summary if we have birth details and no cache.
  useEffect(() => {
    if (
      !isHydrated || !isAuthenticated || !accessToken ||
      !user?.dateOfBirth || !user?.timeOfBirth || !user?.placeOfBirth ||
      kundli || kundliLoading
    ) return;
    setKundliLoading(true);
    api
      .post<KundliSummary>('/astrology/kundli', {
        dateOfBirth: user.dateOfBirth,
        timeOfBirth: user.timeOfBirth,
        placeOfBirth: user.placeOfBirth,
        locale: 'en',
        tradition: 'VEDIC',
      }, { token: accessToken })
      .then((data) => {
        setKundli(data);
        if (user.id) writeKundliCache(user.id, data);
      })
      .catch(() => {
        /* form-driven fallback — user can still navigate to /kundli */
      })
      .finally(() => setKundliLoading(false));
  }, [isHydrated, isAuthenticated, accessToken, user, kundli, kundliLoading]);

  const firstName = user?.name?.split(' ')[0] ?? '';
  const ascendant = kundli?.ascendant;
  const moonSign = kundli?.moonSign;
  const sunSign = kundli?.sunSign;
  const nakshatra = kundli?.nakshatra;
  const currentDasha = kundli?.dashas?.[0];
  // Find the active antardasha (sub-period containing today)
  const today = new Date();
  const currentAntardasha = currentDasha?.subPeriods?.find((s) => {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    return today >= start && today <= end;
  });

  const heroChips = [
    ascendant ? { label: `${ascendant} Ascendant`, tone: 'text-amber-300' } : null,
    moonSign ? { label: `${moonSign} Moon`, tone: 'text-slate-300' } : null,
    currentDasha ? { label: `${currentDasha.planet} Mahādaśā`, tone: 'text-yellow-300' } : null,
  ].filter(Boolean) as { label: string; tone: string }[];

  return (
    <div>
      {/* ─── Editorial dark hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-surface-950 text-white">
        {/* Cosmic gradient + soft saffron sunrise */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(ellipse 120% 80% at 80% 20%, rgba(255,150,40,0.42) 0%, rgba(196,50,0,0.18) 35%, transparent 65%), radial-gradient(ellipse 80% 60% at 20% 90%, rgba(255,77,0,0.22) 0%, transparent 60%)',
          }}
        />
        {/* Faint star field */}
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
            <div className="grid place-items-center w-9 h-9 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <TraditionGlyph id="VEDIC" size={18} weight={1.4} />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-[0.24em] text-amber-300/90">
              Vedic
            </span>
          </div>

          <h1
            className="font-display font-semibold tracking-[-0.015em] leading-[0.95] text-white"
            style={{ fontSize: 'clamp(44px, 7vw, 88px)' }}
          >
            {firstName ? <>{firstName}'s <span className="italic text-amber-200">Vedic chart</span></> : <>Your <span className="italic text-amber-200">Vedic chart</span></>}
          </h1>

          {user?.placeOfBirth && (
            <p className="mt-5 text-sm sm:text-[15px] text-white/60 font-light tracking-wide">
              {user.placeOfBirth}
              {user.dateOfBirth ? ` · ${new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
              {user.timeOfBirth ? ` · ${user.timeOfBirth}` : ''}
            </p>
          )}

          {heroChips.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm sm:text-base font-medium">
              {heroChips.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-white/30 select-none">·</span>}
                  <span className={c.tone}>{c.label}</span>
                </span>
              ))}
            </div>
          )}

          {!ascendant && !kundliLoading && user?.dateOfBirth && (
            <p className="mt-6 text-sm text-white/55">
              Loading your chart's placements…
            </p>
          )}

          {!user?.dateOfBirth && (
            <Link
              href="/profile?complete=1"
              className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/40 text-sm font-medium transition-colors"
            >
              Add birth details to see your chart →
            </Link>
          )}
        </div>
      </section>

      {/* ─── Today's sky ─────────────────────────────────────────────── */}
      {briefing && (
        <section className="border-b border-[rgba(26,20,16,0.10)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-primary-700 font-semibold">
                  Today's sky
                </p>
                <h2 className="font-display text-2xl sm:text-3xl text-surface-950 mt-1">
                  {new Date(briefing.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h2>
              </div>
              <Link href="/my-day" className="text-xs text-primary-700 hover:text-primary-600 font-medium hidden sm:inline">
                Full briefing →
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <SkyStat label="Tithi" value={briefing.panchang?.tithi ?? '—'} />
              <SkyStat label="Nakshatra" value={briefing.panchang?.nakshatra ?? '—'} />
              <SkyStat label="Yoga" value={briefing.panchang?.yoga ?? '—'} />
              <SkyStat label="Rāhu Kāl" value={briefing.panchang?.rahukaal ?? '—'} tone="warn" />
            </div>

            {briefing.transitAlert && (
              <div className="mt-5 px-4 py-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-900/80 italic font-display">
                {briefing.transitAlert}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── Your chart at a glance ─────────────────────────────────── */}
      {(ascendant || moonSign || sunSign || currentDasha) && (
        <section className="border-b border-[rgba(26,20,16,0.10)]">
          <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
            <p className="text-[11px] uppercase tracking-[0.24em] text-primary-700 font-semibold mb-1">
              Your chart
            </p>
            <h2 className="font-display text-2xl sm:text-3xl text-surface-950 mb-8">
              The four corners
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {ascendant && (
                <ChartCard
                  eyebrow="Ascendant (Lagna)"
                  headline={ascendant}
                  subline={`Lord: ${SIGN_LORD[ascendant] ?? '—'}`}
                  note={ASCENDANT_NOTE[ascendant]}
                  accent="amber"
                />
              )}
              {moonSign && (
                <ChartCard
                  eyebrow="Moon (Rāśi)"
                  headline={moonSign}
                  subline={nakshatra ? `${nakshatra} nakshatra` : `Lord: ${SIGN_LORD[moonSign] ?? '—'}`}
                  note="How you feel, what soothes you, the inner weather."
                  accent="slate"
                />
              )}
              {sunSign && (
                <ChartCard
                  eyebrow="Sun (Sūrya)"
                  headline={sunSign}
                  subline={`Lord: ${SIGN_LORD[sunSign] ?? '—'}`}
                  note="The role you're here to play; the steady light."
                  accent="primary"
                />
              )}
              {currentDasha && (
                <ChartCard
                  eyebrow="Current Mahādaśā"
                  headline={currentDasha.planet}
                  subline={
                    currentAntardasha
                      ? `${currentDasha.planet} – ${currentAntardasha.planet} now, until ${new Date(currentAntardasha.endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
                      : `Through ${new Date(currentDasha.endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
                  }
                  note={`The chapter ${currentDasha.planet} is writing in your life right now.`}
                  accent={planetAccent(currentDasha.planet)}
                  toneText={PLANET_TONE[currentDasha.planet] ?? 'text-surface-950'}
                />
              )}
            </div>

            <Link
              href="/kundli"
              className="mt-6 inline-flex items-center gap-2 text-sm text-primary-700 hover:text-primary-600 font-medium"
            >
              See the full chart → houses, planets, yogas, doshas
            </Link>
          </div>
        </section>
      )}

      {/* ─── Compact features dock ───────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
          <p className="text-[11px] uppercase tracking-[0.24em] text-primary-700 font-semibold mb-1">
            Go deeper
          </p>
          <h2 className="font-display text-2xl sm:text-3xl text-surface-950 mb-6">
            Explore your Vedic toolkit
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {cfg.features.map((f) => {
              const label = readLabel(t, f.labelKey, f.slug);
              if (!f.available) {
                return (
                  <div key={f.slug} className="px-4 py-3 rounded-lg bg-[#fbf7ec] border border-[rgba(26,20,16,0.10)] opacity-50 cursor-not-allowed">
                    <div className="flex items-center gap-3">
                      <span className="text-primary-600/60"><FeatureGlyph slug={f.slug} size={18} /></span>
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
                  <span className="text-primary-700 group-hover:scale-110 transition-transform">
                    <FeatureGlyph slug={f.slug} size={18} />
                  </span>
                  <span className="text-sm font-medium text-emphasis group-hover:text-surface-950 truncate flex-1">{label}</span>
                  <span className="text-primary-700/0 group-hover:text-primary-700 transition-colors text-xs">→</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function SkyStat({ label, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className={`p-4 rounded-xl border ${tone === 'warn' ? 'bg-amber-500/8 border-amber-500/25' : 'bg-[#fbf7ec] border-[rgba(26,20,16,0.10)]'}`}>
      <p className="text-[10px] uppercase tracking-[0.18em] text-[rgba(12,8,5,0.55)] mb-1.5 font-medium">{label}</p>
      <p className={`font-display text-lg sm:text-xl leading-tight ${tone === 'warn' ? 'text-amber-800' : 'text-surface-950'}`}>{value}</p>
    </div>
  );
}

function ChartCard({
  eyebrow, headline, subline, note, accent, toneText,
}: {
  eyebrow: string; headline: string; subline?: string; note?: string;
  accent: 'amber' | 'slate' | 'primary' | 'indigo' | 'yellow' | 'red' | 'pink' | 'emerald' | 'purple';
  toneText?: string;
}) {
  const accentBg: Record<string, string> = {
    amber: 'from-amber-500/10', slate: 'from-slate-500/10', primary: 'from-primary-500/10',
    indigo: 'from-indigo-500/10', yellow: 'from-yellow-500/10', red: 'from-red-500/10',
    pink: 'from-pink-500/10', emerald: 'from-emerald-500/10', purple: 'from-purple-500/10',
  };
  const accentRule: Record<string, string> = {
    amber: 'bg-amber-500', slate: 'bg-slate-500', primary: 'bg-primary-500',
    indigo: 'bg-indigo-500', yellow: 'bg-yellow-500', red: 'bg-red-500',
    pink: 'bg-pink-500', emerald: 'bg-emerald-500', purple: 'bg-purple-500',
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

function planetAccent(planet: string): 'amber' | 'slate' | 'primary' | 'indigo' | 'yellow' | 'red' | 'pink' | 'emerald' | 'purple' {
  const map: Record<string, 'amber' | 'slate' | 'primary' | 'indigo' | 'yellow' | 'red' | 'pink' | 'emerald' | 'purple'> = {
    Sun: 'amber', Moon: 'slate', Mars: 'red', Mercury: 'emerald',
    Jupiter: 'yellow', Venus: 'pink', Saturn: 'indigo',
    Rahu: 'purple', Ketu: 'slate',
  };
  return map[planet] ?? 'primary';
}

function readLabel(t: any, path: string, fallback: string): string {
  const parts = path.split('.');
  let node: any = t;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in node) node = node[part];
    else return fallback;
  }
  return typeof node === 'string' ? node : fallback;
}