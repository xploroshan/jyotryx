"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, TabError, errorMessage } from "./helpers";
import type { DashboardStats, MrrSnapshot } from "./types";

interface StuckUser {
  userId: string;
  email: string;
  name: string;
  createdAt: string;
  missing: string[];
}

export function DashboardTab({ token, onTabChange }: { token: string; onTabChange: (tab: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [stuck, setStuck] = useState<StuckUser[]>([]);
  const [mrr, setMrr] = useState<MrrSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Fire all three fetches in parallel — MRR and stuck-onboarding
    // are nice-to-haves, neither should block the hero stats if they
    // fail (e.g. fresh deploy with empty stats_daily rollup). Only a
    // failure of the primary /admin/dashboard call surfaces a visible
    // error, since without it the page literally has nothing to show.
    const [statsRes, stuckRes, mrrRes] = await Promise.allSettled([
      api.get<DashboardStats>("/admin/dashboard", { token }),
      api.get<StuckUser[]>("/admin/onboarding/stuck", { token }),
      api.get<MrrSnapshot>("/admin/mrr", { token }),
    ]);
    if (statsRes.status === "fulfilled") {
      setStats(statsRes.value);
    } else {
      // eslint-disable-next-line no-console
      console.error("[admin/dashboard] failed to load", statsRes.reason);
      setError(errorMessage(statsRes.reason));
    }
    // Defensive — a misconfigured mock or a backend returning non-array
    // data must not blow up the render. Only trust the response when
    // it's actually an array.
    if (stuckRes.status === "fulfilled" && Array.isArray(stuckRes.value)) {
      setStuck(stuckRes.value);
    }
    if (mrrRes.status === "fulfilled" && mrrRes.value) {
      setMrr(mrrRes.value);
    }
    setLoading(false);
  }, [token]);

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

  if (error) return <TabError message={error} onRetry={load} />;
  if (!stats) return null;

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Users", value: stats.totalUsers, color: "text-blue-400", icon: "\uD83D\uDC65" },
          { label: "Premium Users", value: stats.premiumUsers, color: "text-purple-400", icon: "\uD83D\uDC8E" },
          { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), color: "text-emerald-400", icon: "\uD83D\uDCB0" },
          { label: "New Today", value: stats.newUsersToday, color: "text-accent-400", icon: "\uD83C\uDF1F" },
          { label: "Total Chats", value: stats.totalChats, color: "text-pink-400", icon: "\uD83D\uDCAC" },
          { label: "Kundli Charts", value: stats.totalKundlis, color: "text-mystic-400", icon: "\uD83E\uDE90" },
          { label: "Payments", value: stats.totalPayments, color: "text-emerald-400", icon: "\uD83D\uDCB3" },
          { label: "Active Subs", value: stats.activeSubscriptions, color: "text-cyan-400", icon: "\u2728" },
        ].map((stat) => (
          <div key={stat.label} className="surface-card p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-surface-900/30">{stat.label}</p>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Growth tiles — MRR / ARR / LTV / ARPU. Rendered only when the
          /admin/mrr endpoint returned something; on a fresh deploy
          with no stats_daily rows the tiles stay hidden rather than
          showing $0 and spooking the operator. */}
      {mrr && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="growth-tiles">
          <GrowthTile
            label="MRR (USD)"
            primary={`$${mrr.mrrUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            secondary={`${mrr.momDelta >= 0 ? "+" : ""}${(mrr.momDelta * 100).toFixed(1)}% MoM`}
            tone={mrr.momDelta >= 0 ? "text-emerald-400" : "text-red-400"}
            icon="\uD83D\uDCC8"
          />
          <GrowthTile
            label="ARR (USD)"
            primary={`$${mrr.arrUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            secondary={`6m proj. $${mrr.projection6m.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            tone="text-cyan-400"
            icon="\uD83D\uDCCA"
          />
          <GrowthTile
            label="ARPU (USD)"
            primary={`$${mrr.arpuUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            secondary={`${mrr.subscriberCount.toLocaleString()} paying`}
            tone="text-amber-400"
            icon="\uD83E\uDDFE"
          />
          <GrowthTile
            label="LTV (USD)"
            primary={`$${mrr.ltvUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            secondary={`Lifetime $${mrr.totalRevenueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            tone="text-purple-400"
            icon="\uD83D\uDCB0"
          />
        </div>
      )}

      <h2 className="text-lg font-bold text-surface-900 mb-4">Quick Actions</h2>
      <div className="grid sm:grid-cols-6 gap-4">
        <button onClick={() => onTabChange("users")} className="surface-card p-4 text-left hover:bg-surface-900/10 transition-all">
          <p className="text-sm font-medium text-surface-900">Manage Users</p>
          <p className="text-xs text-surface-900/30 mt-1">View, edit, delete users</p>
        </button>
        <button onClick={() => onTabChange("funnel")} className="surface-card p-4 text-left hover:bg-surface-900/10 transition-all">
          <p className="text-sm font-medium text-surface-900">Funnel & cohorts</p>
          <p className="text-xs text-surface-900/30 mt-1">Retention by locale</p>
        </button>
        <button onClick={() => onTabChange("activity")} className="surface-card p-4 text-left hover:bg-surface-900/10 transition-all">
          <p className="text-sm font-medium text-surface-900">Activity Log</p>
          <p className="text-xs text-surface-900/30 mt-1">Track and undo changes</p>
        </button>
        <button onClick={() => onTabChange("cost")} className="surface-card p-4 text-left hover:bg-surface-900/10 transition-all">
          <p className="text-sm font-medium text-surface-900">Cost Control</p>
          <p className="text-xs text-surface-900/30 mt-1">LLM spend & projections</p>
        </button>
        <button onClick={() => onTabChange("ai")} className="surface-card p-4 text-left hover:bg-surface-900/10 transition-all">
          <p className="text-sm font-medium text-surface-900">AI Agent Status</p>
          <p className="text-xs text-surface-900/30 mt-1">Monitor active agents</p>
        </button>
        <button onClick={() => onTabChange("analytics")} className="surface-card p-4 text-left hover:bg-surface-900/10 transition-all">
          <p className="text-sm font-medium text-surface-900">View Analytics</p>
          <p className="text-xs text-surface-900/30 mt-1">Platform usage metrics</p>
        </button>
      </div>

      {/* Stuck onboarding — users from the last 7d who never finished
          birth details or never started a chat. Catches funnel leaks
          that otherwise show up weeks later as weak retention. */}
      <div className="mt-8 surface-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-surface-900">Stuck in Onboarding</h3>
            <p className="text-xs text-surface-900/40 mt-0.5">
              Signed up in the last 7 days but didn&apos;t finish birth details or start chatting.
            </p>
          </div>
          <span className="text-[11px] px-2 py-1 rounded-full bg-accent-500/10 text-accent-400 tabular-nums">
            {stuck.length} users
          </span>
        </div>
        {stuck.length === 0 ? (
          <p className="text-sm text-surface-900/30 py-3">No stuck users in the last 7 days 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-900/[0.06]">
                  <th className="text-left text-[11px] text-surface-900/40 font-medium py-2 pr-4">User</th>
                  <th className="text-left text-[11px] text-surface-900/40 font-medium py-2">Missing</th>
                  <th className="text-right text-[11px] text-surface-900/40 font-medium py-2">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {stuck.slice(0, 10).map((u) => (
                  <tr key={u.userId} className="border-b border-surface-900/[0.03]">
                    <td className="py-2 pr-4">
                      <p className="text-surface-900/80">{u.name}</p>
                      <p className="text-[11px] text-surface-900/40">{u.email}</p>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {u.missing.map((m) => (
                          <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-md bg-surface-900/[0.05] text-surface-900/60">
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-right text-surface-900/40 text-xs">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stuck.length > 10 && (
              <p className="text-xs text-surface-900/30 mt-3">Showing 10 of {stuck.length}.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GrowthTile({
  label,
  primary,
  secondary,
  tone,
  icon,
}: {
  label: string;
  primary: string;
  secondary: string;
  tone: string;
  icon: string;
}) {
  return (
    <div className="surface-card p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-surface-900/30">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${tone} tabular-nums`}>{primary}</p>
      <p className="text-xs text-surface-900/40 mt-1">{secondary}</p>
    </div>
  );
}
