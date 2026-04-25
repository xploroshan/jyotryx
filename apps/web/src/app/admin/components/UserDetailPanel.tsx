"use client";

import React, { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { roleBadge, statusBadge, formatCurrency, formatDate, formatDateTime, Badge, errorMessage } from "./helpers";
import type { UserDetail } from "./types";

export function UserDetailPanel({
  userId,
  token,
  onClose,
  onEdit,
  onDelete,
  onCancelSubscription,
}: {
  userId: string;
  token: string;
  onClose: () => void;
  onEdit: (user: UserDetail) => void;
  onDelete: (userId: string) => void;
  onCancelSubscription: (subId: string) => void;
}) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "subscriptions" | "payments" | "chats" | "credits" | "reports">("overview");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<UserDetail>(`/admin/users/${userId}`, { token });
        setDetail(data);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[admin/users/${userId}] failed to load`, err);
        setDetail(null);
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, token]);

  if (loading) {
    return (
      <div className="surface-card p-8 flex items-center justify-center">
        <svg className="w-6 h-6 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!detail)
    return (
      <div className="surface-card p-6 text-red-400 text-sm">
        Failed to load user details{error ? `: ${error}` : "."}
      </div>
    );

  const detailTabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "subscriptions" as const, label: `Subscriptions (${detail.subscriptions.length})` },
    { id: "payments" as const, label: `Payments (${detail.recentPayments.length})` },
    { id: "chats" as const, label: `Chats (${detail.recentChats.length})` },
    { id: "credits" as const, label: `Credits (${detail.creditTransactions.length})` },
    { id: "reports" as const, label: `Reports (${detail.reports.length})` },
  ];

  return (
    <div className="surface-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/[0.06]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-xl font-bold text-white">{detail.name}</h3>
              {roleBadge(detail.role)}
            </div>
            <p className="text-sm text-white/40">{detail.email}</p>
            {detail.phone && <p className="text-sm text-white/30">{detail.phone}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(detail)} className="px-3 py-1.5 rounded-lg surface-card text-xs text-primary-400 hover:bg-white/10">Edit</button>
            <button onClick={() => onDelete(detail.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20">Delete</button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg surface-card text-xs text-white/40 hover:bg-white/10">&times; Close</button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mt-4">
          {[
            { label: "Credits", value: detail.credits, color: "text-primary-400" },
            { label: "Chats", value: detail.stats.totalChats, color: "text-blue-400" },
            { label: "Payments", value: detail.stats.totalPayments, color: "text-emerald-400" },
            { label: "Spent", value: formatCurrency(detail.stats.totalSpent), color: "text-emerald-400" },
            { label: "Credits Used", value: detail.stats.totalCreditsUsed, color: "text-amber-400" },
            { label: "Kundlis", value: detail.stats.kundliCharts, color: "text-mystic-400" },
            { label: "Matchings", value: detail.stats.matchingResults, color: "text-pink-400" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-white/30">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
        {detailTabs.map((t) => (
          <button key={t.id} onClick={() => setDetailTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${detailTab === t.id ? "bg-primary-600/30 text-primary-400" : "text-white/30 hover:text-white/60"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {detailTab === "overview" && (
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "Provider", value: detail.provider },
              { label: "Gender", value: detail.gender || "Not set" },
              { label: "Date of Birth", value: detail.dateOfBirth ? formatDate(detail.dateOfBirth) : "Not set" },
              { label: "Time of Birth", value: detail.timeOfBirth || "Not set" },
              { label: "Place of Birth", value: detail.placeOfBirth?.name || "Not set" },
              { label: "Language", value: detail.preferredLanguage.toUpperCase() },
              { label: "Joined", value: formatDateTime(detail.createdAt) },
              { label: "Last Updated", value: formatDateTime(detail.updatedAt) },
            ].map((item) => (
              <div key={item.label} className="flex justify-between p-3 rounded-lg bg-white/[0.03]">
                <span className="text-xs text-white/30">{item.label}</span>
                <span className="text-sm text-white/60">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {detailTab === "subscriptions" && (
          <div className="space-y-3">
            {detail.subscriptions.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No subscriptions</p>
            ) : (
              detail.subscriptions.map((sub) => (
                <div key={sub.id} className="p-4 rounded-lg bg-white/[0.03] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{sub.plan} Plan</span>
                      {statusBadge(sub.status)}
                    </div>
                    <p className="text-xs text-white/30">
                      {formatDate(sub.startDate)} {sub.endDate ? ` - ${formatDate(sub.endDate)}` : " - Ongoing"}
                    </p>
                  </div>
                  {sub.status === "ACTIVE" && (
                    <button onClick={() => onCancelSubscription(sub.id)}
                      className="px-3 py-1 rounded-lg bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20">
                      Cancel
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {detailTab === "payments" && (
          <div className="overflow-x-auto">
            {detail.recentPayments.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No payments</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-3 py-2 text-xs text-white/30">Amount</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Status</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Type</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentPayments.map((p) => (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="px-3 py-2 text-white">{formatCurrency(p.amount)}</td>
                      <td className="px-3 py-2">{statusBadge(p.status)}</td>
                      <td className="px-3 py-2 text-white/40">{p.type}</td>
                      <td className="px-3 py-2 text-white/30 text-xs">{formatDate(p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {detailTab === "chats" && (
          <div className="space-y-2">
            {detail.recentChats.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No chat sessions</p>
            ) : (
              detail.recentChats.map((c) => (
                <div key={c.id} className="p-3 rounded-lg bg-white/[0.03] flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{c.title}</p>
                    <p className="text-xs text-white/30">{c.category} &middot; {c.messageCount} messages</p>
                  </div>
                  <span className="text-xs text-white/30">{formatDate(c.updatedAt)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {detailTab === "credits" && (
          <div className="overflow-x-auto">
            {detail.creditTransactions.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No credit transactions</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-3 py-2 text-xs text-white/30">Amount</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Type</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Description</th>
                    <th className="text-left px-3 py-2 text-xs text-white/30">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.creditTransactions.map((t) => (
                    <tr key={t.id} className="border-b border-white/5">
                      <td className={`px-3 py-2 font-medium ${t.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.amount > 0 ? "+" : ""}{t.amount}
                      </td>
                      <td className="px-3 py-2 text-white/40">{t.type.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-white/30 text-xs">{t.description || "-"}</td>
                      <td className="px-3 py-2 text-white/30 text-xs">{formatDateTime(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {detailTab === "reports" && (
          <div className="space-y-2">
            {detail.reports.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-6">No reports generated</p>
            ) : (
              detail.reports.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-white/[0.03] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white">{r.type} Report</span>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-xs text-white/30">{formatCurrency(r.price)}</p>
                  </div>
                  <span className="text-xs text-white/30">{formatDate(r.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
