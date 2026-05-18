"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  const [grantOpen, setGrantOpen] = useState(false);

  const reload = useCallback(async () => {
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
  }, [userId, token]);

  useEffect(() => {
    reload();
  }, [reload]);

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
      <div className="p-6 border-b border-black/[0.10]">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-xl font-bold text-ink-900">{detail.name}</h3>
              {roleBadge(detail.role)}
            </div>
            <p className="text-sm text-ink-500">{detail.email}</p>
            {detail.phone && <p className="text-sm text-ink-500">{detail.phone}</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setGrantOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-xs text-emerald-400 hover:bg-emerald-500/20"
            >
              + Grant credits
            </button>
            <button onClick={() => onEdit(detail)} className="px-3 py-1.5 rounded-lg surface-card text-xs text-primary-400 hover:bg-black/10">Edit</button>
            {/* Impersonate — only for non-admin targets. The button
                requests a 1-hour impersonation JWT from the admin API,
                then hands it off via the /?__imp=<token> URL parameter
                which the client-side ImpersonateHandler swaps into the
                auth store. Every call is logged to activity_log. */}
            {detail.role !== "ADMIN" && (
              <button
                onClick={async () => {
                  const confirmed = window.confirm(
                    `Log in as ${detail.email}? A 1-hour impersonation session will open in a new tab and be recorded in the activity log.`,
                  );
                  if (!confirmed) return;
                  try {
                    const res = await api.post<{ accessToken: string; expiresAt: string }>(
                      `/admin/users/${detail.id}/impersonate`,
                      {},
                      { token },
                    );
                    // Hand off via query param so the target tab has a
                    // clean entry point; the handler component reads
                    // __imp, swaps the token into useAuthStore, and
                    // strips it from the URL before the user sees it.
                    window.open(`/?__imp=${encodeURIComponent(res.accessToken)}`, "_blank", "noopener");
                  } catch (err: any) {
                    window.alert(err?.message || "Impersonation failed");
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-xs text-amber-400 hover:bg-amber-500/20"
              >
                Log in as user
              </button>
            )}
            <button onClick={() => onDelete(detail.id)} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20">Delete</button>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg surface-card text-xs text-ink-500 hover:bg-black/10">&times; Close</button>
          </div>
        </div>

        {/* Stats row — "Usage" sits directly next to "Credits" so the
            balance and lifetime spend read together at a glance. */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 mt-4">
          {[
            { label: "Credits", value: detail.credits, color: "text-primary-400" },
            { label: "Usage", value: detail.stats.totalCreditsUsed, color: "text-amber-400" },
            { label: "Chats", value: detail.stats.totalChats, color: "text-blue-400" },
            { label: "Payments", value: detail.stats.totalPayments, color: "text-emerald-400" },
            { label: "Spent", value: formatCurrency(detail.stats.totalSpent), color: "text-emerald-400" },
            { label: "Kundlis", value: detail.stats.kundliCharts, color: "text-mystic-400" },
            { label: "Matchings", value: detail.stats.matchingResults, color: "text-pink-400" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-ink-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 pt-3 overflow-x-auto">
        {detailTabs.map((t) => (
          <button key={t.id} onClick={() => setDetailTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${detailTab === t.id ? "bg-primary-600/30 text-primary-400" : "text-ink-500 hover:text-ink-700"}`}>
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
              <div key={item.label} className="flex justify-between p-3 rounded-lg bg-black/[0.04]">
                <span className="text-xs text-ink-500">{item.label}</span>
                <span className="text-sm text-ink-700">{item.value}</span>
              </div>
            ))}
          </div>
        )}

        {detailTab === "subscriptions" && (
          <div className="space-y-3">
            {detail.subscriptions.length === 0 ? (
              <p className="text-ink-500 text-sm text-center py-6">No subscriptions</p>
            ) : (
              detail.subscriptions.map((sub) => (
                <div key={sub.id} className="p-4 rounded-lg bg-black/[0.04] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-ink-900">{sub.plan} Plan</span>
                      {statusBadge(sub.status)}
                    </div>
                    <p className="text-xs text-ink-500">
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
              <p className="text-ink-500 text-sm text-center py-6">No payments</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.10]">
                    <th className="text-left px-3 py-2 text-xs text-ink-500">Amount</th>
                    <th className="text-left px-3 py-2 text-xs text-ink-500">Status</th>
                    <th className="text-left px-3 py-2 text-xs text-ink-500">Type</th>
                    <th className="text-left px-3 py-2 text-xs text-ink-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentPayments.map((p) => (
                    <tr key={p.id} className="border-b border-black/5">
                      <td className="px-3 py-2 text-ink-900">{formatCurrency(p.amount)}</td>
                      <td className="px-3 py-2">{statusBadge(p.status)}</td>
                      <td className="px-3 py-2 text-ink-500">{p.type}</td>
                      <td className="px-3 py-2 text-ink-500 text-xs">{formatDate(p.createdAt)}</td>
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
              <p className="text-ink-500 text-sm text-center py-6">No chat sessions</p>
            ) : (
              detail.recentChats.map((c) => (
                <div key={c.id} className="p-3 rounded-lg bg-black/[0.04] flex items-center justify-between">
                  <div>
                    <p className="text-sm text-ink-900">{c.title}</p>
                    <p className="text-xs text-ink-500">{c.category} &middot; {c.messageCount} messages</p>
                  </div>
                  <span className="text-xs text-ink-500">{formatDate(c.updatedAt)}</span>
                </div>
              ))
            )}
          </div>
        )}

        {detailTab === "credits" && (
          <div className="space-y-4">
            {/* Per-feature spend breakdown — server-side group-by on
                `credit_transactions.description`, so this answers
                "where did their credits actually go" without the
                client having to recompute on every render. */}
            {detail.creditsByFeature.length > 0 && (
              <div className="rounded-lg bg-black/[0.04] p-3">
                <p className="text-[10px] uppercase tracking-wide text-ink-500 mb-2">
                  Spend by feature
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {detail.creditsByFeature.map((f) => (
                    <div key={f.feature} className="flex items-baseline justify-between rounded bg-black/[0.05] px-2 py-1.5">
                      <span className="text-xs text-ink-700">{f.feature}</span>
                      <span className="text-sm font-medium text-amber-400 tabular-nums">
                        {f.totalCredits}
                        <span className="text-[10px] text-ink-500 ml-1">×{f.count}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {detail.creditTransactions.length === 0 ? (
                <p className="text-ink-500 text-sm text-center py-6">No credit transactions</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/[0.10]">
                      <th className="text-left px-3 py-2 text-xs text-ink-500">Amount</th>
                      <th className="text-left px-3 py-2 text-xs text-ink-500">Type</th>
                      <th className="text-left px-3 py-2 text-xs text-ink-500">Description</th>
                      <th className="text-left px-3 py-2 text-xs text-ink-500">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.creditTransactions.map((t) => (
                      <tr key={t.id} className="border-b border-black/5">
                        <td className={`px-3 py-2 font-medium ${t.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {t.amount > 0 ? "+" : ""}{t.amount}
                        </td>
                        <td className="px-3 py-2 text-ink-500">{t.type.replace(/_/g, " ")}</td>
                        <td className="px-3 py-2 text-ink-500 text-xs">{t.description || "-"}</td>
                        <td className="px-3 py-2 text-ink-500 text-xs">{formatDateTime(t.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {detailTab === "reports" && (
          <div className="space-y-2">
            {detail.reports.length === 0 ? (
              <p className="text-ink-500 text-sm text-center py-6">No reports generated</p>
            ) : (
              detail.reports.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-black/[0.04] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-ink-900">{r.type} Report</span>
                      {statusBadge(r.status)}
                    </div>
                    <p className="text-xs text-ink-500">{formatCurrency(r.price)}</p>
                  </div>
                  <span className="text-xs text-ink-500">{formatDate(r.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {grantOpen && (
        <GrantCreditsModal
          userEmail={detail.email}
          currentCredits={detail.credits}
          onClose={() => setGrantOpen(false)}
          onGranted={async () => {
            setGrantOpen(false);
            await reload();
          }}
          token={token}
          userId={detail.id}
        />
      )}
    </div>
  );
}

function GrantCreditsModal({
  userId,
  userEmail,
  currentCredits,
  token,
  onClose,
  onGranted,
}: {
  userId: string;
  userEmail: string;
  currentCredits: number;
  token: string;
  onClose: () => void;
  onGranted: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState<string>("10");
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(amount, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErr("Amount must be a positive integer");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await api.post(`/admin/users/${userId}/credits/grant`, { amount: parsed, reason: reason || undefined }, { token });
      await onGranted();
    } catch (e: any) {
      setErr(errorMessage(e) || "Failed to grant credits");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="surface-card w-[min(420px,90vw)] p-6 space-y-4"
      >
        <div>
          <h3 className="text-lg font-semibold text-ink-900">Grant credits</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            {userEmail} · current balance <span className="text-primary-400">{currentCredits}</span>
          </p>
        </div>

        <label className="block">
          <span className="text-xs text-ink-500">Amount</span>
          <input
            autoFocus
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full bg-black/[0.05] border border-black/10 rounded-lg px-3 py-2 text-sm text-ink-900"
          />
        </label>

        <label className="block">
          <span className="text-xs text-ink-500">Reason (optional, recorded in transaction)</span>
          <input
            type="text"
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Apology for outage on 2026-04-26"
            className="mt-1 w-full bg-black/[0.05] border border-black/10 rounded-lg px-3 py-2 text-sm text-ink-900"
          />
        </label>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-ink-700 hover:bg-black/10">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-xs text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50"
          >
            {submitting ? "Granting…" : `Grant ${amount || 0} credits`}
          </button>
        </div>
      </form>
    </div>
  );
}
