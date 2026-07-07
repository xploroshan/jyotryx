"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";
import {
  translateTithi,
  translateNakshatra,
  translateYoga,
  translateVara,
  translateTimeRange,
} from "@/i18n/panchang-terms";
import {
  ACTIVITIES,
  CITIES,
  LOCALE_MAP,
  REC_CELL,
  REC_STYLES,
  type Activity,
  type Recommendation,
} from "@/lib/electional";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import Interpretation from "@/components/interpretation/Interpretation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface CosmicDay {
  date: string;
  weekday: number;
  tithi: string;
  nakshatra: string;
  yoga: string;
  vara: string;
  rahuKaal: string;
  score: number;
  recommendation: Recommendation;
}

interface CosmicResult {
  year: number;
  month: number;
  activity: string;
  location: string;
  days: CosmicDay[];
}

const REC_ORDER: Recommendation[] = ["excellent", "good", "neutral", "caution", "avoid"];

export default function CosmicCalendarPage() {
  const { t, locale } = useTranslation();
  const intlLocale = LOCALE_MAP[locale] || "en-IN";

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1–12
  const [activity, setActivity] = useState<Activity>("general");
  const [cityIndex, setCityIndex] = useState(0);
  const [data, setData] = useState<CosmicResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<CosmicDay | null>(null);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      const city = CITIES[cityIndex];
      const res = await api.get<CosmicResult>(
        `/astrology/cosmic-calendar?year=${year}&month=${month}&activity=${activity}` +
          `&lat=${city.lat}&lng=${city.lng}&location=${encodeURIComponent(city.name)}`,
      );
      setData(res);
    } catch {
      setError(t.cosmicCalendar.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [year, month, activity, cityIndex, t.cosmicCalendar.loadFailed]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const shiftMonth = (delta: number) => {
    const m0 = month - 1 + delta; // 0-based
    const newYear = year + Math.floor(m0 / 12);
    const newMonth = ((m0 % 12) + 12) % 12 + 1;
    setYear(newYear);
    setMonth(newMonth);
  };

  // Localized weekday headers (2024-01-07 is a Sunday).
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 7 + i)).toLocaleDateString(intlLocale, { weekday: "short" }),
  );

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(intlLocale, {
    month: "long",
    year: "numeric",
  });

  const leadingBlanks = data && data.days.length > 0 ? data.days[0].weekday : 0;

  return (
    <div>
      <FeatureHeader
        tint="amber"
        eyebrow={t.cosmicCalendar.badge}
        eyebrowIcon={<CalendarDays size={18} strokeWidth={1.8} aria-hidden />}
        headline={`${t.cosmicCalendar.title} {em}${t.cosmicCalendar.titleHighlight}{/em}`}
        tagline={t.cosmicCalendar.subtitle}
      />

      <div className="relative mx-auto max-w-4xl px-4 py-10 sm:py-14 fade-in-up">
        {/* ── Controls ── */}
        <div className="surface-card p-5 sm:p-6 mb-6 grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cc-activity" className="block text-sm font-medium text-[rgba(12,8,5,0.72)] mb-1.5">
              {t.cosmicCalendar.occasionLabel}
            </label>
            <select
              id="cc-activity"
              value={activity}
              onChange={(e) => setActivity(e.target.value as Activity)}
              className="w-full rounded-xl border border-[rgba(12,8,5,0.12)] bg-[rgba(255,252,245,0.78)] px-4 py-2.5 text-surface-950 focus-ring"
            >
              {ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {t.decisionRoom.activities[a]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cc-city" className="block text-sm font-medium text-[rgba(12,8,5,0.72)] mb-1.5">
              {t.cosmicCalendar.locationLabel}
            </label>
            <select
              id="cc-city"
              value={cityIndex}
              onChange={(e) => setCityIndex(Number(e.target.value))}
              className="w-full rounded-xl border border-[rgba(12,8,5,0.12)] bg-[rgba(255,252,245,0.78)] px-4 py-2.5 text-surface-950 focus-ring"
            >
              {CITIES.map((c, i) => (
                <option key={c.name} value={i}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Month navigation ── */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label={t.cosmicCalendar.prevMonth}
            className="p-2 rounded-full btn-ghost focus-ring text-surface-950"
          >
            <ChevronLeft size={20} aria-hidden />
          </button>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-surface-950">{monthLabel}</h2>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label={t.cosmicCalendar.nextMonth}
            className="p-2 rounded-full btn-ghost focus-ring text-surface-950"
          >
            <ChevronRight size={20} aria-hidden />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <button onClick={fetchCalendar} className="px-6 py-2 rounded-xl btn-secondary text-sm">
              {t.panchang.retry}
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {weekdayLabels.map((w, i) => (
                <div key={i} className="text-center text-[11px] uppercase tracking-wide text-[rgba(12,8,5,0.66)] py-1">
                  {w}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`b-${i}`} aria-hidden />
              ))}
              {data.days.map((d) => {
                const day = Number(d.date.slice(-2));
                const isSel = selected?.date === d.date;
                return (
                  <button
                    key={d.date}
                    type="button"
                    onClick={() => setSelected(d)}
                    aria-pressed={isSel}
                    className={`aspect-square rounded-xl p-1.5 flex flex-col items-center justify-center transition-colors focus-ring ${REC_CELL[d.recommendation]} ${
                      isSel ? "ring-2 ring-surface-950/40" : ""
                    }`}
                    title={`${day} · ${d.score}/100`}
                  >
                    <span className="text-sm font-semibold leading-none">{day}</span>
                    <span className="text-[10px] tabular-nums opacity-70 mt-0.5">{d.score}</span>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 justify-center">
              {REC_ORDER.map((r) => (
                <span key={r} className="inline-flex items-center gap-1.5 text-[11px] text-[rgba(12,8,5,0.72)]">
                  <span className={`inline-block h-3 w-3 rounded ${REC_CELL[r].split(" ")[0]}`} aria-hidden />
                  {t.decisionRoom.recommendation[r]}
                </span>
              ))}
            </div>

            {/* Selected-day detail */}
            {selected && (
              <div className={`surface-card p-6 mt-6 ring-1 ${REC_STYLES[selected.recommendation].ring}`}>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                  <p className="font-display text-lg font-semibold text-surface-950">
                    {new Date(selected.date).toLocaleDateString(intlLocale, {
                      timeZone: "UTC",
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${REC_STYLES[selected.recommendation].chip}`}>
                    {t.decisionRoom.recommendation[selected.recommendation]} · {selected.score}/100
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Detail label={t.panchang.tithi} value={translateTithi(selected.tithi, locale)} />
                  <Detail label={t.panchang.nakshatraLabel} value={translateNakshatra(selected.nakshatra, locale)} />
                  <Detail label={t.panchang.yoga} value={translateYoga(selected.yoga, locale)} />
                  <Detail label={t.panchang.vara} value={translateVara(selected.vara, locale)} />
                  <Detail label={t.panchang.rahuKaal} value={translateTimeRange(selected.rahuKaal, locale)} />
                </div>
                <Link
                  href="/decision-room"
                  className="inline-block mt-5 text-sm font-semibold text-primary-600 hover:text-primary-700 focus-ring rounded"
                >
                  {t.cosmicCalendar.openDecisionRoom} →
                </Link>
              </div>
            )}

            {selected && (
              <Interpretation
                domain="cosmic-calendar"
                className="mt-6 sm:mt-8"
                input={{
                  date: selected.date,
                  activity: data.activity,
                  location: data.location,
                  recommendation: selected.recommendation,
                  score: selected.score,
                  tithi: selected.tithi,
                  nakshatra: selected.nakshatra,
                  yoga: selected.yoga,
                  vara: selected.vara,
                  rahuKaal: selected.rahuKaal,
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[rgba(255,252,245,0.78)] px-4 py-3 border border-[rgba(12,8,5,0.06)]">
      <p className="text-xs text-[rgba(12,8,5,0.66)] mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-surface-950">{value}</p>
    </div>
  );
}
