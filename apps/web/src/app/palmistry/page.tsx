"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import PalmDiagram from "@/components/palmistry/PalmDiagram";
import CameraCapture from "@/components/palmistry/CameraCapture";
import { useTranslation } from "@/i18n";
import { Toast } from "@/components/ui/Toast";

interface SpecialMarking {
  name: string;
  location: string;
  interpretation: string;
}

interface TimingInsight {
  ageRange: string;
  area: string;
  description: string;
}

interface HandShape {
  type: string;
  description: string;
}

interface AnalysisResult {
  majorLines: { name: string; description: string; strength: "strong" | "moderate" | "weak" }[];
  minorLines: { name: string; description: string; strength?: "strong" | "moderate" | "weak" }[];
  mounts: { name: string; description: string; prominence: "high" | "medium" | "low" }[];
  insights: { label: string; text: string }[];
  fingerAnalysis: { finger: string; interpretation: string; length?: string }[];
  specialMarkings: SpecialMarking[];
  timingInsights: TimingInsight[];
  handShape: HandShape | null;
  cautions: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_MIME = /^image\/(jpeg|jpg|png|webp|heic)$/i;
const POLL_INTERVAL_MS = 3000;
const POLL_MAX_ATTEMPTS = 40; // ~2 minutes

const MAJOR_LINE_KEYWORDS = ["heart", "head", "life", "fate", "sun"];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function isMajorLine(lineName: string): boolean {
  const normalized = normalizeName(lineName);
  return MAJOR_LINE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

type StrengthCode = "strong" | "moderate" | "weak";
function normalizeStrength(s: string): StrengthCode {
  const lower = (s || "").toLowerCase();
  if (lower === "strong" || lower === "prominent" || lower === "deep") return "strong";
  if (lower === "moderate" || lower === "medium" || lower === "normal" || lower === "average") return "moderate";
  return "weak";
}

type ProminenceCode = "high" | "medium" | "low";
function normalizeProminence(p: string): ProminenceCode {
  const lower = (p || "").toLowerCase();
  if (lower === "elevated" || lower === "high" || lower === "prominent") return "high";
  if (lower === "flat" || lower === "low" || lower === "underdeveloped") return "low";
  return "medium";
}

function mapAnalysis(result: any, t: any): AnalysisResult {
  const lines = Array.isArray(result?.lines) ? result.lines : [];
  const majorLines = lines
    .filter((l: any) => isMajorLine(l.name || ""))
    .map((l: any) => ({
      name: l.name,
      description: l.interpretation || l.description || "",
      strength: normalizeStrength(l.strength),
    }));
  const minorLines = lines
    .filter((l: any) => !isMajorLine(l.name || ""))
    .map((l: any) => ({
      name: l.name,
      description: l.interpretation || l.description || "",
      strength: l.strength ? normalizeStrength(l.strength) : undefined,
    }));

  const mounts = (Array.isArray(result?.mounts) ? result.mounts : []).map((mt: any) => ({
    name: mt.name,
    description: mt.interpretation || mt.description || "",
    prominence: normalizeProminence(mt.prominence),
  }));

  const insights: { label: string; text: string }[] = [];
  if (result?.overallReading) insights.push({ label: t.palmistry.insightOverall, text: result.overallReading });
  if (result?.healthInsights) insights.push({ label: t.palmistry.insightHealth, text: result.healthInsights });
  if (result?.careerInsights) insights.push({ label: t.palmistry.insightCareer, text: result.careerInsights });
  if (result?.relationshipInsights) insights.push({ label: t.palmistry.insightRelationships, text: result.relationshipInsights });
  if (result?.spiritualInsights) insights.push({ label: t.palmistry.insightSpirituality, text: result.spiritualInsights });

  const fingerAnalysis = (Array.isArray(result?.fingerAnalysis) ? result.fingerAnalysis : [])
    .filter((f: any) => f && f.interpretation)
    .map((f: any) => ({ finger: f.finger, interpretation: f.interpretation, length: f.length }));

  const specialMarkings: SpecialMarking[] = (Array.isArray(result?.specialMarkings) ? result.specialMarkings : [])
    .filter((m: any) => m && (m.name || m.interpretation))
    .map((m: any) => ({
      name: m.name || "",
      location: m.location || "",
      interpretation: m.interpretation || "",
    }));

  const timingInsights: TimingInsight[] = (Array.isArray(result?.timingInsights) ? result.timingInsights : [])
    .filter((ti: any) => ti && (ti.description || ti.ageRange))
    .map((ti: any) => ({
      ageRange: ti.ageRange || "",
      area: ti.area || "",
      description: ti.description || "",
    }));

  const handShape: HandShape | null = result?.handShape && (result.handShape.type || result.handShape.description)
    ? { type: result.handShape.type || "", description: result.handShape.description || "" }
    : null;

  return {
    majorLines,
    minorLines,
    mounts,
    insights,
    fingerAnalysis,
    specialMarkings,
    timingInsights,
    handShape,
    cautions: typeof result?.cautions === "string" ? result.cautions : "",
  };
}

function buildReportText(analysis: AnalysisResult, t: any): string {
  const lines: string[] = [];
  lines.push(`${t.palmistry.title} ${t.palmistry.titleHighlight}`);
  lines.push("=".repeat(40));
  lines.push("");

  if (analysis.handShape) {
    lines.push(`${t.palmistry.handShape}: ${analysis.handShape.type}`);
    if (analysis.handShape.description) lines.push(analysis.handShape.description);
    lines.push("");
  }

  if (analysis.insights.length) {
    for (const ins of analysis.insights) {
      lines.push(`-- ${ins.label} --`);
      lines.push(ins.text);
      lines.push("");
    }
  }

  if (analysis.majorLines.length) {
    lines.push(`-- ${t.palmistry.majorLines} --`);
    for (const l of analysis.majorLines) {
      lines.push(`${l.name} (${l.strength}): ${l.description}`);
    }
    lines.push("");
  }

  if (analysis.minorLines.length) {
    lines.push(`-- ${t.palmistry.minorLines} --`);
    for (const l of analysis.minorLines) {
      lines.push(`${l.name}: ${l.description}`);
    }
    lines.push("");
  }

  if (analysis.mounts.length) {
    lines.push(`-- ${t.palmistry.mounts} --`);
    for (const m of analysis.mounts) {
      lines.push(`${m.name} (${m.prominence}): ${m.description}`);
    }
    lines.push("");
  }

  if (analysis.fingerAnalysis.length) {
    lines.push(`-- ${t.palmistry.fingerAnalysis} --`);
    for (const f of analysis.fingerAnalysis) {
      const len = f.length ? ` [${f.length}]` : "";
      lines.push(`${f.finger}${len}: ${f.interpretation}`);
    }
    lines.push("");
  }

  if (analysis.specialMarkings.length) {
    lines.push(`-- ${t.palmistry.specialMarkings} --`);
    for (const m of analysis.specialMarkings) {
      lines.push(`${m.name} (${m.location}): ${m.interpretation}`);
    }
    lines.push("");
  }

  if (analysis.timingInsights.length) {
    lines.push(`-- ${t.palmistry.timingInsights} --`);
    for (const ti of analysis.timingInsights) {
      lines.push(`${ti.ageRange} — ${ti.area}: ${ti.description}`);
    }
    lines.push("");
  }

  if (analysis.cautions) {
    lines.push(`-- ${t.palmistry.cautions} --`);
    lines.push(analysis.cautions);
    lines.push("");
  }

  lines.push("");
  lines.push(t.palmistry.disclaimer);
  return lines.join("\n");
}

export default function PalmistryPage() {
  const { t, locale } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState("major");
  const [error, setError] = useState("");
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollAbortRef = useRef<{ cancelled: boolean } | null>(null);

  // Cancel any in-flight polling on unmount
  useEffect(() => {
    return () => {
      if (pollAbortRef.current) pollAbortRef.current.cancelled = true;
    };
  }, []);

  const handleFeatureSelect = useCallback(
    (feature: { type: "line" | "mount"; name: string }) => {
      setSelectedFeature(feature.name);
      if (feature.type === "mount") {
        setActiveTab("mounts");
      } else {
        setActiveTab(isMajorLine(feature.name) ? "major" : "minor");
      }
    },
    [],
  );

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME.test(file.type)) return t.palmistry.invalidFileType;
    if (file.size > MAX_FILE_SIZE) return t.palmistry.fileTooLarge;
    return null;
  };

