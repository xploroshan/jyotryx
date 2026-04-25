"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatCurrency, TabError, errorMessage } from "./helpers";
import type { DashboardStats } from "./types";

export function DashboardTab({ token, onTabChange }: { token: string; onTabChange: (tab: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DashboardStats>("/admin/dashboard", { token });
      setStats(data);
    } catch (err) {
      // Surface the failure instead of silently rendering null — the old
      // `catch {}` here meant a 500 from /admin/dashboard left the
      // entire Dashboard tab blank with no signal anything had failed.
      // eslint-disable-next-line no-console
      console.error("[admin/dashboard] failed to load", err);
      setError(errorMessage(err));
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
              <p className="text-xs text-white/30">{stat.label}</p>
              <span className="text-lg">{stat.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold text-white mb-4">Quick Actions</h2>
      <div className="grid sm:grid-cols-4 gap-4">
        <button onClick={() => onTabChange("users")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
          <p className="text-sm font-medium text-white">Manage Users</p>
          <p className="text-xs text-white/30 mt-1">View, edit, delete users</p>
        </button>
        <button onClick={() => onTabChange("activity")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
          <p className="text-sm font-medium text-white">Activity Log</p>
          <p className="text-xs text-white/30 mt-1">Track and undo changes</p>
        </button>
        <button onClick={() => onTabChange("ai")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
          <p className="text-sm font-medium text-white">AI Agent Status</p>
          <p className="text-xs text-white/30 mt-1">Monitor 8 active agents</p>
        </button>
        <button onClick={() => onTabChange("analytics")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
          <p className="text-sm font-medium text-white">View Analytics</p>
          <p className="text-xs text-white/30 mt-1">Platform usage metrics</p>
        </button>
      </div>
    </div>
  );
}
