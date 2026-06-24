"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { usePricingConfig } from "@/lib/usePricingConfig";
import { useTranslation } from "@/i18n";
import { Skeleton, SkeletonLines } from "@/components/ui/Skeleton";
import { Star, Briefcase, Heart, Coins, Hand, CalendarDays, FileText, X, Download, Eye } from "lucide-react";

interface ReportSection {
  title: string;
  content: string;
  order: number;
}

interface Report {
  id: string;
  type: string;
  title: string;
  status: string;
  summary: string;
  sections?: ReportSection[];
  pdfUrl?: string | null;
  creditsCharged: number;
  createdAt: string;
}

export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();
  const { isAuthenticated, accessToken } = useAuthStore();
  const isHydrated = useAuthHydrated();
  const pricing = usePricingConfig();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<"generate" | "history">("generate");
  // In-app viewer: holds the fully-loaded report (with sections) being read.
  const [viewing, setViewing] = useState<Report | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

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
      // 402 → the user hasn't paid for this report yet. Send them to
      // checkout; on success they return with ?unlocked=<type> and we
      // auto-generate.
      if (err?.status === 402) {
        router.push(`/checkout?type=report&pack=${type}`);
        return;
      }
      setError(err.message || t.reports.reportFailed);
    } finally {
      setGenerating(null);
    }
  };

  // Returning from a successful checkout (?unlocked=<TYPE>): generate the
  // just-purchased report once, then strip the query param so a refresh
  // doesn't re-trigger it.
  useEffect(() => {
    if (!isHydrated || !isAuthenticated) return;
    const unlocked = searchParams.get("unlocked");
    if (!unlocked) return;
    const type = unlocked.toUpperCase();
    router.replace("/reports");
    handleGenerate(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, isAuthenticated]);

  // Open the in-app reader. The list endpoint omits `sections` (and the
  // legacy `pdfUrl` is actually a JSON blob, not a file), so we fetch the
  // full report by id, which always returns the section content.
  const handleView = async (report: Report) => {
    setOpening(report.id);
    setError("");
    try {
      const full = await api.get<Report>(`/reports/${report.id}`, { token: accessToken! });
      setViewing(full);
    } catch {
      setError(t.reports.viewFailed);
    } finally {
      setOpening(null);
    }
  };

  // Build a downloadable text file from the report sections, client-side.
  // (There is no server-rendered PDF; the prior "Download PDF" linked to a
  // JSON string and always failed.)
  const handleDownload = (report: Report) => {
    const sections = report.sections ?? [];
    const body = sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((s) => `${s.title}\n${"-".repeat(s.title.length)}\n${s.content}`)
      .join("\n\n");
    const text = `${report.title}\n${"=".repeat(report.title.length)}\n\n${body}\n`;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.type.toLowerCase()}-report.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed" || s === "ready") return "bg-emerald-100 text-emerald-800";
    if (s === "generating") return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-800";
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
          <p className="text-[rgba(12,8,5,0.66)] max-w-xl mx-auto">
            {t.reports.subtitle}
          </p>
          {pricing.reportsDelivered !== null && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {pricing.reportsDelivered.toLocaleString("en-IN")} personalized reports delivered
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 rounded-xl bg-[rgba(255,252,245,0.78)] p-1 w-fit">
          {(["generate", "history"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveView(tab)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeView === tab ? "btn-primary text-white" : "text-[rgba(12,8,5,0.66)] hover:text-surface-950"}`}>
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
                <p className="text-sm text-[rgba(12,8,5,0.66)] mb-4">{rt.desc}</p>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleGenerate(rt.id)}
                    disabled={generating === rt.id}
                    className="px-4 py-2 rounded-xl btn-primary text-sm text-white font-medium  transition-all disabled:opacity-50"
                  >
                    {generating === rt.id
                      ? t.reports.generating
                      : pricing.subscriptionsEnabled || pricing.freeMode
                        ? t.reports.generate
                        : `${t.reports.generate} · ₹${pricing.reportPrice}`}
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
                <p className="text-[rgba(12,8,5,0.66)] mb-4">{t.reports.noReports}</p>
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
                      <p className="text-sm text-[rgba(12,8,5,0.66)]">{report.summary}</p>
                      <p className="text-xs text-[rgba(12,8,5,0.66)] mt-1">
                        {t.reports.generatedOn} {new Date(report.createdAt).toLocaleDateString(locale === "en" ? "en-IN" : locale)}
                      </p>
                    </div>
                    {(report.status.toLowerCase() === "completed" ||
                      report.status.toLowerCase() === "ready") && (
                      <button
                        onClick={() => handleView(report)}
                        disabled={opening === report.id}
                        className="px-4 py-2 rounded-xl btn-secondary text-sm text-primary-400 hover:bg-[rgba(12,8,5,0.06)] transition-all shrink-0 inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Eye size={15} strokeWidth={1.8} aria-hidden />
                        {opening === report.id ? t.common.loading : t.reports.view}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* In-app report reader */}
      {viewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={viewing.title}
          onClick={() => setViewing(null)}
        >
          <div
            className="surface-card relative flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden p-0"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header — title, download and close stay put while the
                report body scrolls beneath them. */}
            <div className="flex items-center justify-between gap-3 border-b border-[rgba(12,8,5,0.08)] px-6 py-4 sm:px-8">
              <h2 className="min-w-0 flex-1 truncate text-xl font-bold text-surface-950">{viewing.title}</h2>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handleDownload(viewing)}
                  className="px-3 py-2 rounded-xl btn-primary text-sm text-white font-medium inline-flex items-center gap-1.5"
                >
                  <Download size={15} strokeWidth={1.8} aria-hidden />
                  <span className="hidden sm:inline">{t.reports.download}</span>
                </button>
                <button
                  onClick={() => setViewing(null)}
                  aria-label={t.common.close}
                  className="rounded-lg p-1.5 text-[rgba(12,8,5,0.72)] hover:bg-[rgba(12,8,5,0.06)] hover:text-surface-950 transition-colors"
                >
                  <X size={20} strokeWidth={1.8} aria-hidden />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <div className="space-y-5">
                {(viewing.sections ?? [])
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((s) => (
                    <section key={s.order}>
                      <h3 className="font-semibold text-surface-950 mb-1.5">{s.title}</h3>
                      <p className="text-sm leading-relaxed text-[rgba(12,8,5,0.7)] whitespace-pre-line">
                        {s.content}
                      </p>
                    </section>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
