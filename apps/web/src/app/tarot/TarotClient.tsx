"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import FeatureHeader from "@/components/editorial/FeatureHeader";
import { FeatureGlyph } from "@/components/icons";

interface TarotCard {
  name: string;
  position: string;
  isReversed: boolean;
  meaning: string;
  reversed: string;
  arcana: string;
}

interface TarotResult {
  id: string;
  spread: string;
  cards: TarotCard[];
  interpretation: {
    overall: string;
    cardInterpretations: { card: string; position: string; meaning: string }[];
    advice: string;
    spiritualGuidance: string;
  };
}

export default function TarotPage() {
  const { t, locale } = useTranslation();
  const [spread, setSpread] = useState("single");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<TarotResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const SPREADS = [
    { value: "single", label: t.tarot.singleCard, credits: 1, description: t.tarot.singleCardDesc },
    { value: "three-card", label: t.tarot.threeCard, credits: 2, description: t.tarot.threeCardDesc },
    { value: "celtic-cross", label: t.tarot.celticCross, credits: 3, description: t.tarot.celticCrossDesc },
  ];

  const drawCards = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api.post<TarotResult>("/tarot/draw", { spread, question: question || undefined, locale });
      setResult(data);
    } catch (err: any) {
      setError(err.message || t.tarot.drawFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <FeatureHeader
        tint="violet"
        eyebrow="Tarot"
        eyebrowIcon={<FeatureGlyph slug="tarot" size={18} />}
        headline={`{em}${t.tarot.title}{/em}`}
        tagline={t.tarot.description}
      />

      <div className="mx-auto max-w-4xl px-4 py-10 fade-in-up">
      {/* Spread Selection */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {SPREADS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSpread(s.value)}
            className={`surface-card p-4 text-left transition-all ${spread === s.value ? "border-primary-500/50 bg-primary-600/10" : ""}`}
          >
            <div className="text-sm font-semibold text-surface-950">{s.label}</div>
            <div className="text-xs text-[rgba(12,8,5,0.66)] mt-1">{s.description}</div>
            <div className="text-xs text-accent-400 mt-2">{s.credits} {s.credits > 1 ? t.tarot.credits : t.tarot.credit}</div>
          </button>
        ))}
      </div>

      {/* Question */}
      <div className="mb-6">
        <label className="text-sm text-secondary mb-2 block">{t.tarot.questionLabel}</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t.tarot.questionPlaceholder}
          className="w-full px-4 py-3 rounded-xl surface-input"
        />
      </div>

      <button onClick={drawCards} disabled={loading} className="w-full py-3 rounded-xl btn-primary text-sm font-medium disabled:opacity-50">
        {loading ? t.tarot.drawing : t.tarot.drawCards}
      </button>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}

      {/* Results */}
      {result && (
        <div className="mt-8 space-y-6">
          {/* Cards */}
          <div className={`grid gap-4 ${result.cards.length === 1 ? "grid-cols-1 max-w-sm mx-auto" : result.cards.length <= 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-5"}`}>
            {result.cards.map((card, i) => (
              <div key={i} className={`surface-card p-4 text-center ${card.isReversed ? "border-red-500/30" : "border-accent-500/30"}`}>
                <div className="text-xs text-primary-400 mb-2">{card.position}</div>
                <div className={`text-sm font-semibold ${card.isReversed ? "text-red-300" : "text-surface-950"}`}>
                  {card.name}
                </div>
                <div className="text-xs text-[rgba(12,8,5,0.66)] mt-1">
                  {card.isReversed ? t.tarot.reversed : t.tarot.upright}
                </div>
              </div>
            ))}
          </div>

          {/* Interpretation */}
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-surface-950 mb-3">{t.tarot.reading}</h3>
            <p className="text-sm text-secondary mb-4">{result.interpretation.overall}</p>

            {result.interpretation.cardInterpretations?.map((ci, i) => (
              <div key={i} className="mb-3 pl-4 border-l-2 border-primary-700/30">
                <div className="text-sm font-medium text-accent-400">{ci.position}: {ci.card}</div>
                <div className="text-xs text-[rgba(12,8,5,0.72)] mt-1">{ci.meaning}</div>
              </div>
            ))}

            <div className="mt-4 pt-4 border-t border-[rgba(12,8,5,0.08)]">
              <p className="text-sm text-[rgba(12,8,5,0.72)]"><span className="text-primary-400 font-medium">{t.tarot.advice}:</span> {result.interpretation.advice}</p>
              <p className="text-sm text-[rgba(12,8,5,0.72)] mt-2"><span className="text-accent-400 font-medium">{t.tarot.spiritualGuidance}:</span> {result.interpretation.spiritualGuidance}</p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