  const handleFile = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setErrorRetryable(false);
      return;
    }
    setError("");
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setAnalysis(null);
    };
    reader.onerror = () => {
      setError(t.palmistry.invalidImage);
      setErrorRetryable(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleCameraCapture = (file: File) => {
    setShowCamera(false);
    handleFile(file);
  };

  const pollForResult = async (
    readingId: string,
    api: any,
  ): Promise<any | null> => {
    const token = { cancelled: false };
    pollAbortRef.current = token;
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      if (token.cancelled) return null;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      if (token.cancelled) return null;
      try {
        const res: { id: string; status: string; analysis?: any } = await api.get(
          `/palmistry/${readingId}/status`,
        );
        if (res?.status === "completed" && res.analysis) {
          return res.analysis;
        }
        if (res?.status === "failed") {
          throw new Error(t.palmistry.analysisFailed);
        }
      } catch (e: any) {
        // 5xx / network errors: keep polling, otherwise rethrow
        if (e?.status && e.status >= 400 && e.status < 500) throw e;
      }
    }
    throw new Error(t.palmistry.analysisTimeout);
  };

  const handleAnalyze = async () => {
    if (!imageFile) {
      setError(t.palmistry.uploadFirst);
      setErrorRetryable(false);
      return;
    }
    setAnalyzing(true);
    setError("");
    setErrorRetryable(false);
    setProgressMessage(t.palmistry.uploadingImage);
    try {
      const { useAuthStore } = await import("@/lib/store");
      if (!useAuthStore.getState().accessToken) {
        setError(t.palmistry.loginRequired);
        setAnalyzing(false);
        setProgressMessage("");
        return;
      }
      const { api } = await import("@/lib/api");
      const formData = new FormData();
      formData.append("image", imageFile);
      if (locale !== "en") formData.append("locale", locale);
      if (gender) formData.append("gender", gender);

      const initial = await api.upload<any>("/palmistry/analyze", formData);
      let result = initial;

      // If the backend queued the job, poll until it completes
      const queuedStatus =
        initial?.status === "processing" ||
        (Array.isArray(initial?.lines) && initial.lines.length === 0 && initial?.id);

      if (queuedStatus && initial?.id) {
        setProgressMessage(t.palmistry.processingMessage);
        result = await pollForResult(initial.id, api);
      }

      if (result) {
        setAnalysis(mapAnalysis(result, t));
      } else {
        setError(t.palmistry.noResultsError);
      }
    } catch (err: any) {
      setError(err.message || t.palmistry.analysisFailed);
      setErrorRetryable(
        Boolean(err?.isNetwork || err?.isTimeout) || (err?.status ?? 0) >= 500 || !err?.status,
      );
    } finally {
      setAnalyzing(false);
      setProgressMessage("");
    }
  };

  const handleDownload = () => {
    if (!analysis) return;
    try {
      const text = buildReportText(analysis, t);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `palmistry-report-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError(t.palmistry.downloadFailed);
      setErrorRetryable(false);
    }
  };

  const tabs = [
    { id: "major", label: t.palmistry.majorLines },
    { id: "minor", label: t.palmistry.minorLines },
    { id: "mounts", label: t.palmistry.mounts },
    { id: "insights", label: t.palmistry.insights },
    { id: "timing", label: t.palmistry.timingInsights },
    { id: "markings", label: t.palmistry.specialMarkings },
  ];

  const strengthColor = (s: "strong" | "moderate" | "weak") =>
    s === "strong" ? "text-emerald-400" : s === "moderate" ? "text-accent-400" : "text-white/40";

  const strengthLabel = (s: "strong" | "moderate" | "weak") =>
    s === "strong" ? t.palmistry.strengthStrong : s === "moderate" ? t.palmistry.strengthModerate : t.palmistry.strengthWeak;

  const prominenceLabel = (p: "high" | "medium" | "low") =>
    p === "high" ? t.palmistry.prominenceHigh : p === "medium" ? t.palmistry.prominenceMedium : t.palmistry.prominenceLow;

  const uploadHeading = gender === "male"
    ? t.palmistry.uploadRight
    : gender === "female"
      ? t.palmistry.uploadLeft
      : t.palmistry.uploadYour;

  const dragDropText = gender
    ? (gender === "male" ? t.palmistry.dragDropRight : t.palmistry.dragDropLeft)
    : t.palmistry.selectGenderFirst;

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/10 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/4 w-80 h-80 bg-accent-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/4 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 fade-in-up">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full surface-card text-sm text-white/60 mb-4">
            {t.palmistry.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            {t.palmistry.title} <span className="text-gradient">{t.palmistry.titleHighlight}</span>
          </h1>
          <p className="text-white/60 max-w-xl mx-auto">{t.palmistry.description}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Area */}
          <div className="space-y-6">
            {/* Step 1: Gender */}
            <div className="surface-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500/20 text-[10px] font-semibold text-primary-300">1</span>
                <h3 className="text-sm font-semibold text-white">{t.palmistry.selectGender}</h3>
              </div>
              <p className="text-xs text-white/60 mb-3">
                {gender === "male" ? t.palmistry.genderMaleNote : gender === "female" ? t.palmistry.genderFemaleNote : t.palmistry.genderDefaultNote}
              </p>
              <div role="radiogroup" aria-label={t.palmistry.selectGender} className="flex gap-3">
                <button
                  role="radio"
                  aria-checked={gender === "male"}
                  onClick={() => setGender("male")}
                  className={`focus-ring touch-target flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    gender === "male"
                      ? "btn-primary text-white"
                      : "bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {t.palmistry.male}
                </button>
                <button
                  role="radio"
                  aria-checked={gender === "female"}
                  onClick={() => setGender("female")}
                  className={`focus-ring touch-target flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    gender === "female"
                      ? "btn-primary text-white"
                      : "bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {t.palmistry.female}
                </button>
              </div>
            </div>

            {/* Step 2: Image */}
            <div className="surface-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-500/20 text-[10px] font-semibold text-primary-300">2</span>
                <h3 className="text-sm font-semibold text-white">{uploadHeading}</h3>
              </div>

              <div
                role="button"
                tabIndex={0}
                aria-label={uploadHeading}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileRef.current?.click();
                  }
                }}
                className={`focus-ring rounded-xl border-2 border-dashed border-white/10 p-6 flex flex-col items-center justify-center min-h-[320px] cursor-pointer transition-all ${
                  isDragging ? "border-primary-500 bg-primary-500/10" : "hover:bg-white/[0.04]"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0]);
                    if (e.target) e.target.value = "";
                  }}
                />

                {image ? (
                  <div className="relative w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={uploadHeading} className="w-full max-h-[320px] object-contain rounded-xl" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setImage(null);
                        setImageFile(null);
                        setAnalysis(null);
                      }}
                      aria-label={t.common.close}
                      className="focus-ring absolute top-2 right-2 p-2 rounded-full bg-gray-900/80 text-white/70 hover:text-white"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-40 mb-3">
                      <PalmDiagram analysis={null} />
                    </div>
                    <p className="text-sm text-white/60 text-center mb-1">{dragDropText}</p>
                    <p className="text-[11px] text-white/30 text-center">{t.palmistry.fileFormats}</p>
                  </>
                )}
              </div>

              {/* Action buttons (camera + gallery) */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="focus-ring touch-target rounded-xl bg-white/[0.04] py-2.5 text-sm font-medium text-white hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
                    <circle cx="12" cy="13" r="3.5" strokeWidth={2} />
                  </svg>
                  {t.palmistry.useCamera}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="focus-ring touch-target rounded-xl bg-white/[0.04] py-2.5 text-sm font-medium text-white hover:bg-white/[0.08] transition flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 16l4-4 4 4 6-6 4 4" />
                  </svg>
                  {t.palmistry.useGallery}
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] text-[11px] text-white/50">
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
                {t.palmistry.lightingTip}
              </div>
            </div>

            {error && (
              <Toast
                message={error}
                tone="error"
                onClose={() => { setError(""); setErrorRetryable(false); }}
                closeLabel={t.common.close}
                action={errorRetryable && imageFile ? { label: t.common.retry, onClick: handleAnalyze } : undefined}
              />
            )}

            {image && !analysis && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="focus-ring w-full py-4 rounded-xl btn-primary text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {progressMessage || t.palmistry.analyzing}
                  </span>
                ) : (
                  t.palmistry.analyzePalm
                )}
              </button>
            )}

            {/* Tips */}
            <div className="surface-card p-6">
              <h3 className="text-sm font-semibold text-white mb-3">{t.palmistry.tipsTitle}</h3>
              <ul className="space-y-2 text-xs text-white/40">
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">1.</span>
                  {gender === "male" ? t.palmistry.tipRightPalm : gender === "female" ? t.palmistry.tipLeftPalm : t.palmistry.tipSelectGender}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">2.</span>
                  {t.palmistry.tipFlatPalm}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">3.</span>
                  {t.palmistry.tipLighting}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">4.</span>
                  {t.palmistry.tipFingers}
                </li>
              </ul>
            </div>
          </div>

          {/* Analysis Results */}
          <div>
            {analysis ? (
              <div className="surface-card p-6">
                <h2 className="text-lg font-bold text-gradient mb-4">{t.palmistry.results}</h2>

                {analysis.handShape && (
                  <div className="mb-4 p-3 rounded-xl bg-primary-500/[0.06] border border-primary-500/20">
                    <p className="text-[11px] uppercase tracking-wider text-primary-300/80 mb-1">{t.palmistry.handShape}</p>
                    <p className="text-sm font-semibold text-white">{analysis.handShape.type}</p>
                    {analysis.handShape.description && (
                      <p className="mt-1 text-xs text-white/60 leading-relaxed">{analysis.handShape.description}</p>
                    )}
                  </div>
                )}

                <div className="mb-6 p-4 rounded-xl bg-white/[0.02]">
                  <PalmDiagram
                    analysis={analysis}
                    onFeatureSelect={handleFeatureSelect}
                    selectedFeature={selectedFeature}
                  />
                </div>

                <div role="tablist" aria-label={t.palmistry.results} className="flex gap-1 mb-6 rounded-xl bg-white/[0.03] p-1 overflow-x-auto no-scrollbar">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`focus-ring flex-shrink-0 flex-1 py-2 px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                        activeTab === tab.id
                          ? "btn-primary text-white"
                          : "text-white/70 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {activeTab === "major" &&
                    analysis.majorLines.map((line) => (
                      <div
                        key={line.name}
                        className={`p-4 rounded-xl transition-all cursor-pointer ${
                          selectedFeature === line.name
                            ? "bg-white/[0.08] ring-1 ring-primary-500/30"
                            : "bg-white/[0.03] hover:bg-white/[0.05]"
                        }`}
                        onClick={() => setSelectedFeature(selectedFeature === line.name ? null : line.name)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-white text-sm">{line.name}</h4>
                          <span className={`text-xs font-medium ${strengthColor(line.strength)}`}>
                            {strengthLabel(line.strength)}
                          </span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">{line.description}</p>
                      </div>
                    ))}

                  {activeTab === "minor" && (
                    analysis.minorLines.length > 0 ? (
                      analysis.minorLines.map((line) => (
                        <div key={line.name} className="p-4 rounded-xl bg-white/[0.03]">
                          <h4 className="font-semibold text-white text-sm mb-2">{line.name}</h4>
                          <p className="text-xs text-white/40 leading-relaxed">{line.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-white/30 text-center py-4">{t.palmistry.noMinorLines}</p>
                    )
                  )}

                  {activeTab === "mounts" &&
                    analysis.mounts.map((mount) => (
                      <div
                        key={mount.name}
                        className={`p-4 rounded-xl transition-all cursor-pointer ${
                          selectedFeature === mount.name
                            ? "bg-white/[0.08] ring-1 ring-purple-500/30"
                            : "bg-white/[0.03] hover:bg-white/[0.05]"
                        }`}
                        onClick={() => setSelectedFeature(selectedFeature === mount.name ? null : mount.name)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-white text-sm">{mount.name}</h4>
                          <span className={`text-xs font-medium ${
                            mount.prominence === "high" ? "text-emerald-400" : "text-accent-400"
                          }`}>
                            {prominenceLabel(mount.prominence)}
                          </span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">{mount.description}</p>
                      </div>
                    ))}

                  {activeTab === "insights" && (
                    <div className="space-y-4">
                      {analysis.insights.length > 0 ? (
                        analysis.insights.map((insight, i) => (
                          <div key={i} className="p-4 rounded-xl bg-white/[0.03]">
                            <h4 className="font-semibold text-white text-sm mb-2">{insight.label}</h4>
                            <p className="text-xs text-white/50 leading-relaxed whitespace-pre-line">{insight.text}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-white/30 text-center py-4">{t.palmistry.noInsights}</p>
                      )}
                      {analysis.cautions && (
                        <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                          <h4 className="font-semibold text-amber-200 text-sm mb-2">{t.palmistry.cautions}</h4>
                          <p className="text-xs text-amber-100/70 leading-relaxed">{analysis.cautions}</p>
                        </div>
                      )}
                      {analysis.fingerAnalysis.length > 0 && (
                        <div className="p-4 rounded-xl bg-white/[0.03]">
                          <h4 className="font-semibold text-white text-sm mb-3">{t.palmistry.fingerAnalysis}</h4>
                          <div className="space-y-2">
                            {analysis.fingerAnalysis.map((f, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-primary-400 text-xs font-medium min-w-[80px]">{f.finger}</span>
                                <p className="text-xs text-white/40">{f.interpretation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "timing" && (
                    analysis.timingInsights.length > 0 ? (
                      <div className="space-y-3">
                        {analysis.timingInsights.map((ti, i) => (
                          <div key={i} className="p-4 rounded-xl bg-white/[0.03]">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-white text-sm">{ti.ageRange}</h4>
                              {ti.area && (
                                <span className="text-[10px] uppercase tracking-wider text-primary-300/80">{ti.area}</span>
                              )}
                            </div>
                            <p className="text-xs text-white/50 leading-relaxed">{ti.description}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-white/30 text-center py-4">{t.palmistry.noTimingInsights}</p>
                    )
                  )}

                  {activeTab === "markings" && (
                    analysis.specialMarkings.length > 0 ? (
                      <div className="space-y-3">
                        {analysis.specialMarkings.map((m, i) => (
                          <div key={i} className="p-4 rounded-xl bg-white/[0.03]">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-white text-sm">{m.name}</h4>
                              {m.location && (
                                <span className="text-[10px] text-white/40">{m.location}</span>
                              )}
                            </div>
                            <p className="text-xs text-white/50 leading-relaxed">{m.interpretation}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-white/30 text-center py-4">{t.palmistry.noSpecialMarkings}</p>
                    )
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.06] flex gap-2">
                  <button
                    onClick={handleDownload}
                    className="focus-ring flex-1 py-3 rounded-xl btn-secondary text-sm font-medium text-primary-300"
                  >
                    {t.palmistry.downloadReport}
                  </button>
                  <button
                    onClick={() => {
                      setAnalysis(null);
                      setImage(null);
                      setImageFile(null);
                      setSelectedFeature(null);
                    }}
                    className="focus-ring py-3 px-4 rounded-xl bg-white/[0.04] text-sm font-medium text-white/70 hover:text-white"
                  >
                    {t.palmistry.startOver}
                  </button>
                </div>
              </div>
            ) : (
              <div className="surface-card p-12 flex flex-col items-center justify-center min-h-[400px] text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500/10 text-primary-300">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white/80 mb-2">{t.palmistry.analysisResults}</h3>
                <p className="text-sm text-white/60 max-w-xs">{t.palmistry.uploadPrompt}</p>
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-white/20">{t.palmistry.disclaimer}</p>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          labels={{
            title: t.palmistry.useCamera,
            capture: t.palmistry.takePhoto,
            retake: t.palmistry.retake,
            use: t.palmistry.usePhoto,
            cancel: t.common.cancel,
            switchCamera: t.palmistry.switchCamera,
            error: t.palmistry.cameraError,
            starting: t.palmistry.cameraStarting,
            overlayHint: t.palmistry.cameraOverlayHint,
          }}
        />
      )}
    </div>
  );
}
