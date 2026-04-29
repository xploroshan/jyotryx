"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatCurrency, TabError, errorMessage } from "./helpers";
import type { PlatformAnalytics, LlmCostRow } from "./types";

export function AnalyticsTab({ token }: { token: string }) {
  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [llmCosts, setLlmCosts] = useState<LlmCostRow[]>([]);
  const [llmCostDays, setLlmCostDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, l] = await Promise.all([
        api.get<PlatformAnalytics>("/admin/analytics", { token }),
        api.get<LlmCostRow[]>(`/admin/analytics/llm-costs?limit=20&days=${llmCostDays}`, { token }),
      ]);
      setAnalytics(a);
      setLlmCosts(l);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[admin/analytics] failed to load", err);
      setError(errorMessage(err));
    }
    setLoading(false);
  }, [token, llmCostDays]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <div>
      <h2 className="text-xl font-bold text-gradient mb-6">Platform Analytics</h2>
      {error ? (
        <TabError message={error} onRetry={load} />
      ) : !analytics ? (
        <div className="surface-card p-8 text-center text-surface-50/40 text-sm">Loading analytics…</div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Sessions Today", value: analytics.sessionsToday.toLocaleString() },
              { label: "Avg. Sessions/Day (7d)", value: analytics.avgSessionsPerDay.toLocaleString() },
              { label: "Avg. Chat Length", value: `${analytics.avgChatLength} msgs` },
              { label: "Credits Used (Today)", value: analytics.creditsConsumedToday.toLocaleString() },
              { label: "Credits Used (7d)", value: analytics.creditsConsumedLast7Days.toLocaleString() },
              { label: "User Retention (30d)", value: `${analytics.retention.day30}%` },
              { label: "Conversion Rate", value: `${analytics.conversionRate}%` },
              { label: "LLM Calls (7d)", value: analytics.llmTotals.callsLast7Days.toLocaleString() },
              { label: "LLM Cost (7d)", value: `$${analytics.llmTotals.totalCostUsdLast7Days.toFixed(4)}` },
            ].map((m) => (
              <div key={m.label} className="surface-card p-5">
                <p className="text-xs text-surface-50/30 mb-1">{m.label}</p>
                <div className="flex items-end gap-2">
                  <p className="text-2xl font-bold text-surface-50">{m.value}</p>
                </div>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-bold text-surface-50 mb-4">Credits Spent by Feature (7d)</h3>
          <div className="surface-card p-6 mb-8">
            {(() => {
              const rows = analytics.creditsByFeatureLast7Days ?? [];
              const total = rows.reduce((s, r) => s + r.totalCredits, 0);
              if (rows.length === 0 || total === 0) {
                return <p className="text-sm text-surface-50/40 text-center py-4">No credits spent in the last 7 days yet.</p>;
              }
              const colors = [
                "from-amber-500 to-yellow-500",
                "from-rose-500 to-pink-500",
                "from-blue-500 to-cyan-500",
                "from-emerald-500 to-green-500",
                "from-purple-500 to-violet-500",
                "from-orange-500 to-red-500",
              ];
              return (
                <>
                  {rows.map((r, i) => {
                    const pct = total > 0 ? Math.round((r.totalCredits / total) * 1000) / 10 : 0;
                    return (
                      <div key={r.feature} className="flex items-center gap-4 mb-3 last:mb-0">
                        <span className="text-sm text-surface-50/40 w-20">{r.feature}</span>
                        <div className="flex-1 h-3 bg-white/[0.03] rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${colors[i % colors.length]} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-sm font-medium text-amber-400 w-20 text-right tabular-nums">{r.totalCredits.toLocaleString()}</span>
                        <span className="text-xs text-surface-50/30 w-12 text-right">×{r.count}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
                    <span className="text-sm text-surface-50/40">Total credits spent (7d)</span>
                    <span className="text-lg font-bold text-amber-400 tabular-nums">{total.toLocaleString()}</span>
                  </div>
                </>
              );
            })()}
          </div>

          <h3 className="text-lg font-bold text-surface-50 mb-4">Feature Usage Breakdown</h3>
          <div className="surface-card p-6 mb-8">
            {analytics.featureUsage.length === 0 || analytics.featureUsage.every((f) => f.count === 0) ? (
              <p className="text-sm text-surface-50/40 text-center py-4">No feature usage data yet</p>
            ) : (
              analytics.featureUsage.map((f, i) => {
                const colors = [
                  "from-blue-500 to-cyan-500",
                  "from-purple-500 to-violet-500",
                  "from-red-500 to-orange-500",
                  "from-pink-500 to-rose-500",
                  "from-emerald-500 to-green-500",
                  "from-yellow-500 to-amber-500",
                ];
                return (
                  <div key={f.feature} className="flex items-center gap-4 mb-3 last:mb-0">
                    <span className="text-sm text-surface-50/40 w-20">{f.feature}</span>
                    <div className="flex-1 h-3 bg-white/[0.03] rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${colors[i % colors.length]} rounded-full transition-all`} style={{ width: `${f.percent}%` }} />
                    </div>
                    <span className="text-sm font-medium text-surface-50 w-16 text-right">{f.count.toLocaleString()}</span>
                    <span className="text-xs text-surface-50/30 w-12 text-right">{f.percent}%</span>
                  </div>
                );
              })
            )}
          </div>

          <h3 className="text-lg font-bold text-surface-50 mb-4">Revenue Trend (Last 7 Days)</h3>
          <div className="surface-card p-6 mb-8">
            {(() => {
              const maxRev = Math.max(...analytics.revenueTrend.map((d) => d.revenue), 1);
              const total = analytics.revenueTrend.reduce((sum, d) => sum + d.revenue, 0);
              return (
                <>
                  <div className="flex items-end gap-2 h-40">
                    {analytics.revenueTrend.map((d) => {
                      const label = new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" });
                      return (
                        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full bg-gradient-to-t from-primary-600 to-mystic-500 rounded-t-lg transition-all" style={{ height: `${Math.max((d.revenue / maxRev) * 100, 2)}%` }} />
                          <span className="text-[10px] text-surface-50/30">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/[0.06]">
                    <span className="text-sm text-surface-50/40">Weekly Total</span>
                    <span className="text-lg font-bold text-gradient">{formatCurrency(total)}</span>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-surface-50">LLM Cost Per User</h3>
            <select
              value={llmCostDays}
              onChange={(e) => setLlmCostDays(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-surface-50 text-xs focus:outline-none focus:border-primary-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <div className="surface-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-surface-50/40">User</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-surface-50/40">Email</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-surface-50/40">Calls</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-surface-50/40">Tokens</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-surface-50/40">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {llmCosts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-surface-50/30 text-xs">No LLM usage recorded in this period.</td>
                    </tr>
                  ) : (
                    llmCosts.map((row, idx) => (
                      <tr key={`${row.userId ?? 'unknown'}-${idx}`} className="border-b border-white/5">
                        <td className="px-4 py-3 text-surface-50">{row.userName ?? <span className="text-surface-50/30 italic">Deleted user</span>}</td>
                        <td className="px-4 py-3 text-surface-50/60">{row.userEmail ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-surface-50/80">{row.calls.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-surface-50/80">{row.totalTokens.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-400">${row.totalCostUsd.toFixed(4)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
