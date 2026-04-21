"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";

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
  const { t, locale } = useTranslation();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"generate" | "history">("generate");

  const reportTypes = [
    { id: "LIFE", label: t.reports.typeLifeName, icon: "🌟", desc: t.reports.typeLifeDesc, cost: 5 },
    { id: "CAREER", label: t.reports.typeCareerName, icon: "💼", desc: t.reports.typeCareerDesc, cost: 5 },
    { id: "MARRIAGE", label: t.reports.typeMarriageName, icon: "💒", desc: t.reports.typeMarriageDesc, cost: 5 },
    { id: "WEALTH", label: t.reports.typeWealthName, icon: "💰", desc: t.reports.typeWealthDesc, cost: 5 },
    { id: "PALM", label: t.reports.typePalmName, icon: "🤚", desc: t.reports.typePalmDesc, cost: 5 },
    { id: "ANNUAL", label: t.reports.typeAnnualName, icon: "📅", desc: t.reports.typeAnnualDesc, cost: 5 },
  ];

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        { type, locale },
        { token: accessToken! }
      );
      setReports((prev) => [res, ...prev]);
      setActiveView("history");
    } catch (err: any) {
      setError(err.message || t.reports.reportFailed);
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full btn-secondary text-sm text-white/60 mb-4">
            <span className="text-lg">📄</span>
            {t.reports.badge}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {t.reports.titlePart1} <span className="text-gradient">{t.reports.titleHighlight}</span>
          </h1>
          <p className="text-white/40 max-w-xl mx-auto">
            {t.reports.subtitle}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 rounded-xl bg-white/[0.03] p-1 w-fit">
          {(["generate", "history"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveView(tab)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === tab ? "btn-primary text-white" : "text-white/40 hover:text-white"}`}>
              {tab === "generate" ? t.reports.generateNew : `${t.reports.myReports} (${reports.length})`}
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
              <div key={rt.id} className="surface-card p-6">
                <span className="text-3xl block mb-3">{rt.icon}</span>
                <h3 className="text-lg font-bold text-white mb-2">{rt.label}</h3>
                <p className="text-sm text-white/40 mb-4">{rt.desc}</p>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleGenerate(rt.id)}
                    disabled={generating === rt.id}
                    className="px-4 py-2 rounded-xl btn-primary text-sm text-white font-medium  transition-all disabled:opacity-50"
                  >
                    {generating === rt.id ? t.reports.generating : t.reports.generate}
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
              <div className="surface-card p-12 text-center">
                <p className="text-white/30 mb-4">{t.reports.noReports}</p>
                <button onClick={() => setActiveView("generate")} className="px-6 py-2 rounded-xl btn-secondary text-sm text-primary-400 hover:bg-white/[0.1]">
                  {t.reports.firstReport}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="surface-card p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{reportTypes.find((r) => r.id === report.type)?.icon || "📄"}</span>
                        <h3 className="font-bold text-white">{report.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(report.status)}`}>{report.status}</span>
                      </div>
                      <p className="text-sm text-white/40">{report.summary}</p>
                      <p className="text-xs text-white/20 mt-1">
                        {t.reports.generatedOn} {new Date(report.createdAt).toLocaleDateString(locale === "en" ? "en-IN" : locale)}
                      </p>
                    </div>
                    {report.pdfUrl && (
                      <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl btn-secondary text-sm text-primary-400 hover:bg-white/[0.1] transition-all shrink-0">
                        {t.reports.downloadPdf}
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
