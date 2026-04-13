"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/i18n";

interface TraditionOption {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  glowColor: string;
  isAvailable: boolean;
}

interface AstrologyTraditionSelectorProps {
  value: string[];
  onChange: (traditions: string[]) => void;
  compact?: boolean;
}

export default function AstrologyTraditionSelector({
  value,
  onChange,
  compact = false,
}: AstrologyTraditionSelectorProps) {
  const { t } = useTranslation();
  const [error, setError] = useState("");

  const traditions: TraditionOption[] = [
    {
      id: "VEDIC",
      name: t.traditions.vedic,
      description: t.traditions.vedicDesc,
      icon: (
        <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <text x="20" y="26" textAnchor="middle" fill="currentColor" fontSize="18" fontFamily="serif">
            Om
          </text>
        </svg>
      ),
      color: "text-amber-400",
      borderColor: "border-amber-500/50",
      glowColor: "shadow-amber-500/20",
      isAvailable: true,
    },
    {
      id: "WESTERN",
      name: t.traditions.western,
      description: t.traditions.westernDesc,
      icon: (
        <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <line x1="20" y1="2" x2="20" y2="38" stroke="currentColor" strokeWidth="1" opacity="0.15" />
          <line x1="2" y1="20" x2="38" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.15" />
          <text x="20" y="25" textAnchor="middle" fill="currentColor" fontSize="14">
            &#9790;
          </text>
        </svg>
      ),
      color: "text-sky-400",
      borderColor: "border-sky-500/50",
      glowColor: "shadow-sky-500/20",
      isAvailable: true,
    },
    {
      id: "CHINESE",
      name: t.traditions.chinese,
      description: t.traditions.chineseDesc,
      icon: (
        <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <text x="20" y="26" textAnchor="middle" fill="currentColor" fontSize="16">
            &#40845;
          </text>
        </svg>
      ),
      color: "text-red-400",
      borderColor: "border-red-500/50",
      glowColor: "shadow-red-500/20",
      isAvailable: true,
    },
    {
      id: "HELLENISTIC",
      name: t.traditions.hellenistic,
      description: t.traditions.hellenisticDesc,
      icon: (
        <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <text x="20" y="26" textAnchor="middle" fill="currentColor" fontSize="16">
            &#x2609;
          </text>
        </svg>
      ),
      color: "text-violet-400",
      borderColor: "border-violet-500/50",
      glowColor: "shadow-violet-500/20",
      isAvailable: true,
    },
    {
      id: "HORARY",
      name: t.traditions.horary,
      description: t.traditions.horaryDesc,
      icon: (
        <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <text x="20" y="26" textAnchor="middle" fill="currentColor" fontSize="14">
            ?
          </text>
        </svg>
      ),
      color: "text-teal-400",
      borderColor: "border-teal-500/50",
      glowColor: "shadow-teal-500/20",
      isAvailable: true,
    },
    {
      id: "MEDICAL",
      name: t.traditions.medical,
      description: t.traditions.medicalDesc,
      icon: (
        <svg viewBox="0 0 40 40" className="w-10 h-10" fill="none">
          <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
          <text x="20" y="26" textAnchor="middle" fill="currentColor" fontSize="16">
            +
          </text>
        </svg>
      ),
      color: "text-emerald-400",
      borderColor: "border-emerald-500/50",
      glowColor: "shadow-emerald-500/20",
      isAvailable: true,
    },
  ];

  const toggle = (id: string) => {
    setError("");
    if (value.includes(id)) {
      const next = value.filter((v) => v !== id);
      if (next.length === 0) {
        setError(t.traditions.selectAtLeast);
        return;
      }
      onChange(next);
    } else {
      onChange([...value, id]);
    }
  };

  const isSelected = (id: string) => value.includes(id);

  return (
    <div>
      <div className={`grid gap-4 ${compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
        {traditions.map((tradition) => {
          const selected = isSelected(tradition.id);
          const available = tradition.isAvailable;

          return (
            <button
              key={tradition.id}
              type="button"
              disabled={!available}
              onClick={() => available && toggle(tradition.id)}
              className={`relative group text-left p-5 rounded-2xl border transition-all duration-300 ${
                !available
                  ? "opacity-40 cursor-not-allowed border-white/5 bg-white/[0.01]"
                  : selected
                  ? `surface-card ${tradition.borderColor} shadow-lg ${tradition.glowColor} bg-white/[0.06]`
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]"
              }`}
            >
              {/* Selection indicator */}
              {available && (
                <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                  selected
                    ? `${tradition.borderColor} bg-white/10`
                    : "border-white/20"
                }`}>
                  {selected && (
                    <svg className={`w-3.5 h-3.5 ${tradition.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              )}

              {/* Coming Soon badge */}
              {!available && (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-white/30 font-medium">
                  {t.traditions.comingSoon}
                </div>
              )}

              {/* Icon */}
              <div className={`mb-3 ${available ? tradition.color : "text-white/20"}`}>
                {tradition.icon}
              </div>

              {/* Name */}
              <h3 className={`text-sm font-semibold mb-1 ${available ? "text-white" : "text-white/30"}`}>
                {tradition.name}
              </h3>

              {/* Description */}
              <p className={`text-xs leading-relaxed ${available ? "text-white/50" : "text-white/20"}`}>
                {tradition.description}
              </p>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
