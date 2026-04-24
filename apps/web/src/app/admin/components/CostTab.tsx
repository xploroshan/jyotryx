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

interface CostSummary {
  mtdUsd: number;
  prevMtdUsd: number;
  projectionUsd: number;
  dailyThreshold: number | null;
  monthlyThreshold: number | null;
}

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
      const [s, f, p, d, t] = await Promise.all([
        api.get<CostSummary>("/admin/cost/summary", { token }),
        api.get<ByFeatureRow[]>("/admin/cost/by-feature?days=30", { token }),
        api.get<ByProviderRow[]>("/admin/cost/by-provider?days=30", { token }),
        api.get<DailyPoint[]>("/admin/cost/daily?days=30", { token }),
        api.get<TodayByFeature>("/admin/llm/usage/today", { token }),
      ]);
      setSummary(s);
      setByFeature(f);
      setByProvider(p);
      setDaily(d);
      setToday(t);
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
          <p className="text-xs text-white/40">MTD LLM Spend</p>
          <p className="text-3xl font-bold text-white mt-1 tabular-nums">{formatUsd(summary?.mtdUsd ?? 0)}</p>
          {delta && (
            <p className={`text-xs mt-2 ${delta.up ? "text-red-400" : "text-emerald-400"}`}>
              {delta.up ? "▲" : "▼"} {delta.value.toFixed(1)}% vs same window last month ({formatUsd(summary!.prevMtdUsd)})
            </p>
          )}
        </div>
        <div className="surface-card p-6">
          <p className="text-xs text-white/40">Projected End-of-Month</p>
          <p className="text-3xl font-bold text-accent-400 mt-1 tabular-nums">{formatUsd(summary?.projectionUsd ?? 0)}</p>
          <p className="text-xs text-white/30 mt-2">Linear projection from MTD ÷ days elapsed × days in month.</p>
        </div>
        <div className="surface-card p-6">
          <p className="text-xs text-white/40">Today's Spend</p>
          <p className="text-3xl font-bold text-white mt-1 tabular-nums">
            {formatUsd(Object.values(today).reduce((a, b) => a + b.costUsd, 0))}
          </p>
          <p className="text-xs text-white/30 mt-2">
            {Object.values(today).reduce((a, b) => a + b.tokens, 0).toLocaleString()} tokens across {Object.keys(today).length} features.
          </p>
        </div>
      </div>

      {/* 30-day sparkline */}
      <div className="surface-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Last 30 Days</h3>
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
        <div className="flex justify-between text-[10px] text-white/30 mt-2 tabular-nums">
          <span>{daily[0]?.date ?? ""}</span>
          <span>{daily[daily.length - 1]?.date ?? ""}</span>
        </div>
      </div>

      {/* Spend alert thresholds */}
      <div className="surface-card p-6">
        <h3 className="text-sm font-semibold text-white mb-1">Spend Alerts</h3>
        <p className="text-xs text-white/50 mb-4">
          Hourly cron writes a <code className="text-white/70">COST_ALERT_TRIPPED</code> row to the
          activity log (and sends the admin notification if enabled) the first time
          each window breaches its threshold. Leave a field blank to disable that scope.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs text-white/50 mb-1">Daily threshold (USD)</span>
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
            <span className="block text-xs text-white/50 mb-1">Monthly threshold (USD)</span>
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
          <h3 className="text-sm font-semibold text-white mb-4">Top Features (30d)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[11px] text-white/40 font-medium py-2">Feature</th>
                <th className="text-right text-[11px] text-white/40 font-medium py-2">Calls</th>
                <th className="text-right text-[11px] text-white/40 font-medium py-2">Tokens</th>
                <th className="text-right text-[11px] text-white/40 font-medium py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {byFeature.slice(0, 15).map((r) => (
                <tr key={r.feature} className="border-b border-white/[0.03]">
                  <td className="py-2 text-white/80">{r.feature}</td>
                  <td className="py-2 text-right text-white/60 tabular-nums">{r.calls.toLocaleString()}</td>
                  <td className="py-2 text-right text-white/60 tabular-nums">{r.totalTokens.toLocaleString()}</td>
                  <td className="py-2 text-right text-accent-400 tabular-nums">{formatUsd(r.costUsd)}</td>
                </tr>
              ))}
              {byFeature.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-white/30">No feature spend in window.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="surface-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Providers &amp; Models (30d)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[11px] text-white/40 font-medium py-2">Provider</th>
                <th className="text-left text-[11px] text-white/40 font-medium py-2">Model</th>
                <th className="text-right text-[11px] text-white/40 font-medium py-2">Calls</th>
                <th className="text-right text-[11px] text-white/40 font-medium py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {byProvider.slice(0, 15).map((r) => (
                <tr key={`${r.provider}|${r.model}`} className="border-b border-white/[0.03]">
                  <td className="py-2 text-white/80">{r.provider}</td>
                  <td className="py-2 text-white/60">{r.model}</td>
                  <td className="py-2 text-right text-white/60 tabular-nums">{r.calls.toLocaleString()}</td>
                  <td className="py-2 text-right text-accent-400 tabular-nums">{formatUsd(r.costUsd)}</td>
                </tr>
              ))}
              {byProvider.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-white/30">No provider spend in window.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
