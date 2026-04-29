"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";

const LOCALE_MAP: Record<string, string> = {
  en: "en-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN", bn: "bn-IN", mr: "mr-IN",
  gu: "gu-IN", kn: "kn-IN", ml: "ml-IN", pa: "pa-IN", or: "or-IN", as: "as-IN",
};

interface AuspiciousTime {
  date: string;
  startTime: string;
  endTime: string;
  quality: "excellent" | "good" | "average";
  reason: string;
}

interface MuhuratResult {
  purpose: string;
  auspiciousTimes: AuspiciousTime[];
}

export default function MuhuratPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();

  const purposes = [
    { id: "marriage", label: t.muhurat.marriage, icon: "💒" },
    { id: "business", label: t.muhurat.businessStart, icon: "🏢" },
    { id: "travel", label: t.muhurat.travel, icon: "✈️" },
    { id: "property", label: t.muhurat.property, icon: "🏠" },
    { id: "vehicle", label: t.muhurat.vehicle, icon: "🚗" },
    { id: "education", label: t.muhurat.education, icon: "📚" },
    { id: "puja", label: t.muhurat.puja, icon: "🪔" },
    { id: "housewarming", label: t.muhurat.housewarming, icon: "🏡" },
  ];
  const [selectedPurpose, setSelectedPurpose] = useState("marriage");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [location, setLocation] = useState("");
  const [result, setResult] = useState<MuhuratResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!fromDate || !toDate || !location.trim()) {
      setError(t.muhurat.fillAllFields);
      return;
    }

    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await api.post<MuhuratResult>(
        "/astrology/muhurat",
        { purpose: selectedPurpose, fromDate, toDate, location, locale },
        { token: accessToken! }
      );
      setResult(data);
    } catch (err: any) {
      setError(err.message || t.muhurat.findFailed);
    } finally {
      setLoading(false);
    }
  };

  const qualityColor = (q: string) =>
    q === "excellent" ? "text-emerald-400 bg-emerald-500/10" : q === "good" ? "text-blue-400 bg-blue-500/10" : "text-amber-400 bg-amber-500/10";

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/3 w-80 h-80 bg-emerald-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/3 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-12 fade-in-up">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full btn-secondary text-sm text-surface-50/60 mb-4">
            <span className="text-lg">📅</span>
            {t.muhurat.badge}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            <span className="text-gradient">{t.muhurat.title}</span> {t.muhurat.titleHighlight}
          </h1>
          <p className="text-surface-50/40 max-w-xl mx-auto">
            {t.muhurat.description}
          </p>
        </div>

        {/* Purpose Selection */}
        <div className="surface-card p-6 mb-6">
          <h2 className="text-sm font-medium text-surface-50/40 mb-4">{t.muhurat.selectPurpose}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {purposes.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPurpose(p.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  selectedPurpose === p.id
                    ? "bg-white/[0.06] border border-white/[0.06] text-surface-50 border-primary-500/50"
                    : "text-surface-50/40 hover:text-surface-50 hover:bg-white/[0.03]"
                }`}
              >
                <span className="text-lg">{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range & Location */}
        <div className="surface-card p-6 mb-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-surface-50/30 mb-2">{t.muhurat.fromDate}</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl surface-input"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-50/30 mb-2">{t.muhurat.toDate}</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl surface-input"
              />
            </div>
            <div>
              <label className="block text-xs text-surface-50/30 mb-2">{t.muhurat.location}</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t.muhurat.locationPlaceholder}
                className="w-full px-4 py-3 rounded-xl surface-input"
              />
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="mt-6 w-full sm:w-auto px-8 py-3 rounded-xl btn-primary text-surface-50 font-medium  transition-all disabled:opacity-50"
          >
            {loading ? t.muhurat.finding : t.muhurat.findTimes}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div>
            <h2 className="text-xl font-bold text-gradient mb-4">
              {t.muhurat.resultsFor} {purposes.find((p) => p.id === selectedPurpose)?.label}
            </h2>

            {result.auspiciousTimes.length === 0 ? (
              <div className="surface-card p-8 text-center text-surface-50/30">
                {t.muhurat.noResults}
              </div>
            ) : (
              <div className="space-y-4">
                {result.auspiciousTimes.map((time, i) => (
                  <div key={i} className="surface-card p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-lg font-bold text-surface-50">
                            {new Date(time.date).toLocaleDateString(LOCALE_MAP[locale] || "en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${qualityColor(time.quality)}`}>
                            {time.quality === "excellent" ? t.muhurat.qualityExcellent : time.quality === "good" ? t.muhurat.qualityGood : t.muhurat.qualityAverage}
                          </span>
                        </div>
                        <p className="text-sm text-primary-400 font-medium mb-1">
                          {time.startTime} - {time.endTime}
                        </p>
                        <p className="text-sm text-surface-50/40">{time.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
