"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import { FeatureGlyph } from "@/components/icons";
import Interpretation from "@/components/interpretation/Interpretation";

interface NameResult {
  name: string;
  destinyNumber: number;
  soulNumber: number;
  personalityNumber: number;
  destinyMeaning: string;
  soulMeaning: string;
  personalityMeaning: string;
  overallVerdict: string;
  strengths: string[];
  cautions: string[];
  bestDaysToUse: string[];
  luckyColors: string[];
  rulingPlanet: string;
  compatibility: string;
  suggestion: string;
}

interface BrandResult {
  brandName: string;
  nameNumber: number;
  vibration: string;
  planetaryRuler: string;
  suitableFor: string[];
  avoidFor: string[];
  overallScore: number;
  recommendation: string;
  alternativeNumbers: number[];
  bestLaunchDays: string[];
  luckyColors: string[];
}

export default function NumerologyPage() {
  const { t, locale } = useTranslation();

  const verdictConfig: Record<string, { label: string; color: string; bg: string }> = {
    highly_favorable: { label: t.numerology.highlyFavorable, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    favorable: { label: t.numerology.favorable, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
    neutral: { label: t.numerology.neutral, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    unfavorable: { label: t.numerology.needsAdjustment, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  };
  const [activeTab, setActiveTab] = useState<"name" | "brand">("name");
  const [nameInput, setNameInput] = useState("");
  const [brandInput, setBrandInput] = useState("");
  const [nameResult, setNameResult] = useState<NameResult | null>(null);
  const [brandResult, setBrandResult] = useState<BrandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyzeName = async () => {
    if (!nameInput.trim()) return;
    setLoading(true);
    setError("");
    setNameResult(null);
    try {
      const data = await api.post<NameResult>("/numerology/name", { name: nameInput.trim(), locale });
      setNameResult(data);
    } catch (err: any) {
      setError(err.message || t.numerology.analysisFailed);
    } finally {
      setLoading(false);
    }
  };

  const analyzeBrand = async () => {
    if (!brandInput.trim()) return;
    setLoading(true);
    setError("");
    setBrandResult(null);
    try {
      const data = await api.post<BrandResult>("/numerology/brand", { brandName: brandInput.trim(), locale });
      setBrandResult(data);
    } catch (err: any) {
      setError(err.message || t.numerology.analysisFailed);
    } finally {
      setLoading(false);
    }
  };

  const vc = nameResult ? verdictConfig[nameResult.overallVerdict] || verdictConfig.neutral : null;

  return (
    <div>
      <FeatureHeader
        tint="teal"
        eyebrow="Numerology"
        eyebrowIcon={<FeatureGlyph slug="numerology" size={18} />}
        headline={`{em}${t.numerology.title}{/em} ${t.numerology.titleHighlight}`}
        tagline={t.numerology.description}
      />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:py-14 fade-in-up">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 rounded-xl bg-[rgba(255,252,245,0.78)] p-1 w-fit mx-auto">
          {[
            { id: "name" as const, label: t.numerology.nameAnalysis },
            { id: "brand" as const, label: t.numerology.brandBusiness },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(""); }}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id ? "btn-primary" : "text-[rgba(12,8,5,0.66)] hover:text-surface-950"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
        )}

        {/* Name Analysis Tab */}
        {activeTab === "name" && (
          <div>
            <div className="surface-card p-6 mb-6">
              <label className="block text-xs text-[rgba(12,8,5,0.66)] mb-2">{t.numerology.enterNameLabel}</label>
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && analyzeName()}
                  placeholder={t.numerology.enterNamePlaceholder}
                  className="flex-1 min-w-0 px-4 py-3 rounded-xl surface-input"
                />
                <button
                  onClick={analyzeName}
                  disabled={loading || !nameInput.trim()}
                  className="px-6 py-3 rounded-xl btn-primary text-sm font-medium disabled:opacity-50"
                >
                  {loading ? t.numerology.analyzing : t.numerology.analyze}
                </button>
              </div>
            </div>

            {nameResult && vc && (
              <div className="space-y-4">
                {/* Numbers */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: t.numerology.destinyNumber, num: nameResult.destinyNumber, desc: nameResult.destinyMeaning },
                    { label: t.numerology.soulNumber, num: nameResult.soulNumber, desc: nameResult.soulMeaning },
                    { label: t.numerology.personalityNumber, num: nameResult.personalityNumber, desc: nameResult.personalityMeaning },
                  ].map((item) => (
                    <div key={item.label} className="surface-card p-5 text-center">
                      <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{item.label}</p>
                      <p className="text-4xl font-bold text-gradient mb-2">{item.num}</p>
                      <p className="text-[11px] text-[rgba(12,8,5,0.66)] leading-relaxed">{item.desc.substring(0, 80)}...</p>
                    </div>
                  ))}
                </div>

                {/* Verdict */}
                <div className={`p-4 rounded-xl border ${vc.bg}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${vc.color}`}>{vc.label}</span>
                    <span className="text-xs text-[rgba(12,8,5,0.66)]">{t.numerology.rulingPlanet}: {nameResult.rulingPlanet}</span>
                  </div>
                  <p className="text-sm text-secondary mt-2">{nameResult.suggestion}</p>
                </div>

                {/* Strengths & Cautions */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="surface-card p-5">
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3">{t.numerology.strengths}</h3>
                    <ul className="space-y-1.5">
                      {nameResult.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-secondary flex items-center gap-2">
                          <span className="text-emerald-400">&#10003;</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="surface-card p-5">
                    <h3 className="text-sm font-semibold text-amber-400 mb-3">{t.numerology.cautions}</h3>
                    <ul className="space-y-1.5">
                      {nameResult.cautions.map((c, i) => (
                        <li key={i} className="text-sm text-secondary flex items-center gap-2">
                          <span className="text-amber-400">!</span> {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Lucky Info */}
                <div className="surface-card p-5">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.numerology.luckyColors}</p>
                      <p className="text-sm text-emphasis">{nameResult.luckyColors.join(", ")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.numerology.bestDays}</p>
                      <p className="text-sm text-emphasis">{nameResult.bestDaysToUse.join(", ")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.numerology.compatibility}</p>
                      <p className="text-sm text-emphasis">{nameResult.compatibility}</p>
                    </div>
                  </div>
                </div>

                <Interpretation
                  domain="numerology"
                  input={{
                    name: nameResult.name,
                    destinyNumber: nameResult.destinyNumber,
                    soulNumber: nameResult.soulNumber,
                    personalityNumber: nameResult.personalityNumber,
                    overallVerdict: nameResult.overallVerdict,
                    rulingPlanet: nameResult.rulingPlanet,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Brand Analysis Tab */}
        {activeTab === "brand" && (
          <div>
            <div className="surface-card p-6 mb-6">
              <label className="block text-xs text-[rgba(12,8,5,0.66)] mb-2">{t.numerology.enterBrandLabel}</label>
              <div className="flex flex-wrap gap-3">
                <input
                  type="text"
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && analyzeBrand()}
                  placeholder={t.numerology.enterBrandPlaceholder}
                  className="flex-1 min-w-0 px-4 py-3 rounded-xl surface-input"
                />
                <button
                  onClick={analyzeBrand}
                  disabled={loading || !brandInput.trim()}
                  className="px-6 py-3 rounded-xl btn-primary text-sm font-medium disabled:opacity-50"
                >
                  {loading ? t.numerology.analyzing : t.numerology.analyze}
                </button>
              </div>
            </div>

            {brandResult && (
              <div className="space-y-4">
                {/* Score + Number */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="surface-card p-5 text-center">
                    <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.numerology.nameNumber}</p>
                    <p className="text-5xl font-bold text-gradient mb-2">{brandResult.nameNumber}</p>
                    <p className="text-sm text-[rgba(12,8,5,0.72)]">{brandResult.vibration}</p>
                  </div>
                  <div className="surface-card p-5 text-center">
                    <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.numerology.businessScore}</p>
                    <p className="text-5xl font-bold mb-2">
                      <span className={brandResult.overallScore >= 7 ? "text-emerald-400" : brandResult.overallScore >= 5 ? "text-amber-400" : "text-red-400"}>
                        {brandResult.overallScore}
                      </span>
                      <span className="text-lg text-[rgba(12,8,5,0.66)]">/10</span>
                    </p>
                    <p className="text-sm text-[rgba(12,8,5,0.72)]">{t.numerology.ruledBy} {brandResult.planetaryRuler}</p>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="surface-card p-5">
                  <p className="text-sm text-emphasis">{brandResult.recommendation}</p>
                </div>

                {/* Suitable / Avoid */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="surface-card p-5">
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3">{t.numerology.bestSuitedFor}</h3>
                    <div className="flex flex-wrap gap-2">
                      {brandResult.suitableFor.map((s, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="surface-card p-5">
                    <h3 className="text-sm font-semibold text-red-400 mb-3">{t.numerology.lessSuitableFor}</h3>
                    <div className="flex flex-wrap gap-2">
                      {brandResult.avoidFor.map((s, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-300">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Lucky Info */}
                <div className="surface-card p-5">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.numerology.bestLaunchDays}</p>
                      <p className="text-sm text-emphasis">{brandResult.bestLaunchDays.join(", ")}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.numerology.luckyColors}</p>
                      <p className="text-sm text-emphasis">{brandResult.luckyColors.join(", ")}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

