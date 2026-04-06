"use client";

import { useState, useRef, useCallback } from "react";
import PalmDiagram from "@/components/palmistry/PalmDiagram";

interface AnalysisResult {
  majorLines: { name: string; description: string; strength: string }[];
  minorLines: { name: string; description: string }[];
  mounts: { name: string; description: string; prominence: string }[];
  insights: { label: string; text: string }[];
  fingerAnalysis: { finger: string; interpretation: string }[];
}

const MAJOR_LINE_NAMES = ["Heart Line", "Head Line", "Life Line", "Fate Line", "Sun Line"];

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

function isMajorLine(lineName: string): boolean {
  const normalized = normalizeName(lineName);
  return MAJOR_LINE_NAMES.some((major) => {
    const majorNorm = normalizeName(major);
    const keyword = majorNorm.split(" ")[0]; // "heart", "head", "life", "fate", "sun"
    return normalized === majorNorm || normalized.includes(keyword);
  });
}

function normalizeStrength(s: string): string {
  const lower = (s || "").toLowerCase();
  if (lower === "strong" || lower === "prominent" || lower === "deep") return "Strong";
  if (lower === "moderate" || lower === "medium" || lower === "normal" || lower === "average") return "Moderate";
  return "Weak";
}

function normalizeProminence(p: string): string {
  const lower = (p || "").toLowerCase();
  if (lower === "elevated" || lower === "high" || lower === "prominent") return "High";
  if (lower === "flat" || lower === "low" || lower === "underdeveloped") return "Low";
  return "Medium";
}

export default function PalmistryPage() {
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
        const majorNames = ["Heart Line", "Head Line", "Life Line", "Fate Line", "Sun Line"];
        setActiveTab(majorNames.includes(feature.name) ? "major" : "minor");
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
      setError("Please upload a palm image first.");
      return;
    }
    setAnalyzing(true);
    setError("");
    try {
      const { useAuthStore } = await import("@/lib/store");
      if (!useAuthStore.getState().accessToken) {
        setError("Please log in to analyze your palm.");
        setAnalyzing(false);
        return;
      }
      const { api } = await import("@/lib/api");
      const formData = new FormData();
      formData.append("image", imageFile);
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
        if (result.overallReading) insights.push({ label: "Overall Reading", text: result.overallReading });
        if (result.healthInsights) insights.push({ label: "Health", text: result.healthInsights });
        if (result.careerInsights) insights.push({ label: "Career", text: result.careerInsights });
        if (result.relationshipInsights) insights.push({ label: "Relationships", text: result.relationshipInsights });

        const fingerAnalysis = (result.fingerAnalysis || [])
          .filter((f: any) => f.interpretation)
          .map((f: any) => ({ finger: f.finger, interpretation: f.interpretation }));

        setAnalysis({ majorLines, minorLines, mounts, insights, fingerAnalysis });
      } else {
        setError("No analysis results received. Please try again.");
      }
    } catch (err: any) {
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const tabs = [
    { id: "major", label: "Major Lines" },
    { id: "minor", label: "Minor Lines" },
    { id: "mounts", label: "Mounts" },
    { id: "insights", label: "Insights" },
  ];

  const strengthColor = (s: string) =>
    s === "Strong" ? "text-emerald-400" : s === "Moderate" ? "text-accent-400" : "text-white/40";

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 bg-gradient-to-b from-primary-900/10 via-gray-950 to-gray-950" />
      <div className="absolute top-32 left-1/4 w-80 h-80 bg-accent-500/8 rounded-full blur-3xl" />
      <div className="absolute bottom-32 right-1/4 w-80 h-80 bg-primary-500/8 rounded-full blur-3xl" />

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full surface-card text-sm text-white/60 mb-4">
            Vedic Palm Analysis
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Palm <span className="text-gradient">Reading</span>
          </h1>
          <p className="text-white/40 max-w-xl mx-auto">
            Upload a clear photo of your palm for detailed analysis of your lines, mounts, and personality insights.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Area */}
          <div className="space-y-6">
            {/* Gender Selection */}
            <div className="surface-card p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Select Your Gender</h3>
              <p className="text-xs text-white/40 mb-3">
                In Vedic palmistry, {gender === "male" ? "males read the right palm (active hand)" : gender === "female" ? "females read the left palm (receptive hand)" : "the palm to read depends on your gender"}.
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
                  Male — Right Palm
                </button>
                <button
                  onClick={() => setGender("female")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    gender === "female"
                      ? "btn-primary text-white"
                      : "bg-white/[0.03] text-white/40 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  Female — Left Palm
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
                    Upload {gender === "male" ? "Right" : gender === "female" ? "Left" : "Your"} Palm Image
                  </p>
                  <p className="text-sm text-white/40 text-center mb-4">
                    {gender
                      ? `Drag and drop or click to upload a clear photo of your ${gender === "male" ? "right" : "left"} palm`
                      : "Please select your gender above, then upload a photo of the recommended palm"}
                  </p>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] text-xs text-white/30">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Use good lighting, open palm, clear focus
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
                    Analyzing Your Palm...
                  </span>
                ) : (
                  "Analyze Palm"
                )}
              </button>
            )}

            {/* Tips */}
            <div className="surface-card p-6">
              <h3 className="text-sm font-semibold text-white mb-3">Tips for Best Results</h3>
              <ul className="space-y-2 text-xs text-white/40">
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">1.</span>
                  {gender === "male" ? "Use your right palm (active hand in Vedic palmistry)" : gender === "female" ? "Use your left palm (receptive hand in Vedic palmistry)" : "Select your gender to know which palm to use"}
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">2.</span>
                  Ensure palm is fully open and flat
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">3.</span>
                  Take photo in bright, even lighting
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">4.</span>
                  Include all fingers and wrist lines
                </li>
              </ul>
            </div>
          </div>

          {/* Analysis Results */}
          <div>
            {analysis ? (
              <div className="surface-card p-6">
                <h2 className="text-lg font-bold text-gradient mb-4">Palm Analysis Results</h2>

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
                            {line.strength}
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
                      <p className="text-sm text-white/30 text-center py-4">No minor lines detected in this reading.</p>
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
                            mount.prominence === "High" ? "text-emerald-400" : "text-accent-400"
                          }`}>
                            {mount.prominence}
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
                        <p className="text-sm text-white/30 text-center py-4">No detailed insights available for this reading.</p>
                      )}
                      {analysis.fingerAnalysis.length > 0 && (
                        <div className="p-4 rounded-xl bg-white/[0.03]">
                          <h4 className="font-semibold text-white text-sm mb-3">Finger Analysis</h4>
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
                    Download Full Report (PDF)
                  </button>
                </div>
              </div>
            ) : (
              <div className="surface-card p-12 flex flex-col items-center justify-center min-h-[400px] text-center">
                <h3 className="text-lg font-semibold text-white/40 mb-2">Analysis Results</h3>
                <p className="text-sm text-white/20">
                  Upload a palm image and click analyze to see your detailed reading here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-white/20">
            Palm reading is for entertainment and self-reflection purposes only. Results should not be used as a substitute for professional advice.
          </p>
        </div>
      </div>
    </div>
  );
}
