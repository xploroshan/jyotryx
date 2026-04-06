"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";

const SPREADS = [
  { value: "single", label: "Single Card", credits: 1, description: "Quick insight into your current situation" },
  { value: "three-card", label: "Three Card", credits: 2, description: "Past, Present, and Future reading" },
  { value: "celtic-cross", label: "Celtic Cross", credits: 3, description: "Comprehensive 10-card deep reading" },
];

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
  const [spread, setSpread] = useState("single");
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<TarotResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const drawCards = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api.post<TarotResult>("/tarot/draw", { spread, question: question || undefined });
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Failed to draw cards");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold text-white mb-2">Tarot Card Reading</h1>
      <p className="text-white/40 mb-8">Draw cards from the sacred 78-card deck for divine guidance</p>

      {/* Spread Selection */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {SPREADS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSpread(s.value)}
            className={`surface-card p-4 text-left transition-all ${spread === s.value ? "border-primary-500/50 bg-primary-600/10" : ""}`}
          >
            <div className="text-sm font-semibold text-white">{s.label}</div>
            <div className="text-xs text-white/40 mt-1">{s.description}</div>
            <div className="text-xs text-accent-400 mt-2">{s.credits} credit{s.credits > 1 ? "s" : ""}</div>
          </button>
        ))}
      </div>

      {/* Question */}
      <div className="mb-6">
        <label className="text-sm text-white/60 mb-2 block">Your question or intention (optional)</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What guidance do you seek?"
          className="w-full px-4 py-3 rounded-xl surface-input"
        />
      </div>

      <button onClick={drawCards} disabled={loading} className="w-full py-3 rounded-xl btn-primary text-sm font-medium disabled:opacity-50">
        {loading ? "Drawing cards..." : "Draw Cards"}
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
                <div className={`text-sm font-semibold ${card.isReversed ? "text-red-300" : "text-white"}`}>
                  {card.name}
                </div>
                <div className="text-xs text-white/30 mt-1">
                  {card.isReversed ? "Reversed" : "Upright"}
                </div>
              </div>
            ))}
          </div>

          {/* Interpretation */}
          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-white mb-3">Reading</h3>
            <p className="text-sm text-white/60 mb-4">{result.interpretation.overall}</p>

            {result.interpretation.cardInterpretations?.map((ci, i) => (
              <div key={i} className="mb-3 pl-4 border-l-2 border-primary-700/30">
                <div className="text-sm font-medium text-accent-400">{ci.position}: {ci.card}</div>
                <div className="text-xs text-white/50 mt-1">{ci.meaning}</div>
              </div>
            ))}

            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-sm text-white/50"><span className="text-primary-400 font-medium">Advice:</span> {result.interpretation.advice}</p>
              <p className="text-sm text-white/50 mt-2"><span className="text-accent-400 font-medium">Spiritual Guidance:</span> {result.interpretation.spiritualGuidance}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
