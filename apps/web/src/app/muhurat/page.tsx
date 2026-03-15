"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";

const purposes = [
  { id: "marriage", label: "Marriage", icon: "💒" },
  { id: "business", label: "Business Start", icon: "🏢" },
  { id: "travel", label: "Travel", icon: "✈️" },
  { id: "property", label: "Property Purchase", icon: "🏠" },
  { id: "vehicle", label: "Vehicle Purchase", icon: "🚗" },
  { id: "education", label: "Education", icon: "📚" },
  { id: "puja", label: "Puja / Ceremony", icon: "🪔" },
  { id: "housewarming", label: "Housewarming", icon: "🏡" },
];

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
  const router = useRouter();
  const { accessToken, isAuthenticated } = useAuthStore();
  const [selectedPurpose, setSelectedPurpose] = useState("marriage");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [location, setLocation] = useState("");
  const [result, setResult] = useState<MuhuratResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!fromDate || !toDate || !location.trim()) {
      setError("Please fill in all fields");
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
        { purpose: selectedPurpose, fromDate, toDate, location },
        { token: accessToken! }
      );
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to find auspicious times. Please try again.");
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

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-gray-300 mb-4">
            <span className="text-lg">📅</span>
            Auspicious Timing
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
            <span className="text-gradient">Muhurat</span> Finder
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Find the most auspicious dates and times for important events based on Vedic astrology.
          </p>
        </div>

        {/* Purpose Selection */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm font-medium text-gray-400 mb-4">Select Purpose</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {purposes.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedPurpose(p.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  selectedPurpose === p.id
                    ? "glass bg-white/10 text-white border-primary-500/50"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="text-lg">{p.icon}</span>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range & Location */}
        <div className="glass-card p-6 mb-6">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-2">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Mumbai, India"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="mt-6 w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-white font-medium hover:from-primary-500 hover:to-mystic-500 transition-all disabled:opacity-50"
          >
            {loading ? "Finding Muhurat..." : "Find Auspicious Times"}
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
            <h2 className="text-xl font-display font-bold text-gradient mb-4">
              Auspicious Times for {purposes.find((p) => p.id === selectedPurpose)?.label}
            </h2>

            {result.auspiciousTimes.length === 0 ? (
              <div className="glass-card p-8 text-center text-gray-500">
                No auspicious times found in the selected date range. Try a wider range.
              </div>
            ) : (
              <div className="space-y-4">
                {result.auspiciousTimes.map((time, i) => (
                  <div key={i} className="glass-card p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-lg font-display font-bold text-white">
                            {new Date(time.date).toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${qualityColor(time.quality)}`}>
                            {time.quality.charAt(0).toUpperCase() + time.quality.slice(1)}
                          </span>
                        </div>
                        <p className="text-sm text-primary-400 font-medium mb-1">
                          {time.startTime} - {time.endTime}
                        </p>
                        <p className="text-sm text-gray-400">{time.reason}</p>
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
