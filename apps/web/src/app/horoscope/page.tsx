"use client";

import React, { useState } from "react";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/lib/store";
import { Skeleton, SkeletonLines } from "@/components/ui/Skeleton";

interface HoroscopeData {
  overview: string;
  love: string;
  career: string;
  health: string;
  lucky: { number: string; color: string; time: string };
}

interface MultiTraditionData {
  summary: string;
  traditions: Record<string, HoroscopeData>;
}

const CHINESE_ANIMALS = [
  { id: "rat", name: "Rat", symbol: "\uD83D\uDC00", years: "2024, 2012, 2000, 1988", element: "Water" },
  { id: "ox", name: "Ox", symbol: "\uD83D\uDC02", years: "2021, 2009, 1997, 1985", element: "Earth" },
  { id: "tiger", name: "Tiger", symbol: "\uD83D\uDC05", years: "2022, 2010, 1998, 1986", element: "Wood" },
  { id: "rabbit", name: "Rabbit", symbol: "\uD83D\uDC07", years: "2023, 2011, 1999, 1987", element: "Wood" },
  { id: "dragon", name: "Dragon", symbol: "\uD83D\uDC09", years: "2024, 2012, 2000, 1988", element: "Earth" },
  { id: "snake", name: "Snake", symbol: "\uD83D\uDC0D", years: "2025, 2013, 2001, 1989", element: "Fire" },
  { id: "horse", name: "Horse", symbol: "\uD83D\uDC0E", years: "2026, 2014, 2002, 1990", element: "Fire" },
  { id: "goat", name: "Goat", symbol: "\uD83D\uDC10", years: "2027, 2015, 2003, 1991", element: "Earth" },
  { id: "monkey", name: "Monkey", symbol: "\uD83D\uDC12", years: "2028, 2016, 2004, 1992", element: "Metal" },
  { id: "rooster", name: "Rooster", symbol: "\uD83D\uDC13", years: "2029, 2017, 2005, 1993", element: "Metal" },
  { id: "dog", name: "Dog", symbol: "\uD83D\uDC15", years: "2030, 2018, 2006, 1994", element: "Earth" },
  { id: "pig", name: "Pig", symbol: "\uD83D\uDC16", years: "2031, 2019, 2007, 1995", element: "Water" },
];

type TraditionSlug = 'vedic' | 'western' | 'chinese' | 'hellenistic' | 'horary' | 'medical';
const TRADITION_I18N_KEY: Record<string, TraditionSlug> = {
  VEDIC: 'vedic',
  WESTERN: 'western',
  CHINESE: 'chinese',
  HELLENISTIC: 'hellenistic',
  HORARY: 'horary',
  MEDICAL: 'medical',
};

