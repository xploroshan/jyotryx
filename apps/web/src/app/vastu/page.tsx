"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";

const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "apartment", label: "Apartment" },
  { value: "office", label: "Office" },
  { value: "shop", label: "Shop" },
  { value: "factory", label: "Factory" },
  { value: "plot", label: "Plot" },
];

const DIRECTIONS = [
  { value: "N", label: "North" },
  { value: "NE", label: "North-East" },
  { value: "E", label: "East" },
  { value: "SE", label: "South-East" },
  { value: "S", label: "South" },
  { value: "SW", label: "South-West" },
  { value: "W", label: "West" },
  { value: "NW", label: "North-West" },
];

interface VastuResult {
  propertyType: string;
  entrance: { direction: string; score: number; verdict: string; deity: string; element: string };
  directions: { direction: string; deity: string; element: string; suitableRooms: string[]; avoid: string[] }[];
  propertyTips: string[];
  insights: { summary: string; remedies: string[]; gemstone: string; mantra: string; favorableChanges: string[] };
}

export default function VastuPage() {
  const { t, locale } = useTranslation();
  const [propertyType, setPropertyType] = useState("house");
  const [entranceDirection, setEntranceDirection] = useState("E");
  const [concern, setConcern] = useState("");
  const [result, setResult] = useState<VastuResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const analyze = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api.post<VastuResult>("/vastu/analyze", { propertyType, entranceDirection, concern: concern || undefined, locale });
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">{t.vastu.title}</h1>
      <p className="text-white/40 mb-8">{t.vastu.description}</p>

      <div className="surface-card p-6 mb-6 space-y-4">
        <div>
          <label className="text-sm text-white/60 mb-2 block">{t.vastu.propertyType}</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PROPERTY_TYPES.map((pt) => (
              <button key={pt.value} onClick={() => setPropertyType(pt.value)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${propertyType === pt.value ? "bg-primary-600 text-white" : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"}`}>
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60 mb-2 block">{t.vastu.entranceDirection}</label>
          <div className="grid grid-cols-4 gap-2">
            {DIRECTIONS.map((d) => (
              <button key={d.value} onClick={() => setEntranceDirection(d.value)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${entranceDirection === d.value ? "bg-primary-600 text-white" : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60 mb-2 block">{t.vastu.concern}</label>
          <input type="text" value={concern} onChange={(e) => setConcern(e.target.value)} placeholder={t.vastu.concernPlaceholder} className="w-full px-4 py-3 rounded-xl surface-input" />
        </div>

        <button onClick={analyze} disabled={loading} className="w-full py-3 rounded-xl btn-primary text-sm font-medium disabled:opacity-50">
          {loading ? t.vastu.analyzing : t.vastu.analyze}
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {result && (
        <div className="space-y-6">
          {/* Score */}
          <div className="surface-card p-6 text-center">
            <div className={`text-4xl font-bold ${getScoreColor(result.entrance.score)}`}>{result.entrance.score}/100</div>
            <div className="text-sm text-white/60 mt-1">{result.entrance.verdict}</div>
            <div className="text-xs text-white/30 mt-2">Entrance: {result.entrance.direction} | Deity: {result.entrance.deity} | Element: {result.entrance.element}</div>
          </div>

          {/* Summary */}
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white mb-3">{t.vastu.analysis}</h3>
            <p className="text-sm text-white/60">{result.insights.summary}</p>
          </div>

          {/* Remedies */}
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white mb-3">{t.vastu.remedies}</h3>
            <ul className="space-y-2">
              {result.insights.remedies?.map((r, i) => (
                <li key={i} className="text-sm text-white/50 flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">+</span> {r}
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-white/[0.03] rounded-lg p-3">
                <div className="text-xs text-white/30">{t.vastu.gemstone}</div>
                <div className="text-sm text-accent-400">{result.insights.gemstone}</div>
              </div>
              <div className="bg-white/[0.03] rounded-lg p-3">
                <div className="text-xs text-white/30">{t.vastu.mantra}</div>
                <div className="text-sm text-accent-400">{result.insights.mantra}</div>
              </div>
            </div>
          </div>

          {/* Direction Grid */}
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white mb-3">{t.vastu.directionGuide}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {result.directions.map((d) => (
                <div key={d.direction} className="bg-white/[0.03] rounded-lg p-3">
                  <div className="text-sm font-medium text-white">{d.direction} — {d.deity}</div>
                  <div className="text-xs text-white/30 mt-1">Element: {d.element}</div>
                  <div className="text-xs text-emerald-400/70 mt-1">{t.vastu.bestFor}: {d.suitableRooms.join(", ")}</div>
                  <div className="text-xs text-red-400/70 mt-0.5">{t.vastu.avoid}: {d.avoid.join(", ")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white mb-3">{t.vastu.propertyTips}</h3>
            <ul className="space-y-2">
              {result.propertyTips.map((tip, i) => (
                <li key={i} className="text-sm text-white/50 flex items-start gap-2">
                  <span className="text-accent-400 mt-0.5">*</span> {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
