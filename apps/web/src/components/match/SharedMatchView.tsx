"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n";
import { FeatureGlyph } from "@/components/icons";
import type { SharedMatchPayload } from "@/lib/seo/server-api";

const scoreColor = (pct: number) =>
  pct >= 75 ? "text-emerald-400" : pct >= 50 ? "text-accent-400" : "text-red-400";

const barColor = (pct: number) =>
  pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-accent-500" : "bg-red-500";

/**
 * Read-only render of a publicly shared Kundli-match snapshot. Mirrors the
 * results section of the interactive Matching page, minus any birth details
 * (which are never part of a shared snapshot), and funnels the visitor toward
 * computing their own match.
 */
export default function SharedMatchView({ data }: { data: SharedMatchPayload }) {
  const { t } = useTranslation();
  const pct = data.percentage;

  return (
    <div className="relative mx-auto max-w-3xl px-4 py-10 sm:py-14 fade-in-up">
      {/* Hero */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary-400 mb-3">
          <FeatureGlyph slug="matching" size={16} />
          {t.matchShare.publicEyebrow}
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold text-gradient">
          {data.personAName} &amp; {data.personBName}
        </h1>
        <p className="mt-2 text-sm text-secondary">{t.matchShare.publicSubtitle}</p>
      </div>

      {/* Score overview */}
      <div className="surface-card p-8 text-center">
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
            <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.matching.ashtakootaScore}</p>
            <p className={`text-3xl font-bold ${scoreColor(pct)}`}>
              {data.totalScore}
              <span className="text-lg text-[rgba(12,8,5,0.66)]">/{data.maxScore}</span>
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
            <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.matching.compatibility}</p>
            <p className={`text-3xl font-bold ${scoreColor(pct)}`}>{pct}%</p>
          </div>
          <div className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
            <p className="text-xs text-[rgba(12,8,5,0.66)] mb-1">{t.matching.verdict}</p>
            <p className="text-2xl font-bold text-emerald-400">{data.compatibility}</p>
          </div>
        </div>

        {/* Manglik */}
        <div className="grid sm:grid-cols-2 gap-4 mt-6">
          {[
            { name: data.personAName, manglik: data.manglikA },
            { name: data.personBName, manglik: data.manglikB },
          ].map((p, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)] flex items-center justify-between"
            >
              <span className="text-sm text-[rgba(12,8,5,0.66)]">
                {p.name} - {t.matching.manglik}
              </span>
              <span className={`text-sm font-semibold ${p.manglik ? "text-red-400" : "text-emerald-400"}`}>
                {p.manglik ? t.matching.yes : t.matching.no}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Koota breakdown */}
      {data.gunaDetails.length > 0 && (
        <div className="surface-card p-6 mt-6">
          <h2 className="text-lg font-bold text-surface-950 mb-4">{t.matching.ashtakootaBreakdown}</h2>
          <div className="space-y-3">
            {data.gunaDetails.map((k, i) => {
              const kpct = k.maxPoints > 0 ? (k.obtainedPoints / k.maxPoints) * 100 : 0;
              return (
                <div key={i} className="p-4 rounded-xl bg-[rgba(255,252,245,0.78)]">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-surface-950 text-sm">{k.guna}</span>
                      {k.description && (
                        <span className="text-xs text-[rgba(12,8,5,0.66)] ml-2">{k.description}</span>
                      )}
                    </div>
                    <span className={`text-sm font-bold ${scoreColor(kpct)}`}>
                      {k.obtainedPoints}/{k.maxPoints}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[rgba(12,8,5,0.08)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor(kpct)}`} style={{ width: `${kpct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      {data.recommendation && (
        <div className="surface-card p-6 mt-6">
          <h2 className="text-lg font-bold text-gradient mb-3">{t.matching.analysisSummary}</h2>
          <p className="text-secondary leading-relaxed">{data.recommendation}</p>
        </div>
      )}

      {/* CTA */}
      <div className="surface-card p-8 mt-8 text-center">
        <h2 className="text-xl font-bold text-surface-950 mb-2">{t.matchShare.ctaHeadline}</h2>
        <p className="text-sm text-secondary mb-5 max-w-md mx-auto">{t.matchShare.ctaSubtitle}</p>
        <Link href="/matching" className="inline-block px-8 py-3.5 rounded-xl btn-primary text-base">
          {t.matchShare.ctaButton}
        </Link>
      </div>

      <p className="text-center text-xs text-[rgba(12,8,5,0.66)] mt-6">{t.matchShare.computedOn}</p>
    </div>
  );
}
