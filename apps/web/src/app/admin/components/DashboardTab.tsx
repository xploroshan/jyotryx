"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "./helpers";
import type { DashboardStats } from "./types";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Fire the two fetches in parallel — stuck-onboarding is a
      // nice-to-have, shouldn't block the hero stats if it fails.
      const [statsRes, stuckRes] = await Promise.allSettled([
        api.get<DashboardStats>("/admin/dashboard", { token }),
        api.get<StuckUser[]>("/admin/onboarding/stuck", { token }),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      // Defensive — a misconfigured mock or a backend returning
      // non-array data must not blow up the render. Only trust the
      // response when it's actually an array.
      if (stuckRes.status === "fulfilled" && Array.isArray(stuckRes.value)) {
        setStuck(stuckRes.value);
      }
      setLoading(false);
    })();
  }, [token]);

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
      <div className="grid sm:grid-cols-5 gap-4">
        <button onClick={() => onTabChange("users")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
          <p className="text-sm font-medium text-white">Manage Users</p>
          <p className="text-xs text-white/30 mt-1">View, edit, delete users</p>
        </button>
        <button onClick={() => onTabChange("activity")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
          <p className="text-sm font-medium text-white">Activity Log</p>
          <p className="text-xs text-white/30 mt-1">Track and undo changes</p>
        </button>
        <button onClick={() => onTabChange("cost")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
          <p className="text-sm font-medium text-white">Cost Control</p>
          <p className="text-xs text-white/30 mt-1">LLM spend & projections</p>
        </button>
        <button onClick={() => onTabChange("ai")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
          <p className="text-sm font-medium text-white">AI Agent Status</p>
          <p className="text-xs text-white/30 mt-1">Monitor active agents</p>
        </button>
        <button onClick={() => onTabChange("analytics")} className="surface-card p-4 text-left hover:bg-white/10 transition-all">
          <p className="text-sm font-medium text-white">View Analytics</p>
          <p className="text-xs text-white/30 mt-1">Platform usage metrics</p>
        </button>
      </div>

      {/* Stuck onboarding — users from the last 7d who never finished
          birth details or never started a chat. Catches funnel leaks
          that otherwise show up weeks later as weak retention. */}
      <div className="mt-8 surface-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Stuck in Onboarding</h3>
            <p className="text-xs text-white/40 mt-0.5">
              Signed up in the last 7 days but didn't finish birth details or start chatting.
            </p>
          </div>
          <span className="text-[11px] px-2 py-1 rounded-full bg-accent-500/10 text-accent-400 tabular-nums">
            {stuck.length} users
          </span>
        </div>
        {stuck.length === 0 ? (
          <p className="text-sm text-white/30 py-3">No stuck users in the last 7 days 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left text-[11px] text-white/40 font-medium py-2 pr-4">User</th>
                  <th className="text-left text-[11px] text-white/40 font-medium py-2">Missing</th>
                  <th className="text-right text-[11px] text-white/40 font-medium py-2">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {stuck.slice(0, 10).map((u) => (
                  <tr key={u.userId} className="border-b border-white/[0.03]">
                    <td className="py-2 pr-4">
                      <p className="text-white/80">{u.name}</p>
                      <p className="text-[11px] text-white/40">{u.email}</p>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {u.missing.map((m) => (
                          <span key={m} className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.05] text-white/60">
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-right text-white/40 text-xs">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stuck.length > 10 && (
              <p className="text-xs text-white/30 mt-3">Showing 10 of {stuck.length}.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
