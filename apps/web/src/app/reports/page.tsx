"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const reportTypes = [
  { id: "LIFE", label: "Life Analysis", icon: "🌟", desc: "Comprehensive life path analysis based on your birth chart", cost: 5 },
  { id: "CAREER", label: "Career Outlook", icon: "💼", desc: "Professional growth and career trajectory predictions", cost: 5 },
  { id: "MARRIAGE", label: "Marriage Report", icon: "💒", desc: "Marriage compatibility and timing predictions", cost: 5 },
  { id: "WEALTH", label: "Wealth Forecast", icon: "💰", desc: "Financial outlook and wealth accumulation insights", cost: 5 },
  { id: "PALM", label: "Palmistry Report", icon: "🤚", desc: "Detailed palm reading analysis document", cost: 5 },
  { id: "ANNUAL", label: "Annual Horoscope", icon: "📅", desc: "Complete yearly forecast for all life areas", cost: 5 },
];

interface Report {
  id: string;
  type: string;
  title: string;
  status: string;
  summary: string;
  pdfUrl?: string | null;
  creditsCharged: number;
  createdAt: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, user } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"generate" | "history">("generate");

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    loadReports();
  }, [isAuthenticated]);

  const loadReports = async () => {
    try {
      const data = await api.get<Report[]>("/reports", { token: accessToken! });
      setReports(data);
    } catch {
      // User may not have any reports yet
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (type: string) => {
    setGenerating(type);
    setError("");
    try {
      const res = await api.post<Report>(
        "/reports/generate",
        { type },
        { token: accessToken! }
      );
      setReports((prev) => [res, ...prev]);
      setActiveView("history");
    } catch (err: any) {
      setError(err.message || "Failed to generate report. You may need more credits.");
    } finally {
      setGenerating(null);
    }
  };

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed" || s === "ready") return "bg-emerald-500/20 text-emerald-400";
    if (s === "generating") return "bg-amber-500/20 text-amber-400";
    return "bg-red-500/20 text-red-400";
  };

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/3 w-80 h-80 bg-violet-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/3 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm text-gray-300 mb-4">
            <span className="text-lg">📄</span>
            Astrology Reports
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4">
            Your <span className="text-gradient">Reports</span>
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Generate detailed astrology reports based on your birth chart. 5 credits per report.
          </p>
        </div>

        {/* Credit Info */}
        <div className="glass-card p-4 mb-6 flex items-center justify-between">
          <span className="text-sm text-gray-400">Available Credits</span>
          <span className="text-lg font-bold text-gradient">{user?.credits ?? 0}</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 rounded-xl bg-white/5 p-1 w-fit">
          {(["generate", "history"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveView(tab)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === tab ? "bg-gradient-to-r from-primary-600 to-mystic-600 text-white" : "text-gray-400 hover:text-white"}`}>
              {tab === "generate" ? "Generate New" : `My Reports (${reports.length})`}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {/* Generate View */}
        {activeView === "generate" && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTypes.map((rt) => (
              <div key={rt.id} className="glass-card p-6">
                <span className="text-3xl block mb-3">{rt.icon}</span>
                <h3 className="text-lg font-display font-bold text-white mb-2">{rt.label}</h3>
                <p className="text-sm text-gray-400 mb-4">{rt.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-accent-400">{rt.cost} credits</span>
                  <button
                    onClick={() => handleGenerate(rt.id)}
                    disabled={generating === rt.id}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary-600 to-mystic-600 text-sm text-white font-medium hover:from-primary-500 hover:to-mystic-500 transition-all disabled:opacity-50"
                  >
                    {generating === rt.id ? "Generating..." : "Generate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History View */}
        {activeView === "history" && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : reports.length === 0 ? (
              <div className="glass-card p-12 text-center">
                <p className="text-gray-500 mb-4">No reports generated yet</p>
                <button onClick={() => setActiveView("generate")} className="px-6 py-2 rounded-xl glass text-sm text-primary-400 hover:bg-white/10">
                  Generate Your First Report
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="glass-card p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{reportTypes.find((r) => r.id === report.type)?.icon || "📄"}</span>
                        <h3 className="font-display font-bold text-white">{report.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(report.status)}`}>{report.status}</span>
                      </div>
                      <p className="text-sm text-gray-400">{report.summary}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Generated {new Date(report.createdAt).toLocaleDateString()} | {report.creditsCharged} credits
                      </p>
                    </div>
                    {report.pdfUrl && (
                      <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl glass text-sm text-primary-400 hover:bg-white/10 transition-all shrink-0">
                        Download PDF
                      </a>
                    )}
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
