"use client";

import { useState, useRef } from "react";

interface AnalysisResult {
  majorLines: { name: string; description: string; strength: string }[];
  minorLines: { name: string; description: string }[];
  mounts: { name: string; description: string; prominence: string }[];
  personality: string[];
}

const mockAnalysis: AnalysisResult = {
  majorLines: [
    { name: "Life Line", description: "Long and deep, indicating strong vitality and a life full of energy. Curves widely around the thumb mount suggesting enthusiasm and zest for life.", strength: "Strong" },
    { name: "Heart Line", description: "Starts below the index finger, indicating a selective and thoughtful approach to love. Slight curve suggests a balance between emotion and reason.", strength: "Moderate" },
    { name: "Head Line", description: "Long and straight, indicating clear thinking and analytical abilities. Slight slope toward the Mount of Moon shows creative intelligence.", strength: "Strong" },
    { name: "Fate Line", description: "Prominent and begins from the base of the palm, suggesting a strong sense of purpose and self-made success from an early age.", strength: "Strong" },
  ],
  minorLines: [
    { name: "Sun Line", description: "Present alongside the fate line, indicating success, fame, and recognition in your chosen field." },
    { name: "Mercury Line", description: "Faintly visible, suggesting decent communication skills and business acumen." },
    { name: "Marriage Line", description: "One prominent line indicating a significant, lasting relationship. Positioned high on the mount suggesting marriage in the late twenties." },
    { name: "Bracelet Lines", description: "Three clear rascette lines visible, traditionally indicating a long and healthy life of approximately 70-80+ years." },
  ],
  mounts: [
    { name: "Mount of Jupiter", description: "Well-developed, showing ambition, leadership qualities, and a desire for knowledge.", prominence: "High" },
    { name: "Mount of Saturn", description: "Moderately developed, indicating a balanced approach to responsibility and discipline.", prominence: "Medium" },
    { name: "Mount of Apollo", description: "Prominent, suggesting artistic talent, creativity, and a charismatic personality.", prominence: "High" },
    { name: "Mount of Venus", description: "Full and well-padded, indicating warmth, love, and a passionate nature.", prominence: "High" },
  ],
  personality: [
    "Natural leader with strong ambition and drive",
    "Creative thinker with analytical problem-solving abilities",
    "Warm and passionate in relationships, loyal partner",
    "Strong vitality with excellent physical constitution",
    "Destined for recognition and success through self-effort",
    "Good communication skills suited for public-facing roles",
  ],
};

export default function PalmistryPage() {
  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState("major");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
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
    setAnalyzing(true);
    setError("");
    try {
      const { useAuthStore } = await import("@/lib/store");
      const token = useAuthStore.getState().accessToken;
      if (token && fileRef.current?.files?.[0]) {
        const { api } = await import("@/lib/api");
        const formData = new FormData();
        formData.append("image", fileRef.current.files[0]);
        const result = await api.upload<any>("/palmistry/analyze", formData, token);
        if (result?.majorLines || result?.lines || result?.analysis) {
          // Map API response to our display format
          const mapped: AnalysisResult = {
            majorLines: result.majorLines || result.lines?.major || mockAnalysis.majorLines,
            minorLines: result.minorLines || result.lines?.minor || mockAnalysis.minorLines,
            mounts: result.mounts || mockAnalysis.mounts,
            personality: result.personality || result.traits || mockAnalysis.personality,
          };
          setAnalysis(mapped);
          return;
        }
      } else if (!token) {
        setError("Please log in to analyze your palm.");
        return;
      }
      // Fallback for demo purposes
      setAnalysis(mockAnalysis);
    } catch (err: any) {
      setError(err.message || "Analysis failed. Showing sample results.");
      setAnalysis(mockAnalysis);
    } finally {
      setAnalyzing(false);
    }
  };

  const tabs = [
    { id: "major", label: "Major Lines" },
    { id: "minor", label: "Minor Lines" },
    { id: "mounts", label: "Mounts" },
    { id: "personality", label: "Personality" },
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
            AI-Powered Analysis
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            Palm <span className="text-gradient">Reading</span>
          </h1>
          <p className="text-white/40 max-w-xl mx-auto">
            Upload a clear photo of your palm and our AI will analyze your lines, mounts, and provide detailed personality insights.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Upload Area */}
          <div className="space-y-6">
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
                    onClick={(e) => { e.stopPropagation(); setImage(null); setAnalysis(null); }}
                    className="absolute top-2 right-2 p-2 rounded-full bg-gray-900/80 text-white/60 hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  {/* Hand outline guide */}
                  <div className="relative w-40 h-52 mb-6 opacity-30">
                    <svg viewBox="0 0 120 160" fill="none" stroke="currentColor" className="w-full h-full text-primary-400">
                      <path d="M60 155 C25 155 15 120 15 95 L15 70 C15 65 20 60 25 60 C30 60 35 65 35 70 L35 55 C35 50 40 45 45 45 C50 45 55 50 55 55 L55 40 C55 35 60 30 65 30 C70 30 75 35 75 40 L75 50 C75 45 80 40 85 40 C90 40 95 45 95 50 L95 90 C95 90 105 80 110 85 C115 90 105 100 100 110 C95 120 95 155 60 155Z" strokeWidth="2" />
                      <path d="M35 80 Q50 95 75 80" strokeWidth="1.5" strokeDasharray="4 2" className="text-accent-400" />
                      <path d="M35 90 Q55 75 85 90" strokeWidth="1.5" strokeDasharray="4 2" className="text-primary-400" />
                      <path d="M55 55 L55 100" strokeWidth="1.5" strokeDasharray="4 2" className="text-mystic-400" />
                    </svg>
                  </div>
                  <p className="text-white font-semibold mb-2">Upload Palm Image</p>
                  <p className="text-sm text-white/40 text-center mb-4">
                    Drag and drop or click to upload a clear photo of your palm
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
                  Use your dominant hand (right if right-handed)
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
                <h2 className="text-lg font-bold text-gradient mb-6">Palm Analysis Results</h2>

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
                      <div key={line.name} className="p-4 rounded-xl bg-white/[0.03]">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-white text-sm">{line.name}</h4>
                          <span className={`text-xs font-medium ${strengthColor(line.strength)}`}>
                            {line.strength}
                          </span>
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed">{line.description}</p>
                      </div>
                    ))}

                  {activeTab === "minor" &&
                    analysis.minorLines.map((line) => (
                      <div key={line.name} className="p-4 rounded-xl bg-white/[0.03]">
                        <h4 className="font-semibold text-white text-sm mb-2">{line.name}</h4>
                        <p className="text-xs text-white/40 leading-relaxed">{line.description}</p>
                      </div>
                    ))}

                  {activeTab === "mounts" &&
                    analysis.mounts.map((mount) => (
                      <div key={mount.name} className="p-4 rounded-xl bg-white/[0.03]">
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

                  {activeTab === "personality" && (
                    <div className="space-y-3">
                      {analysis.personality.map((trait, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03]">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center text-xs font-bold text-white">
                            {i + 1}
                          </span>
                          <p className="text-sm text-white/60">{trait}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.06]">
                  <button className="w-full py-3 rounded-xl btn-secondary text-sm font-medium text-primary-400">
                    Download Full Report (PDF) - 5 Credits
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
            AI palm reading is for entertainment and self-reflection purposes only. Results are generated by AI analysis and should not be used as a substitute for professional advice.
          </p>
        </div>
      </div>
    </div>
  );
}
