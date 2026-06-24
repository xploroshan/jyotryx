"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import { FeatureGlyph } from "@/components/icons";
import { Heart, Building2, Plane, Home, Car, GraduationCap, Flame, DoorOpen } from "lucide-react";

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
    { id: "marriage", label: t.muhurat.marriage, icon: Heart },
    { id: "business", label: t.muhurat.businessStart, icon: Building2 },
    { id: "travel", label: t.muhurat.travel, icon: Plane },
    { id: "property", label: t.muhurat.property, icon: Home },
    { id: "vehicle", label: t.muhurat.vehicle, icon: Car },
    { id: "education", label: t.muhurat.education, icon: GraduationCap },
    { id: "puja", label: t.muhurat.puja, icon: Flame },
    { id: "housewarming", label: t.muhurat.housewarming, icon: DoorOpen },
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
    <div>
      <FeatureHeader
        tint="sky"
        eyebrow={t.muhurat.badge}
        eyebrowIcon={<FeatureGlyph slug="muhurat" size={18} />}
        headline={`{em}${t.muhurat.title}{/em} ${t.muhurat.titleHighlight}`}
        tagline={t.muhurat.description}
      />

      <div className="relative mx-auto max-w-5xl px-4 py-10 sm:py-14 fade-in-up">
        {/* Purpose Selection */}
        <div className="surface-card p-6 mb-6">
          <h2 className="text-sm font-medium text-[rgba(12,8,5,0.66)] mb-4">{t.muhurat.selectPurpose}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {purposes.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPurpose(p.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  selectedPurpose === p.id
                    ? "bg-[rgba(255,252,245,0.92)] border border-[rgba(12,8,5,0.08)] text-surface-950 border-primary-500/50"
                    : "text-[rgba(12,8,5,0.66)] hover:text-surface-950 hover:bg-[rgba(255,252,245,0.78)]"
                }`}
              >
                <p.icon size={20} strokeWidth={1.7} className="text-primary-700" aria-hidden />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range & Location */}
        <div className="surface-card p-6 mb-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[rgba(12,8,5,0.66)] mb-2">{t.muhurat.fromDate}</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl surface-input"
              />
            </div>
            <div>
              <label className="block text-xs text-[rgba(12,8,5,0.66)] mb-2">{t.muhurat.toDate}</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl surface-input"
              />
            </div>
            <div>
              <label className="block text-xs text-[rgba(12,8,5,0.66)] mb-2">{t.muhurat.location}</label>
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
            className="mt-6 w-full sm:w-auto px-8 py-3 rounded-xl btn-primary text-white font-medium  transition-all disabled:opacity-50"
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
              <div className="surface-card p-8 text-center text-[rgba(12,8,5,0.66)]">
                {t.muhurat.noResults}
              </div>
            ) : (
              <div className="space-y-4">
                {result.auspiciousTimes.map((time, i) => (
                  <div key={i} className="surface-card p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-lg font-bold text-surface-950">
                            {new Date(time.date).toLocaleDateString(LOCALE_MAP[locale] || "en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${qualityColor(time.quality)}`}>
                            {time.quality === "excellent" ? t.muhurat.qualityExcellent : time.quality === "good" ? t.muhurat.qualityGood : t.muhurat.qualityAverage}
                          </span>
                        </div>
                        <p className="text-sm text-primary-400 font-medium mb-1">
                          {time.startTime} - {time.endTime}
                        </p>
                        <p className="text-sm text-[rgba(12,8,5,0.66)]">{time.reason}</p>
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
