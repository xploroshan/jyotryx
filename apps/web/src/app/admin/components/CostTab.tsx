"use client";

/**
 * CostTab — admin Cost Control panel.
 *
 * Replaces the "open the Users tab to see per-user token stats" stub
 * that was previously the only cost-visibility surface. Shows MTD
 * spend + naive end-of-month projection, a 30-day sparkline, top
 * features and providers by spend, today's in-progress usage, and
 * editable spend-alert thresholds that the backend hourly cron
 * (`StatsService.checkSpendThresholds`) honours.
 *
 * Thresholds are persisted to `site_settings` under the existing
 * `notification.cost.*` prefix — no schema change required.
 */

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Toast } from "@/components/ui/Toast";
import type { CostForecast } from "./types";

interface CostSummary {
  mtdUsd: number;
  prevMtdUsd: number;
  projectionUsd: number;
  dailyThreshold: number | null;
  monthlyThreshold: number | null;
}

// Mirror of the backend MODEL_COSTS_USD_PER_1M table for the what-if
// card. Admin runtime overrides (stored under `pricing.llm.*`) do NOT
// feed this card — the goal is quick comparative math against the
// sticker-price baseline. If we add a /admin/llm/models/costs
// endpoint later, this table becomes a fetched-once fallback.
const MODEL_COSTS_PER_1M: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o":              { prompt: 2.5,  completion: 10 },
  "gpt-4o-mini":         { prompt: 0.15, completion: 0.6 },
  "gpt-4-turbo":         { prompt: 10,   completion: 30 },
  "gpt-4":               { prompt: 30,   completion: 60 },
  "gpt-3.5-turbo":       { prompt: 0.5,  completion: 1.5 },
  "claude-opus-4-6":     { prompt: 15,   completion: 75 },
  "claude-sonnet-4-6":   { prompt: 3,    completion: 15 },
  "claude-haiku-4-5":    { prompt: 0.8,  completion: 4 },
  "gemini-2.0-flash":    { prompt: 0.1,  completion: 0.4 },
  "gemini-1.5-pro":      { prompt: 1.25, completion: 5 },
  "gemini-1.5-flash":    { prompt: 0.075,completion: 0.3 },
};

interface ByFeatureRow {
  feature: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
}

interface ByProviderRow {
  provider: string;
  model: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
}

interface DailyPoint {
  date: string;
  costUsd: number;
  tokens: number;
}

type TodayByFeature = Record<string, { tokens: number; costUsd: number }>;

function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function percentDelta(current: number, prior: number): { value: number; up: boolean } | null {
  if (!prior) return null;
  const v = ((current - prior) / prior) * 100;
  return { value: Math.abs(v), up: v >= 0 };
}

