"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { useTranslation } from "@/i18n";
import { Skeleton, SkeletonLines } from "@/components/ui/Skeleton";
import { Stagger } from "@/components/ui/PageTransition";
import { Star, Briefcase, Heart, Coins, Hand, CalendarDays, FileText } from "lucide-react";

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
  const isHydrated = useAuthHydrated();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"generate" | "history">("generate");

  const reportTypes = [
    { id: "LIFE", label: t.reports.typeLifeName, icon: Star, desc: t.reports.typeLifeDesc, cost: 5 },
    { id: "CAREER", label: t.reports.typeCareerName, icon: Briefcase, desc: t.reports.typeCareerDesc, cost: 5 },
    { id: "MARRIAGE", label: t.reports.typeMarriageName, icon: Heart, desc: t.reports.typeMarriageDesc, cost: 5 },
    { id: "WEALTH", label: t.reports.typeWealthName, icon: Coins, desc: t.reports.typeWealthDesc, cost: 5 },
    { id: "PALM", label: t.reports.typePalmName, icon: Hand, desc: t.reports.typePalmDesc, cost: 5 },
    { id: "ANNUAL", label: t.reports.typeAnnualName, icon: CalendarDays, desc: t.reports.typeAnnualDesc, cost: 5 },
  ];

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.push("/auth");
      return;
    }
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, isAuthenticated]);

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
    <div className="relative min-h-screen overflow-x-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{background: "radial-gradient(ellipse 80% 40% at 50% 0%, rgba(255,182,39,0.14) 0%, rgba(255,77,0,0.06) 35%, transparent 70%)"}} />
      <div className="absolute top-32 left-1/3 w-80 h-80 bg-violet-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/3 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-12 fade-in-up">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full btn-secondary text-sm text-secondary mb-4">
            <FileText size={18} strokeWidth={1.7} aria-hidden />
            {t.reports.badge}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {t.reports.titlePart1} <span className="text-gradient">{t.reports.titleHighlight}</span>
          </h1>
          <p className="text-[rgba(12,8,5,0.46)] max-w-xl mx-auto">
            {t.reports.subtitle}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 rounded-xl bg-[rgba(255,252,245,0.78)] p-1 w-fit">
          {(["generate", "history"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveView(tab)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === tab ? "btn-primary text-white" : "text-[rgba(12,8,5,0.46)] hover:text-surface-950"}`}>
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
                <rt.icon size={30} strokeWidth={1.6} className="mb-3 text-primary-700" aria-hidden />
                <h3 className="text-lg font-bold text-surface-950 mb-2">{rt.label}</h3>
                <p className="text-sm text-[rgba(12,8,5,0.46)] mb-4">{rt.desc}</p>
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
              <div className="space-y-4" aria-busy="true" aria-live="polite">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="surface-card p-6">
                    <Skeleton rounded="rounded-lg" className="h-4 w-1/3 mb-3" />
                    <SkeletonLines count={2} />
                  </div>
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="surface-card p-12 text-center">
                <p className="text-[rgba(12,8,5,0.40)] mb-4">{t.reports.noReports}</p>
                <button onClick={() => setActiveView("generate")} className="px-6 py-2 rounded-xl btn-secondary text-sm text-primary-400 hover:bg-[rgba(12,8,5,0.06)]">
                  {t.reports.firstReport}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} className="surface-card p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {(() => { const RIcon = reportTypes.find((r) => r.id === report.type)?.icon ?? FileText; return <RIcon size={18} strokeWidth={1.7} className="text-primary-700" aria-hidden />; })()}
                        <h3 className="font-bold text-surface-950">{report.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(report.status)}`}>{report.status}</span>
                      </div>
                      <p className="text-sm text-[rgba(12,8,5,0.46)]">{report.summary}</p>
                      <p className="text-xs text-[rgba(12,8,5,0.32)] mt-1">
                        {t.reports.generatedOn} {new Date(report.createdAt).toLocaleDateString(locale === "en" ? "en-IN" : locale)}
                      </p>
                    </div>
                    {report.pdfUrl && (
                      <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl btn-secondary text-sm text-primary-400 hover:bg-[rgba(12,8,5,0.06)] transition-all shrink-0">
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