const TRADITION_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  VEDIC: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  WESTERN: { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/30" },
  CHINESE: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  HELLENISTIC: { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30" },
  HORARY: { text: "text-teal-400", bg: "bg-teal-500/10", border: "border-teal-500/30" },
  MEDICAL: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
};

export default function HoroscopePage() {
  const { t, locale } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const userTraditions: string[] = user?.astrologyTraditions?.length ? user.astrologyTraditions : ["VEDIC", "WESTERN", "CHINESE", "HELLENISTIC", "HORARY", "MEDICAL"];
  const isMultiTradition = userTraditions.length > 1;
  const [activeTradition, setActiveTradition] = useState(userTraditions[0] || "VEDIC");
  const [showSummary, setShowSummary] = useState(false);

  const zodiacSigns = [
    { id: "aries", name: t.horoscope.aries, symbol: "\u2648", date: t.horoscope.zdAries, element: t.horoscope.fire },
    { id: "taurus", name: t.horoscope.taurus, symbol: "\u2649", date: t.horoscope.zdTaurus, element: t.horoscope.earth },
    { id: "gemini", name: t.horoscope.gemini, symbol: "\u264A", date: t.horoscope.zdGemini, element: t.horoscope.air },
    { id: "cancer", name: t.horoscope.cancer, symbol: "\u264B", date: t.horoscope.zdCancer, element: t.horoscope.water },
    { id: "leo", name: t.horoscope.leo, symbol: "\u264C", date: t.horoscope.zdLeo, element: t.horoscope.fire },
    { id: "virgo", name: t.horoscope.virgo, symbol: "\u264D", date: t.horoscope.zdVirgo, element: t.horoscope.earth },
    { id: "libra", name: t.horoscope.libra, symbol: "\u264E", date: t.horoscope.zdLibra, element: t.horoscope.air },
    { id: "scorpio", name: t.horoscope.scorpio, symbol: "\u264F", date: t.horoscope.zdScorpio, element: t.horoscope.water },
    { id: "sagittarius", name: t.horoscope.sagittarius, symbol: "\u2650", date: t.horoscope.zdSagittarius, element: t.horoscope.fire },
    { id: "capricorn", name: t.horoscope.capricorn, symbol: "\u2651", date: t.horoscope.zdCapricorn, element: t.horoscope.earth },
    { id: "aquarius", name: t.horoscope.aquarius, symbol: "\u2652", date: t.horoscope.zdAquarius, element: t.horoscope.air },
    { id: "pisces", name: t.horoscope.pisces, symbol: "\u2653", date: t.horoscope.zdPisces, element: t.horoscope.water },
  ];

  const periods = [
    { id: "daily", label: t.horoscope.daily },
    { id: "weekly", label: t.horoscope.weekly },
    { id: "monthly", label: t.horoscope.monthly },
    { id: "yearly", label: t.horoscope.yearly },
  ];

  const isChinese = activeTradition === "CHINESE";
  const signList = isChinese ? CHINESE_ANIMALS : zodiacSigns;
  const defaultSign = isChinese ? "rat" : "aries";

  const [selectedSign, setSelectedSign] = useState("aries");
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const [horoscope, setHoroscope] = useState<HoroscopeData | null>(null);
  const [summaryData, setSummaryData] = useState<MultiTraditionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const currentSign = isChinese
    ? CHINESE_ANIMALS.find((a) => a.id === selectedSign) || CHINESE_ANIMALS[0]
    : zodiacSigns.find((s) => s.id === selectedSign) || zodiacSigns[0];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    if (showSummary) {
      fetchMultiTradition();
    } else {
      fetchHoroscope();
    }
  }, [selectedSign, selectedPeriod, activeTradition, showSummary]);

  const handleTraditionSwitch = (tradition: string) => {
    const wasChinese = activeTradition === "CHINESE";
    const nowChinese = tradition === "CHINESE";
    setShowSummary(false);
    setActiveTradition(tradition);
    if (wasChinese !== nowChinese) {
      setSelectedSign(nowChinese ? "rat" : "aries");
    }
  };

  const handleShowSummary = () => {
    setShowSummary(true);
  };

  const fetchHoroscope = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/astrology/horoscope/${selectedSign}?period=${selectedPeriod}&locale=${locale}&tradition=${activeTradition}`
      );
      if (!res.ok) throw new Error(t.horoscope.fetchFailed);
      const data = await res.json();

      const periodLabel =
        selectedPeriod === "daily" ? t.horoscope.today
        : selectedPeriod === "weekly" ? t.horoscope.thisWeek
        : selectedPeriod === "monthly" ? t.horoscope.thisMonth
        : t.horoscope.thisYear;

      setHoroscope({
        overview: data.prediction || t.horoscope.unavailable,
        love: data.love || `${data.compatibility || t.horoscope.defaultCompatibleSign} - ${periodLabel}`,
        career: data.career || `${data.mood || ""} - ${periodLabel}`,
        health: data.health || `${periodLabel}`,
        lucky: {
          number: String(data.luckyNumber || "7"),
          color: data.luckyColor || t.horoscope.defaultLuckyColor,
          time: selectedPeriod === "daily" ? t.horoscope.defaultLuckyTime : t.horoscope.variesByDay,
        },
      });
      setSummaryData(null);
    } catch {
      setError(t.horoscope.loadFailed);
      setHoroscope(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchMultiTradition = async () => {
    setLoading(true);
    setError("");
    try {
      const traditionsParam = userTraditions.join(",");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/astrology/horoscope/${selectedSign}/multi?traditions=${traditionsParam}&period=${selectedPeriod}&locale=${locale}`
      );
      if (!res.ok) throw new Error(t.horoscope.fetchFailed);
      const data = await res.json();

      const traditions: Record<string, HoroscopeData> = {};
      if (data.traditions) {
        for (const [key, val] of Object.entries(data.traditions) as [string, any][]) {
          traditions[key] = {
            overview: val.prediction || val.overview || t.horoscope.unavailable,
            love: val.love || "",
            career: val.career || "",
            health: val.health || "",
            lucky: {
              number: String(val.luckyNumber || "7"),
              color: val.luckyColor || t.horoscope.defaultLuckyColor,
              time: t.horoscope.variesByDay,
            },
          };
        }
      }

      setSummaryData({
        summary: data.summary || data.combinedSummary || t.horoscope.unavailable,
        traditions,
      });
      setHoroscope(null);
    } catch {
      setError(t.horoscope.loadFailed);
      setSummaryData(null);
    } finally {
      setLoading(false);
    }
  };

  const elementColor = (el: string) =>
    el === t.horoscope.fire || el === "Fire" ? "text-red-400"
    : el === t.horoscope.earth || el === "Earth" ? "text-emerald-400"
    : el === t.horoscope.air || el === "Wood" ? "text-sky-400"
    : el === "Metal" ? "text-yellow-400"
    : "text-blue-400";

  const periodHeading =
    selectedPeriod === "daily" ? t.horoscope.dailyCap
    : selectedPeriod === "weekly" ? t.horoscope.weeklyCap
    : selectedPeriod === "monthly" ? t.horoscope.monthlyCap
    : t.horoscope.yearlyCap;

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/10 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/3 w-80 h-80 bg-accent-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/3 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 fade-in-up">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full surface-card text-sm text-white/60 mb-4">
            <span className="text-lg">{currentSign.symbol}</span>
            {t.horoscope.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            {t.horoscope.title} <span className="text-gradient">{t.horoscope.titleHighlight}</span>
          </h1>
          <p className="text-white/40 max-w-xl mx-auto">
            {t.horoscope.description}
          </p>
        </div>

        {/* Tradition Tabs - only shown when user has multiple traditions */}
        {isMultiTradition && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex gap-1 rounded-xl bg-white/[0.03] p-1">
              {userTraditions.map((trad) => {
                const colors = TRADITION_COLORS[trad] || TRADITION_COLORS.VEDIC;
                const isActive = !showSummary && activeTradition === trad;
                return (
                  <button
                    key={trad}
                    onClick={() => handleTraditionSwitch(trad)}
                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? `${colors.bg} ${colors.text} ${colors.border} border`
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {TRADITION_I18N_KEY[trad] ? t.traditionsUi[TRADITION_I18N_KEY[trad]].name : trad}
                  </button>
                );
              })}
              <button
                onClick={handleShowSummary}
                className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  showSummary
                    ? "btn-primary text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {t.traditions.summary}
              </button>
            </div>
          </div>
        )}

        {/* Sign Grid - conditionally shows zodiac or Chinese animals */}
        {!showSummary && (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 mb-8">
              {signList.map((z) => (
                <button
                  key={z.id}
                  onClick={() => setSelectedSign(z.id)}
                  className={`flex flex-col items-center py-3 px-2 rounded-xl transition-all ${
                    selectedSign === z.id
                      ? "surface-card bg-white/[0.06] border-primary-500/50"
                      : "hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="text-2xl mb-1">{z.symbol}</span>
                  <span className={`text-xs font-medium ${selectedSign === z.id ? "text-white" : "text-white/40"}`}>
                    {z.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Selected Sign Info */}
            <div className="surface-card p-6 mb-8 flex flex-col sm:flex-row items-center gap-4">
              <div className="text-4xl">{currentSign.symbol}</div>
              <div className="text-center sm:text-left">
                <h2 className="text-xl font-bold text-white">{currentSign.name}</h2>
                <div className="flex flex-wrap gap-3 mt-1 justify-center sm:justify-start">
                  {isChinese ? (
                    <>
                      <span className="text-sm text-white/40">{(currentSign as typeof CHINESE_ANIMALS[0]).years}</span>
                      <span className={`text-sm font-medium ${elementColor((currentSign as typeof CHINESE_ANIMALS[0]).element)}`}>
                        {(currentSign as typeof CHINESE_ANIMALS[0]).element}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-white/40">{(currentSign as typeof zodiacSigns[0]).date}</span>
                      <span className={`text-sm font-medium ${elementColor((currentSign as typeof zodiacSigns[0]).element)}`}>
                        {(currentSign as typeof zodiacSigns[0]).element}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="sm:ml-auto">
                {/* Period Tabs */}
                <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1">
                  {periods.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPeriod(p.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                        selectedPeriod === p.id
                          ? "btn-primary text-white"
                          : "text-white/40 hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Summary Mode: Period selector when in summary view */}
        {showSummary && (
          <div className="flex justify-center mb-8">
            <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriod(p.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                    selectedPeriod === p.id
                      ? "btn-primary text-white"
                      : "text-white/40 hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid sm:grid-cols-2 gap-4" aria-busy="true" aria-live="polite">
            <div className="surface-card p-6">
              <Skeleton rounded="rounded-lg" className="h-4 w-24 mb-4" />
              <SkeletonLines count={4} />
            </div>
            <div className="surface-card p-6">
              <Skeleton rounded="rounded-lg" className="h-4 w-24 mb-4" />
              <SkeletonLines count={4} />
            </div>
            <div className="surface-card p-6 sm:col-span-2">
              <Skeleton rounded="rounded-lg" className="h-4 w-32 mb-4" />
              <SkeletonLines count={3} />
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-12">
            <div className="inline-block p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
              <p className="text-red-400">{error}</p>
            </div>
            <br />
            <button onClick={showSummary ? fetchMultiTradition : fetchHoroscope} className="mt-4 px-6 py-2 rounded-xl btn-secondary text-sm text-primary-400">
              {t.horoscope.retry}
            </button>
          </div>
        )}

        {/* Single Tradition Horoscope Content */}
        {horoscope && !loading && !error && !showSummary && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Overview */}
            <div className="lg:col-span-2 surface-card p-6">
              <h3 className="text-lg font-bold text-gradient mb-4">
                {periodHeading} {t.horoscope.overview}
              </h3>
              <p className="text-white/60 leading-relaxed">{horoscope.overview}</p>
            </div>

            {/* Lucky */}
            <div className="surface-card p-6">
              <h3 className="text-lg font-bold text-accent-400 mb-4">{t.horoscope.luckyFactors}</h3>
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-white/30 mb-1">{t.horoscope.luckyNumbers}</p>
                  <p className="text-white font-semibold">{horoscope.lucky.number}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-white/30 mb-1">{t.horoscope.luckyColor}</p>
                  <p className="text-white font-semibold">{horoscope.lucky.color}</p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03]">
                  <p className="text-xs text-white/30 mb-1">{t.horoscope.auspiciousTime}</p>
                  <p className="text-white font-semibold">{horoscope.lucky.time}</p>
                </div>
              </div>
            </div>

            {/* Love */}
            <div className="surface-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-bold text-white">{t.horoscope.loveRelationships}</h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{horoscope.love}</p>
            </div>

            {/* Career */}
            <div className="surface-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-bold text-white">{t.horoscope.careerFinance}</h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{horoscope.career}</p>
            </div>

            {/* Health */}
            <div className="surface-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="font-bold text-white">{t.horoscope.healthWellness}</h3>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{horoscope.health}</p>
            </div>
          </div>
        )}

        {/* Multi-Tradition Summary View */}
        {summaryData && !loading && !error && showSummary && (
          <div className="space-y-6">
            {/* Combined Summary Card */}
            <div className="surface-card p-6 border border-primary-500/20">
              <h3 className="text-lg font-bold text-gradient mb-4">
                {t.traditions.summary}
              </h3>
              <p className="text-white/60 leading-relaxed">{summaryData.summary}</p>
            </div>

            {/* Individual tradition insights */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(summaryData.traditions).map(([tradKey, tradData]) => {
                const colors = TRADITION_COLORS[tradKey] || TRADITION_COLORS.VEDIC;
                return (
                  <div key={tradKey} className={`surface-card p-6 border ${colors.border}`}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        {TRADITION_I18N_KEY[tradKey] ? t.traditionsUi[TRADITION_I18N_KEY[tradKey]].name : tradKey}
                      </span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed mb-3">{tradData.overview}</p>
                    {tradData.love && (
                      <div className="mb-2">
                        <span className="text-xs text-white/30">{t.horoscope.loveRelationships}:</span>
                        <p className="text-xs text-white/50">{tradData.love}</p>
                      </div>
                    )}
                    {tradData.career && (
                      <div className="mb-2">
                        <span className="text-xs text-white/30">{t.horoscope.careerFinance}:</span>
                        <p className="text-xs text-white/50">{tradData.career}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