export function CostTab({ token }: { token: string }) {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [byFeature, setByFeature] = useState<ByFeatureRow[]>([]);
  const [byProvider, setByProvider] = useState<ByProviderRow[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [today, setToday] = useState<TodayByFeature>({});
  const [forecast, setForecast] = useState<CostForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Draft state for the editable threshold inputs — applied on Save.
  const [dailyDraft, setDailyDraft] = useState("");
  const [monthlyDraft, setMonthlyDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, f, p, d, t, fc] = await Promise.all([
        api.get<CostSummary>("/admin/cost/summary", { token }),
        api.get<ByFeatureRow[]>("/admin/cost/by-feature?days=30", { token }),
        api.get<ByProviderRow[]>("/admin/cost/by-provider?days=30", { token }),
        api.get<DailyPoint[]>("/admin/cost/daily?days=30", { token }),
        api.get<TodayByFeature>("/admin/llm/usage/today", { token }),
        api.get<CostForecast>("/admin/forecast/cost?lookback=60&days=30", { token }).catch(() => null),
      ]);
      setSummary(s);
      setByFeature(f);
      setByProvider(p);
      setDaily(d);
      setToday(t);
      setForecast(fc);
      setDailyDraft(s.dailyThreshold != null ? String(s.dailyThreshold) : "");
      setMonthlyDraft(s.monthlyThreshold != null ? String(s.monthlyThreshold) : "");
    } catch (err: any) {
      setError(err?.message || "Failed to load cost data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const saveThresholds = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(
        "/admin/settings",
        {
          "notification.cost.daily_usd": dailyDraft,
          "notification.cost.monthly_usd": monthlyDraft,
        },
        { token },
      );
      setSuccess("Spend thresholds saved. Hourly cron will alert on the next breach.");
      load();
    } catch (err: any) {
      setError(err?.message || "Failed to save thresholds");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const delta = summary ? percentDelta(summary.mtdUsd, summary.prevMtdUsd) : null;
  const maxDaily = Math.max(1, ...daily.map((d) => d.costUsd));

  return (
    <div className="space-y-8">
      {error && (
        <Toast message={error} tone="error" onClose={() => setError("")} />
      )}
      {success && (
        <Toast message={success} tone="success" onClose={() => setSuccess("")} autoCloseMs={4000} />
      )}

      {/* Headline tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-card p-6">
          <p className="text-xs text-surface-900/40">MTD LLM Spend</p>
          <p className="text-3xl font-bold text-surface-900 mt-1 tabular-nums">{formatUsd(summary?.mtdUsd ?? 0)}</p>
          {delta && (
            <p className={`text-xs mt-2 ${delta.up ? "text-red-400" : "text-emerald-400"}`}>
              {delta.up ? "▲" : "▼"} {delta.value.toFixed(1)}% vs same window last month ({formatUsd(summary!.prevMtdUsd)})
            </p>
          )}
        </div>
        <div className="surface-card p-6">
          <p className="text-xs text-surface-900/40">Projected End-of-Month</p>
          <p className="text-3xl font-bold text-accent-400 mt-1 tabular-nums">{formatUsd(summary?.projectionUsd ?? 0)}</p>
          <p className="text-xs text-surface-900/30 mt-2">Linear projection from MTD ÷ days elapsed × days in month.</p>
        </div>
        <div className="surface-card p-6">
          <p className="text-xs text-surface-900/40">Today&apos;s Spend</p>
          <p className="text-3xl font-bold text-surface-900 mt-1 tabular-nums">
            {formatUsd(Object.values(today).reduce((a, b) => a + b.costUsd, 0))}
          </p>
          <p className="text-xs text-surface-900/30 mt-2">
            {Object.values(today).reduce((a, b) => a + b.tokens, 0).toLocaleString()} tokens across {Object.keys(today).length} features.
          </p>
        </div>
      </div>

      {/* 30-day sparkline */}
      <div className="surface-card p-6">
        <h3 className="text-sm font-semibold text-surface-900 mb-4">Last 30 Days</h3>
        <svg viewBox={`0 0 ${daily.length * 16} 80`} className="w-full h-24">
          {daily.map((d, i) => {
            const h = (d.costUsd / maxDaily) * 70;
            return (
              <g key={d.date}>
                <rect
                  x={i * 16 + 2}
                  y={80 - h}
                  width={12}
                  height={h}
                  rx={2}
                  fill="currentColor"
                  className="text-primary-500/60"
                >
                  <title>{`${d.date}: ${formatUsd(d.costUsd)}`}</title>
                </rect>
              </g>
            );
          })}
        </svg>
        <div className="flex justify-between text-[10px] text-surface-900/30 mt-2 tabular-nums">
          <span>{daily[0]?.date ?? ""}</span>
          <span>{daily[daily.length - 1]?.date ?? ""}</span>
        </div>
      </div>

      {/* Phase 4: 30-day spend forecast with 1σ confidence band. Line
          overlay (history vs prediction) + a small tile with the trend
          slope so operators see "drifts at $X/day" at a glance. */}
      <ForecastCard data={forecast} />

      {/* Phase 4: what-if calculator — pure client-side math. Swap the
          model, pick a feature by volume, see MTD impact instantly. */}
      <WhatIfCard byFeature={byFeature} byProvider={byProvider} mtdUsd={summary?.mtdUsd ?? 0} />

      {/* Spend alert thresholds */}
      <div className="surface-card p-6">
        <h3 className="text-sm font-semibold text-surface-900 mb-1">Spend Alerts</h3>
        <p className="text-xs text-surface-900/50 mb-4">
          Hourly cron writes a <code className="text-surface-900/70">COST_ALERT_TRIPPED</code> row to the
          activity log (and sends the admin notification if enabled) the first time
          each window breaches its threshold. Leave a field blank to disable that scope.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs text-surface-900/50 mb-1">Daily threshold (USD)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={dailyDraft}
              placeholder="e.g. 25.00"
              onChange={(e) => setDailyDraft(e.target.value)}
              className="w-full px-3 py-2 rounded-lg surface-input text-sm tabular-nums"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-surface-900/50 mb-1">Monthly threshold (USD)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={monthlyDraft}
              placeholder="e.g. 500.00"
              onChange={(e) => setMonthlyDraft(e.target.value)}
              className="w-full px-3 py-2 rounded-lg surface-input text-sm tabular-nums"
            />
          </label>
        </div>
        <button
          onClick={saveThresholds}
          disabled={saving}
          className="mt-4 px-5 py-2 rounded-lg btn-primary text-sm disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save thresholds"}
        </button>
      </div>

      {/* Per-feature */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold text-surface-900 mb-4">Top Features (30d)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-900/[0.06]">
                <th className="text-left text-[11px] text-surface-900/40 font-medium py-2">Feature</th>
                <th className="text-right text-[11px] text-surface-900/40 font-medium py-2">Calls</th>
                <th className="text-right text-[11px] text-surface-900/40 font-medium py-2">Tokens</th>
                <th className="text-right text-[11px] text-surface-900/40 font-medium py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {byFeature.slice(0, 15).map((r) => (
                <tr key={r.feature} className="border-b border-surface-900/[0.03]">
                  <td className="py-2 text-surface-900/80">{r.feature}</td>
                  <td className="py-2 text-right text-surface-900/60 tabular-nums">{r.calls.toLocaleString()}</td>
                  <td className="py-2 text-right text-surface-900/60 tabular-nums">{r.totalTokens.toLocaleString()}</td>
                  <td className="py-2 text-right text-accent-400 tabular-nums">{formatUsd(r.costUsd)}</td>
                </tr>
              ))}
              {byFeature.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-surface-900/30">No feature spend in window.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold text-surface-900 mb-4">Providers &amp; Models (30d)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-900/[0.06]">
                <th className="text-left text-[11px] text-surface-900/40 font-medium py-2">Provider</th>
                <th className="text-left text-[11px] text-surface-900/40 font-medium py-2">Model</th>
                <th className="text-right text-[11px] text-surface-900/40 font-medium py-2">Calls</th>
                <th className="text-right text-[11px] text-surface-900/40 font-medium py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {byProvider.slice(0, 15).map((r) => (
                <tr key={`${r.provider}|${r.model}`} className="border-b border-surface-900/[0.03]">
                  <td className="py-2 text-surface-900/80">{r.provider}</td>
                  <td className="py-2 text-surface-900/60">{r.model}</td>
                  <td className="py-2 text-right text-surface-900/60 tabular-nums">{r.calls.toLocaleString()}</td>
                  <td className="py-2 text-right text-accent-400 tabular-nums">{formatUsd(r.costUsd)}</td>
                </tr>
              ))}
              {byProvider.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-surface-900/30">No provider spend in window.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 4: spend forecast card ─────────────────────────────────────────

function ForecastCard({ data }: { data: CostForecast | null }) {
  if (!data || data.points.length === 0) {
    return (
      <div className="surface-card p-6 text-surface-900/30 text-sm" data-testid="forecast-card">
        Forecast unavailable (need a few days of stat_daily rollups first).
      </div>
    );
  }
  const points = data.points;
  const width = Math.max(points.length * 12, 400);
  const height = 120;
  const values = points
    .map((p) => p.actualUsd ?? p.upperUsd ?? 0)
    .filter((v) => Number.isFinite(v));
  const yMax = Math.max(1, ...values) * 1.1;

  const xForIndex = (i: number) => (i * (width - 20)) / Math.max(1, points.length - 1) + 10;
  const yForValue = (v: number) => height - 10 - (v / yMax) * (height - 20);

  // Build two polylines: history (solid primary) and forecast (dashed
  // accent). Plus a translucent confidence band polygon on the forecast.
  const history = points
    .filter((p) => p.actualUsd !== null)
    .map((p, i) => `${xForIndex(i)},${yForValue(p.actualUsd!)}`)
    .join(" ");

  const forecastIdx0 = points.findIndex((p) => p.predictedUsd !== null);
  const forecastPath = points
    .map((p, i) =>
      p.predictedUsd !== null ? `${xForIndex(i)},${yForValue(p.predictedUsd)}` : null,
    )
    .filter(Boolean)
    .join(" ");

  const bandTop = points
    .map((p, i) =>
      p.upperUsd !== null ? `${xForIndex(i)},${yForValue(p.upperUsd)}` : null,
    )
    .filter(Boolean)
    .join(" ");
  const bandBottom = points
    .map((p, i) =>
      p.lowerUsd !== null ? `${xForIndex(i)},${yForValue(p.lowerUsd)}` : null,
    )
    .filter(Boolean)
    .reverse()
    .join(" ");

  const trendTone = data.trend > 0.01 ? "text-red-400" : data.trend < -0.01 ? "text-emerald-400" : "text-surface-900/50";
  return (
    <div className="surface-card p-6" data-testid="forecast-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-surface-900">30-day spend forecast</h3>
          <p className="text-xs text-surface-900/40 mt-0.5">
            Holt trend smoothing over the last 60 days of daily LLM spend. Shaded area ≈ ±1σ residual.
          </p>
        </div>
        <div className="text-right">
          <p className={`text-xs tabular-nums ${trendTone}`}>
            drift: {data.trend >= 0 ? "+" : ""}${data.trend.toFixed(2)}/day
          </p>
          <p className="text-[11px] text-surface-900/30 tabular-nums">
            ±{formatUsd(data.residualStd)} 1σ
          </p>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
        {/* Confidence band */}
        {bandTop && (
          <polygon
            points={`${bandTop} ${bandBottom}`}
            fill="currentColor"
            className="text-accent-400/10"
          />
        )}
        {/* History line */}
        {history && (
          <polyline
            points={history}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-primary-600"
          />
        )}
        {/* Forecast line */}
        {forecastPath && (
          <polyline
            points={forecastPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            className="text-accent-400"
          />
        )}
        {forecastIdx0 >= 0 && (
          <line
            x1={xForIndex(forecastIdx0)}
            x2={xForIndex(forecastIdx0)}
            y1={10}
            y2={height - 10}
            strokeDasharray="2 3"
            className="text-surface-900/20"
            stroke="currentColor"
          />
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-surface-900/30 mt-2 tabular-nums">
        <span>{points[0]?.date ?? ""}</span>
        <span>{points[points.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );
}

// ─── Phase 4: model-cost what-if card ─────────────────────────────────────

function WhatIfCard({
  byFeature,
  byProvider,
  mtdUsd,
}: {
  byFeature: ByFeatureRow[];
  byProvider: ByProviderRow[];
  mtdUsd: number;
}) {
  const modelOptions = Object.keys(MODEL_COSTS_PER_1M);
  const currentModelSeed = byProvider[0]?.model ?? "gpt-4o";
  const [fromModel, setFromModel] = useState<string>(modelOptions.includes(currentModelSeed) ? currentModelSeed : "gpt-4o");
  const [toModel, setToModel] = useState<string>("gpt-4o-mini");
  const [featureFilter, setFeatureFilter] = useState<string>("");

  // Compute the tokens attributable to the chosen feature(s) × fromModel.
  // Cost data from the backend is already USD per 1M @ current rates;
  // for the swap we scale tokens by the ratio of target-to-source rates.
  const fromRate = MODEL_COSTS_PER_1M[fromModel];
  const toRate   = MODEL_COSTS_PER_1M[toModel];

  const filtered = byFeature.filter((f) => featureFilter === "" || f.feature === featureFilter);
  const totalTokens = filtered.reduce((a, b) => a + b.totalTokens, 0);
  const totalCost   = filtered.reduce((a, b) => a + b.costUsd, 0);
  // Token split: assume 50/50 prompt/completion for the what-if since we
  // don't track it per row. Admins care about the ballpark number.
  const promptTokens = totalTokens / 2;
  const completionTokens = totalTokens / 2;
  const projectedCostAtFromRate = (promptTokens * fromRate.prompt + completionTokens * fromRate.completion) / 1_000_000;
  const projectedCostAtToRate   = (promptTokens * toRate.prompt + completionTokens * toRate.completion) / 1_000_000;
  const ratio = projectedCostAtFromRate > 0 ? projectedCostAtToRate / projectedCostAtFromRate : 1;
  const swappedCost = totalCost * ratio;
  const mtdDelta    = (ratio - 1) * mtdUsd;

  const featureOptions = [""].concat(byFeature.map((f) => f.feature));

  return (
    <div className="surface-card p-6" data-testid="what-if-card">
      <h3 className="text-sm font-semibold text-surface-900 mb-1">Model-cost what-if</h3>
      <p className="text-xs text-surface-900/50 mb-4">
        Pure-client math against the sticker-price table. Admin pricing overrides aren&apos;t folded in here —
        useful for quick &ldquo;should we migrate&rdquo; decisions.
      </p>
      <div className="grid sm:grid-cols-3 gap-4 mb-4">
        <label className="block">
          <span className="block text-xs text-surface-900/40 mb-1">From model</span>
          <select
            value={fromModel}
            onChange={(e) => setFromModel(e.target.value)}
            data-testid="whatif-from"
            className="w-full px-3 py-2 rounded-lg surface-input text-sm"
          >
            {modelOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-surface-900/40 mb-1">To model</span>
          <select
            value={toModel}
            onChange={(e) => setToModel(e.target.value)}
            data-testid="whatif-to"
            className="w-full px-3 py-2 rounded-lg surface-input text-sm"
          >
            {modelOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs text-surface-900/40 mb-1">Feature (optional)</span>
          <select
            value={featureFilter}
            onChange={(e) => setFeatureFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg surface-input text-sm"
          >
            {featureOptions.map((f) => (
              <option key={f || "all"} value={f}>{f === "" ? "All features" : f}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <WhatIfTile label="Window cost today" value={formatUsd(totalCost)} tone="text-surface-900" />
        <WhatIfTile
          label={`If moved to ${toModel}`}
          value={formatUsd(swappedCost)}
          tone={ratio < 1 ? "text-emerald-400" : ratio > 1 ? "text-red-400" : "text-surface-900"}
        />
        <WhatIfTile
          label="MTD impact"
          value={`${mtdDelta >= 0 ? "+" : ""}${formatUsd(mtdDelta)}`}
          tone={mtdDelta < 0 ? "text-emerald-400" : mtdDelta > 0 ? "text-red-400" : "text-surface-900/60"}
        />
      </div>
    </div>
  );
}

function WhatIfTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="p-3 rounded-lg bg-surface-900/[0.03]">
      <p className="text-[11px] text-surface-900/40">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${tone}`}>{value}</p>
    </div>
  );
}
