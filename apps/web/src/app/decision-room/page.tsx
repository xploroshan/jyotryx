"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import {
  translateTithi,
  translateNakshatra,
  translateYoga,
  translateVara,
  translateTimeRange,
} from "@/i18n/panchang-terms";
import { ShowYourWork, type ChartFactor } from "@/components/transparency/ShowYourWork";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import {
  ACTIVITIES,
  CITIES,
  LOCALE_MAP,
  REC_STYLES,
  todayISO,
  type Activity,
  type Recommendation,
} from "@/lib/electional";
import { Scale } from "lucide-react";

interface TimingDecision {
  activity: string;
  date: string;
  time: string | null;
  location: string;
  score: number;
  recommendation: Recommendation;
  factors: ChartFactor[];
  panchang: {
    tithi: string;
    nakshatra: string;
    yoga: string;
    vara: string;
    rahuKaal: string;
    sunrise: string;
    sunset: string;
  };
}

export default function DecisionRoomPage() {
  const { t, locale } = useTranslation();

  const [activity, setActivity] = useState<string>("marriage");
  const [date, setDate] = useState<string>(todayISO());
  const [time, setTime] = useState<string>("");
  const [cityIndex, setCityIndex] = useState<number>(0);
  const [result, setResult] = useState<TimingDecision | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const city = CITIES[cityIndex];
      const res = await api.post<TimingDecision>("/astrology/timing-decision", {
        activity,
        date,
        ...(time ? { time } : {}),
        latitude: city.lat,
        longitude: city.lng,
        location: city.name,
        locale,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.decisionRoom.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  const rec = result ? REC_STYLES[result.recommendation] : null;

  const panchangItems = result
    ? [
        { label: t.panchang.tithi, value: translateTithi(result.panchang.tithi, locale) },
        { label: t.panchang.nakshatraLabel, value: translateNakshatra(result.panchang.nakshatra, locale) },
        { label: t.panchang.yoga, value: translateYoga(result.panchang.yoga, locale) },
        { label: t.panchang.vara, value: translateVara(result.panchang.vara, locale) },
        { label: t.panchang.rahuKaal, value: translateTimeRange(result.panchang.rahuKaal, locale) },
        { label: t.panchang.sunrise, value: translateTimeRange(result.panchang.sunrise, locale) },
        { label: t.panchang.sunset, value: translateTimeRange(result.panchang.sunset, locale) },
      ]
    : [];

  return (
    <div>
      <FeatureHeader
        tint="amber"
        eyebrow={t.decisionRoom.badge}
        eyebrowIcon={<Scale size={18} strokeWidth={1.8} aria-hidden />}
        headline={`${t.decisionRoom.title} {em}${t.decisionRoom.titleHighlight}{/em}`}
        tagline={t.decisionRoom.subtitle}
      />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:py-14 fade-in-up">
        {/* ── Query form ── */}
        <form onSubmit={handleSubmit} className="surface-card p-6 sm:p-8 mb-8 space-y-5">
          <div>
            <label htmlFor="dr-activity" className="block text-sm font-medium text-[rgba(12,8,5,0.55)] mb-1.5">
              {t.decisionRoom.occasionLabel}
            </label>
            <select
              id="dr-activity"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="w-full rounded-xl border border-[rgba(12,8,5,0.12)] bg-[rgba(255,252,245,0.78)] px-4 py-2.5 text-surface-950 focus-ring"
            >
              {ACTIVITIES.map((a) => (
                <option key={a} value={a}>
                  {t.decisionRoom.activities[a]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="dr-date" className="block text-sm font-medium text-[rgba(12,8,5,0.55)] mb-1.5">
                {t.decisionRoom.dateLabel}
              </label>
              <input
                id="dr-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-xl border border-[rgba(12,8,5,0.12)] bg-[rgba(255,252,245,0.78)] px-4 py-2.5 text-surface-950 focus-ring"
              />
            </div>
            <div>
              <label htmlFor="dr-time" className="block text-sm font-medium text-[rgba(12,8,5,0.55)] mb-1.5">
                {t.decisionRoom.timeLabel}{" "}
                <span className="text-[rgba(12,8,5,0.40)] font-normal">({t.decisionRoom.timeOptional})</span>
              </label>
              <input
                id="dr-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-[rgba(12,8,5,0.12)] bg-[rgba(255,252,245,0.78)] px-4 py-2.5 text-surface-950 focus-ring"
              />
            </div>
          </div>

          <div>
            <label htmlFor="dr-city" className="block text-sm font-medium text-[rgba(12,8,5,0.55)] mb-1.5">
              {t.decisionRoom.locationLabel}
            </label>
            <select
              id="dr-city"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full btn-primary shadow-warm-lg px-6 py-3 font-semibold focus-ring disabled:opacity-60"
          >
            {loading ? t.decisionRoom.checking : t.decisionRoom.submit}
          </button>

          {error && (
            <p className="text-sm text-red-500 text-center" role="alert">
              {error}
            </p>
          )}
        </form>

        {/* ── Verdict ── */}
        {result && rec && (
          <div className="space-y-8">
            <div className={`surface-card p-6 sm:p-8 text-center ring-1 ${rec.ring}`}>
              <p className="text-xs uppercase tracking-[0.18em] text-[rgba(12,8,5,0.46)] mb-3">
                {t.decisionRoom.scoreLabel}
              </p>
              <p className={`font-display font-semibold leading-none ${rec.text}`} style={{ fontSize: "clamp(56px, 12vw, 88px)" }}>
                {result.score}
                <span className="text-2xl text-[rgba(12,8,5,0.40)] font-normal"> / 100</span>
              </p>
              <span className={`inline-block mt-4 text-sm font-semibold px-4 py-1.5 rounded-full ${rec.chip}`}>
                {t.decisionRoom.recommendation[result.recommendation]}
              </span>
              <p className="text-sm text-secondary mt-4">
                {t.decisionRoom.activities[result.activity as Activity]}
                {" · "}
                {new Date(result.date).toLocaleDateString(LOCALE_MAP[locale] || "en-IN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                {result.time ? ` · ${result.time}` : ""}
                {" · "}
                {result.location}
              </p>
            </div>

            {/* Panchang for the chosen moment */}
            <div>
              <h2 className="text-lg font-bold text-gradient mb-4">{t.decisionRoom.panchangTitle}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {panchangItems.map((item) => (
                  <div key={item.label} className="surface-card p-4">
                    <p className="text-xs text-[rgba(12,8,5,0.40)] mb-1">{item.label}</p>
                    <p className="text-sm font-semibold text-surface-950">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Show Your Work — the factors behind the verdict */}
            <ShowYourWork factors={result.factors} />

            <p className="text-xs text-[rgba(12,8,5,0.40)] text-center">{t.decisionRoom.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
