"use client";

import { useState, useRef, useCallback } from "react";
import PalmDiagram from "@/components/palmistry/PalmDiagram";
import { useTranslation } from "@/i18n";

interface AnalysisResult {
  majorLines: { name: string; description: string; strength: "strong" | "moderate" | "weak" }[];
  minorLines: { name: string; description: string }[];
  mounts: { name: string; description: string; prominence: "high" | "medium" | "low" }[];
  insights: { label: string; text: string }[];
  fingerAnalysis: { finger: string; interpretation: string }[];
}

// Canonical (English, locale-independent) keys used for comparisons / logic
const MAJOR_LINE_KEYWORDS = ["heart", "head", "life", "fate", "sun"];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function isMajorLine(lineName: string): boolean {
  const normalized = normalizeName(lineName);
  return MAJOR_LINE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

// Returns canonical English code so the display layer can translate it.
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

export default function PalmistryPage() {
  const { t, locale } = useTranslation();
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState("major");
  const [error, setError] = useState("");
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setAnalysis(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleAnalyze = async () => {
    if (!imageFile) {
      setError(t.palmistry.uploadFirst);
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const { useAuthStore } = await import("@/lib/store");
      if (!useAuthStore.getState().accessToken) {
        setError(t.palmistry.loginRequired);
        setAnalyzing(false);
        return;
      }
      const { api } = await import("@/lib/api");
      const formData = new FormData();
      formData.append("image", imageFile);
      if (locale !== 'en') formData.append("locale", locale);
      const result = await api.upload<any>("/palmistry/analyze", formData);
      if (result) {
        // Map API response to display format
        const lines = result.lines || [];
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
          }));

        const mounts = (result.mounts || []).map((mt: any) => ({
          name: mt.name,
          description: mt.interpretation || mt.description || "",
          prominence: normalizeProminence(mt.prominence),
        }));

        const insights: { label: string; text: string }[] = [];
        if (result.overallReading) insights.push({ label: t.palmistry.insightOverall, text: result.overallReading });
        if (result.healthInsights) insights.push({ label: t.palmistry.insightHealth, text: result.healthInsights });
        if (result.careerInsights) insights.push({ label: t.palmistry.insightCareer, text: result.careerInsights });
        if (result.relationshipInsights) insights.push({ label: t.palmistry.insightRelationships, text: result.relationshipInsights });

        const fingerAnalysis = (result.fingerAnalysis || [])
          .filter((f: any) => f.interpretation)
          .map((f: any) => ({ finger: f.finger, interpretation: f.interpretation }));

        setAnalysis({ majorLines, minorLines, mounts, insights, fingerAnalysis });
      } else {
        setError(t.palmistry.noResultsError);
      }
    } catch (err: any) {
      setError(err.message || t.palmistry.analysisFailed);
    } finally {
      setAnalyzing(false);
    }
  };

  const tabs = [
    { id: "major", label: t.palmistry.majorLines },
    { id: "minor", label: t.palmistry.minorLines },
    { id: "mounts", label: t.palmistry.mounts },
    { id: "insights", label: t.palmistry.insights },
  ];

  const strengthColor = (s: "strong" | "moderate" | "weak") =>
    s === "strong" ? "text-emerald-400" : s === "moderate" ? "text-accent-400" : "text-white/40";

  const strengthLabel = (s: "strong" | "moderate" | "weak") =>
    s === "strong" ? t.palmistry.strengthStrong : s === "moderate" ? t.palmistry.strengthModerate : t.palmistry.strengthWeak;

  const prominenceLabel = (p: "high" | "medium" | "low") =>
    p === "high" ? t.palmistry.prominenceHigh : p === "medium" ? t.palmistry.prominenceMedium : t.palmistry.prominenceLow;

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/10 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/4 w-80 h-80 bg-accent-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/4 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12 fade-in-up">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full surface-card text-sm text-white/60 mb-4">
            {t.palmistry.badge}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            {t.palmistry.title} <span className="text-gradient">{t.palmistry.titleHighlight}</span>
          </h1>
          <p className="text-white/40 max-w-xl mx-auto">
            {t.palmistry.description}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Area */}
          <div className="space-y-6">
            {/* Gender Selection */}
            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-white mb-3">{t.palmistry.selectGender}</h3>
              <p className="text-xs text-white/40 mb-3">
                {gender === "male" ? t.palmistry.genderMaleNote : gender === "female" ? t.palmistry.genderFemaleNote : t.palmistry.genderDefaultNote}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setGender("male")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    gender === "male"
                      ? "btn-primary text-white"
                      : "bg-white/[0.03] text-white/40 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {t.palmistry.male}
                </button>
                <button
                  onClick={() => setGender("female")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    gender === "female"
                      ? "btn-primary text-white"
                      : "bg-white/[0.03] text-white/40 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {t.palmistry.female}
                </button>
              </div>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`surface-card p-8 flex flex-col items-center justify-center min-h-[400px] cursor-pointer transition-all ${
                isDragging ? "border-primary-500 bg-primary-500/10" : "hover:bg-white/[0.06]"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />

              {image ? (
                <div className="relative w-full">
                  <img src={image} alt="Palm" className="w-full max-h-[350px] object-contain rounded-xl" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setImage(null); setImageFile(null); setAnalysis(null); }}
                    className="absolute top-2 right-2 p-2 rounded-full bg-gray-900/80 text-white/60 hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  {/* Hand wireframe guide */}
                  <div className="w-48 mb-4">
                    <PalmDiagram analysis={null} />
                  </div>
                  <p className="text-white font-semibold mb-2">
                    {gender === "male" ? t.palmistry.uploadRight : gender === "female" ? t.palmistry.uploadLeft : t.palmistry.uploadYour}
                  </p>
                  <p className="text-sm text-white/40 text-center mb-4">
                    {gender
                      ? (gender === "male" ? t.palmistry.dragDropRight : t.palmistry.dragDropLeft)
                      : t.palmistry.selectGenderFirst}
                  </p>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] text-xs text-white/30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t.palmistry.lightingTip}
                  </div>
                </>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
            )}

            {image && !analysis && (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full py-4 rounded-xl btn-primary text-white font-semibold  transition-all disabled:opacity-50"
              >
                {analyzing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t.palmistry.analyzing}
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

                {/* Interactive Hand Diagram */}
                <div className="mb-6 p-4 rounded-xl bg-white/[0.02]">
                  <PalmDiagram
                    analysis={analysis}
                    onFeatureSelect={handleFeatureSelect}
                    selectedFeature={selectedFeature}
                  />
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 rounded-xl bg-white/[0.03] p-1">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                        activeTab === t.id
                          ? "btn-primary text-white"
                          : "text-white/40 hover:text-white"
                      }`}
                    >
                      {t.label}
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
                            <p className="text-xs text-white/40 leading-relaxed">{insight.text}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-white/30 text-center py-4">{t.palmistry.noInsights}</p>
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
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.06]">
                  <button className="w-full py-3 rounded-xl btn-secondary text-sm font-medium text-primary-400">
                    {t.palmistry.downloadReport}
                  </button>
                </div>
              </div>
            ) : (
              <div className="surface-card p-12 flex flex-col items-center justify-center min-h-[400px] text-center">
                <h3 className="text-lg font-semibold text-white/40 mb-2">{t.palmistry.analysisResults}</h3>
                <p className="text-sm text-white/20">
                  {t.palmistry.uploadPrompt}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-white/20">
            {t.palmistry.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
