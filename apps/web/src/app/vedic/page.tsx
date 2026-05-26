'use client';

/**
 * Vedic tradition landing — editorial personal dashboard.
 *
 * The flagship dashboard: opens on the visitor's own chart summary
 * (ascendant, moon, sun, current mahadasha) pulled from a lazy
 * /astrology/kundli fetch, and a "Today's Sky" panel hydrated from
 * the daily-briefing API. Both are cached client-side so revisits
 * paint instantly.
 *
 * Built on top of the shared TraditionDashboard shell — the same
 * shell the other five tradition landings use, with Vedic just
 * filling in a richer personalContent slot.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore, useAuthHydrated } from '@/lib/store';
import TraditionDashboard, {
  SectionHead,
  MiniStat,
  FactCard,
} from '@/components/tradition/TraditionDashboard';
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
    // Stale after 7 days — placements are stable; refresh weekly to
    // catch dasha rollovers.
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

const SIGN_LORD: Record<string, string> = {
  Aries: 'Mars', Taurus: 'Venus', Gemini: 'Mercury', Cancer: 'Moon',
  Leo: 'Sun', Virgo: 'Mercury', Libra: 'Venus', Scorpio: 'Mars',
  Sagittarius: 'Jupiter', Capricorn: 'Saturn', Aquarius: 'Saturn', Pisces: 'Jupiter',
};

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

const PLANET_TONE: Record<string, string> = {
  Sun: 'text-amber-700', Moon: 'text-slate-700', Mars: 'text-red-700',
  Mercury: 'text-emerald-700', Jupiter: 'text-yellow-700',
  Venus: 'text-pink-700', Saturn: 'text-indigo-700',
  Rahu: 'text-purple-700', Ketu: 'text-stone-700',
};

function planetAccent(planet: string) {
  const map: Record<string, 'amber' | 'slate' | 'primary' | 'indigo' | 'yellow' | 'red' | 'pink' | 'emerald' | 'purple'> = {
    Sun: 'amber', Moon: 'slate', Mars: 'red', Mercury: 'emerald',
    Jupiter: 'yellow', Venus: 'pink', Saturn: 'indigo',
    Rahu: 'purple', Ketu: 'slate',
  };
  return map[planet] ?? 'primary';
}

export default function VedicDashboardPage() {
  const { user, accessToken, isAuthenticated } = useAuthStore();
  const isHydrated = useAuthHydrated();

  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [kundli, setKundli] = useState<KundliSummary | null>(null);
  const [kundliLoading, setKundliLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const cachedBriefing = readBriefingCacheSync();
    if (cachedBriefing) setBriefing(cachedBriefing);
    const cachedKundli = readKundliCache(user.id);
    if (cachedKundli) setKundli(cachedKundli);
  }, [user?.id]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !accessToken) return;
    api
      .get<DailyBriefing>('/daily-briefing?locale=en', { token: accessToken })
      .then((data) => {
        setBriefing(data);
        if (user?.id) writeBriefingCache(user.id, 'en', data);
      })
      .catch(() => {
        /* keep showing the cache */
      });
  }, [isHydrated, isAuthenticated, accessToken, user?.id]);

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
        /* form-driven fallback at /kundli */
      })
      .finally(() => setKundliLoading(false));
  }, [isHydrated, isAuthenticated, accessToken, user, kundli, kundliLoading]);

  const firstName = user?.name?.split(' ')[0];
  const ascendant = kundli?.ascendant;
  const moonSign = kundli?.moonSign;
  const sunSign = kundli?.sunSign;
  const nakshatra = kundli?.nakshatra;
  const currentDasha = kundli?.dashas?.[0];
  const today = new Date();
  const currentAntardasha = currentDasha?.subPeriods?.find((s) => {
    const start = new Date(s.startDate);
    const end = new Date(s.endDate);
    return today >= start && today <= end;
  });

  const headline = firstName
    ? `${firstName}'s {em}Vedic chart{/em}`
    : `Your {em}Vedic chart{/em}`;

  const metaLine = user?.placeOfBirth
    ? user.placeOfBirth
      + (user.dateOfBirth ? ` · ${new Date(user.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : '')
      + (user.timeOfBirth ? ` · ${user.timeOfBirth}` : '')
    : undefined;

  const chips = [
    ascendant ? { label: `${ascendant} Ascendant`, tone: 'text-amber-300' } : null,
    moonSign ? { label: `${moonSign} Moon`, tone: 'text-white/85' } : null,
    currentDasha ? { label: `${currentDasha.planet} Mahādaśā`, tone: 'text-yellow-300' } : null,
  ].filter(Boolean) as { label: string; tone: string }[];

  const heroCta = !user?.dateOfBirth
    ? { label: 'Add birth details to see your chart', href: '/profile?complete=1' }
    : undefined;

  const hasChart = !!(ascendant || moonSign || sunSign || currentDasha);

  return (
    <TraditionDashboard
      traditionId="VEDIC"
      headline={headline}
      metaLine={metaLine}
      chips={chips.length > 0 ? chips : undefined}
      heroCta={heroCta}
      personalContent={
        <>
          {briefing && (
            <section className="border-b border-[rgba(26,20,16,0.10)]">
              <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
                <SectionHead
                  eyebrow="Today's sky"
                  title={new Date(briefing.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                  tone="text-amber-700"
                  trailing={
                    <Link href="/my-day" className="text-xs text-primary-700 hover:text-primary-600 font-medium hidden sm:inline">
                      Full briefing →
                    </Link>
                  }
                />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <MiniStat label="Tithi" value={briefing.panchang?.tithi ?? '—'} />
                  <MiniStat label="Nakshatra" value={briefing.panchang?.nakshatra ?? '—'} />
                  <MiniStat label="Yoga" value={briefing.panchang?.yoga ?? '—'} />
                  <MiniStat label="Rāhu Kāl" value={briefing.panchang?.rahukaal ?? '—'} tone="warn" />
                </div>

                {briefing.transitAlert && (
                  <div className="mt-5 px-4 py-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-900/80 italic font-display">
                    {briefing.transitAlert}
                  </div>
                )}
              </div>
            </section>
          )}

          {hasChart && (
            <section className="border-b border-[rgba(26,20,16,0.10)]">
              <div className="mx-auto max-w-6xl px-5 sm:px-8 py-10 sm:py-12">
                <SectionHead
                  eyebrow="Your chart"
                  title="The four corners"
                  tone="text-amber-700"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  {ascendant && (
                    <FactCard
                      eyebrow="Ascendant (Lagna)"
                      headline={ascendant}
                      subline={`Lord: ${SIGN_LORD[ascendant] ?? '—'}`}
                      note={ASCENDANT_NOTE[ascendant]}
                      accent="amber"
                    />
                  )}
                  {moonSign && (
                    <FactCard
                      eyebrow="Moon (Rāśi)"
                      headline={moonSign}
                      subline={nakshatra ? `${nakshatra} nakshatra` : `Lord: ${SIGN_LORD[moonSign] ?? '—'}`}
                      note="How you feel, what soothes you, the inner weather."
                      accent="slate"
                    />
                  )}
                  {sunSign && (
                    <FactCard
                      eyebrow="Sun (Sūrya)"
                      headline={sunSign}
                      subline={`Lord: ${SIGN_LORD[sunSign] ?? '—'}`}
                      note="The role you're here to play; the steady light."
                      accent="primary"
                    />
                  )}
                  {currentDasha && (
                    <FactCard
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
        </>
      }
    />
  );
}
