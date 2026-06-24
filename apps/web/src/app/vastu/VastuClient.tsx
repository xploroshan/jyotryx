"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import { FeatureGlyph } from "@/components/icons";

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

  const PROPERTY_TYPES = [
    { value: "house", label: t.vastu.propHouse },
    { value: "apartment", label: t.vastu.propApartment },
    { value: "office", label: t.vastu.propOffice },
    { value: "shop", label: t.vastu.propShop },
    { value: "factory", label: t.vastu.propFactory },
    { value: "plot", label: t.vastu.propPlot },
  ];

  const DIRECTIONS = [
    { value: "N", label: t.vastu.dirN },
    { value: "NE", label: t.vastu.dirNE },
    { value: "E", label: t.vastu.dirE },
    { value: "SE", label: t.vastu.dirSE },
    { value: "S", label: t.vastu.dirS },
    { value: "SW", label: t.vastu.dirSW },
    { value: "W", label: t.vastu.dirW },
    { value: "NW", label: t.vastu.dirNW },
  ];

  const analyze = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api.post<VastuResult>("/vastu/analyze", { propertyType, entranceDirection, concern: concern || undefined, locale });
      setResult(data);
    } catch (err: any) {
      setError(err.message || t.vastu.analysisFailed);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-red-400";

  return (
    <div>
      <FeatureHeader
        tint="emerald"
        eyebrow="Vastu"
        eyebrowIcon={<FeatureGlyph slug="vastu" size={18} />}
        headline={`{em}${t.vastu.title}{/em}`}
        tagline={t.vastu.description}
      />

      <div className="mx-auto max-w-4xl px-4 py-10 fade-in-up">
      <div className="surface-card p-6 mb-6 space-y-4">
        <div>
          <label className="text-sm text-secondary mb-2 block">{t.vastu.propertyType}</label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PROPERTY_TYPES.map((pt) => (
              <button key={pt.value} onClick={() => setPropertyType(pt.value)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${propertyType === pt.value ? "bg-primary-600 text-white" : "bg-[rgba(255,252,245,0.86)] text-secondary hover:bg-[rgba(12,8,5,0.05)]"}`}>
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-secondary mb-2 block">{t.vastu.entranceDirection}</label>
          <div className="grid grid-cols-4 gap-2">
            {DIRECTIONS.map((d) => (
              <button key={d.value} onClick={() => setEntranceDirection(d.value)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${entranceDirection === d.value ? "bg-primary-600 text-white" : "bg-[rgba(255,252,245,0.86)] text-secondary hover:bg-[rgba(12,8,5,0.05)]"}`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-secondary mb-2 block">{t.vastu.concern}</label>
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
            <div className="text-sm text-secondary mt-1">{result.entrance.verdict}</div>
            <div className="text-xs text-[rgba(12,8,5,0.66)] mt-2">{t.vastu.entrance}: {result.entrance.direction} | {t.vastu.deity}: {result.entrance.deity} | {t.vastu.element}: {result.entrance.element}</div>
          </div>

          {/* Summary */}
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-surface-950 mb-3">{t.vastu.analysis}</h3>
            <p className="text-sm text-secondary">{result.insights.summary}</p>
          </div>

          {/* Remedies */}
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-surface-950 mb-3">{t.vastu.remedies}</h3>
            <ul className="space-y-2">
              {result.insights.remedies?.map((r, i) => (
                <li key={i} className="text-sm text-[rgba(12,8,5,0.72)] flex items-start gap-2">
                  <span className="text-primary-400 mt-0.5">+</span> {r}
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="bg-[rgba(255,252,245,0.78)] rounded-lg p-3">
                <div className="text-xs text-[rgba(12,8,5,0.66)]">{t.vastu.gemstone}</div>
                <div className="text-sm text-accent-400">{result.insights.gemstone}</div>
              </div>
              <div className="bg-[rgba(255,252,245,0.78)] rounded-lg p-3">
                <div className="text-xs text-[rgba(12,8,5,0.66)]">{t.vastu.mantra}</div>
                <div className="text-sm text-accent-400">{result.insights.mantra}</div>
              </div>
            </div>
          </div>

          {/* Direction Grid */}
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-surface-950 mb-3">{t.vastu.directionGuide}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {result.directions.map((d) => (
                <div key={d.direction} className="bg-[rgba(255,252,245,0.78)] rounded-lg p-3">
                  <div className="text-sm font-medium text-surface-950">{d.direction} — {d.deity}</div>
                  <div className="text-xs text-[rgba(12,8,5,0.66)] mt-1">{t.vastu.element}: {d.element}</div>
                  <div className="text-xs text-emerald-400/70 mt-1">{t.vastu.bestFor}: {d.suitableRooms.join(", ")}</div>
                  <div className="text-xs text-red-400/70 mt-0.5">{t.vastu.avoid}: {d.avoid.join(", ")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-surface-950 mb-3">{t.vastu.propertyTips}</h3>
            <ul className="space-y-2">
              {result.propertyTips.map((tip, i) => (
                <li key={i} className="text-sm text-[rgba(12,8,5,0.72)] flex items-start gap-2">
                  <span className="text-accent-400 mt-0.5">*</span> {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
