"use client";

import React, { useState } from "react";
import type { Locale, TranslationKeys } from "@/i18n";
import { translatePlanet, translateActivity } from "./translations";
import { translateTimeRange } from "@/i18n/panchang-terms";

interface PlanetaryHour {
  planet: string;
  startTime: string;
  endTime: string;
  activities: string[];
  avoid: string[];
  isCurrent: boolean;
}

const planetIcons: Record<string, { symbol: string; color: string; bg: string }> = {
  Sun: { symbol: "\u2609", color: "text-amber-400", bg: "bg-amber-500/10" },
  Moon: { symbol: "\u263d", color: "text-slate-300", bg: "bg-slate-400/10" },
  Mars: { symbol: "\u2642", color: "text-red-400", bg: "bg-red-500/10" },
  Mercury: { symbol: "\u263f", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  Jupiter: { symbol: "\u2643", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  Venus: { symbol: "\u2640", color: "text-pink-400", bg: "bg-pink-500/10" },
  Saturn: { symbol: "\u2644", color: "text-indigo-400", bg: "bg-indigo-500/10" },
};

export function PlanetaryHoursSection({
  planetaryHours,
  t,
  locale,
}: {
  planetaryHours: PlanetaryHour[];
  t: TranslationKeys;
  locale: Locale;
}) {
  const [showAllHours, setShowAllHours] = useState(false);
  const currentIdx = planetaryHours.findIndex((h) => h.isCurrent);
  const visibleHours = showAllHours
    ? planetaryHours
    : planetaryHours.filter((_, i) => i >= Math.max(0, currentIdx - 1) && i <= currentIdx + 4);

  return (
    <div className="mb-8 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">{t.myDay.planetaryHours}</h3>
        <button
          onClick={() => setShowAllHours(!showAllHours)}
          className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
        >
          {showAllHours ? t.myDay.showRelevant : t.myDay.viewAll24}
        </button>
      </div>
      <div className="space-y-1.5">
        {visibleHours.map((hour, i) => {
          const pi = planetIcons[hour.planet] || { symbol: "\u25cb", color: "text-white/60", bg: "bg-white/[0.04]" };
          return (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                hour.isCurrent
                  ? "bg-primary-600/10 ring-1 ring-primary-500/25"
                  : "hover:bg-white/[0.02]"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg ${pi.bg} flex items-center justify-center shrink-0`}>
                <span className={`text-sm ${pi.color}`}>{pi.symbol}</span>
              </div>
              <span className={`text-sm font-medium w-16 ${pi.color}`}>{translatePlanet(hour.planet, t)}</span>
              <span className="text-xs text-white/25 w-28 tabular-nums">
                {translateTimeRange(hour.startTime, locale)} – {translateTimeRange(hour.endTime, locale)}
              </span>
              <span className="text-xs text-white/40 flex-1 hidden sm:block">
                {hour.activities.slice(0, 2).map(a => translateActivity(a, t)).join(", ")}
              </span>
              {hour.isCurrent && (
                <span className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-500/15 text-primary-300">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-50" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-400" />
                  </span>
                  <span className="text-[10px] font-semibold tracking-wide">{t.myDay.now}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
