"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { formatCurrency, formatDateTime, statusBadge, TabError, errorMessage } from "./helpers";

// ─── Types (mirror the admin payment endpoints) ─────────────────────────────

interface PaymentMetrics {
  revenue: { today: number; last7: number; last30: number; gross: number };
  byType: Array<{ type: string; count: number; amount: number }>;
  successRate: number;
  refundRate: number;
  pendingStuck: number;
  dailyRevenue: Array<{ date: string; amount: number }>;
  windowDays: number;
}

interface PaymentsHealth {
  pendingStuck: number;
  succeeded24h: number;
  failed24h: number;
  refunded24h: number;
  successRate24h: number;
  lastPaymentAt: string | null;
}

interface PaymentRow {
  id: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  provider: string;
  gatewayOrderId: string | null;
  createdAt: string;
}

const PAGE_SIZE = 25;
const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function PaymentsTab({ token }: { token: string }) {
  const [metrics, setMetrics] = useState<PaymentMetrics | null>(null);
  const [health, setHealth] = useState<PaymentsHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // List + filters
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(false);

  // Refund + action feedback
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const loadList = useCallback(
    async (toPage = page) => {
      setListLoading(true);
      try {
        const params = new URLSearchParams({ page: String(toPage), limit: String(PAGE_SIZE) });
        if (status) params.set("status", status);
        if (type) params.set("type", type);
        if (search.trim()) params.set("search", search.trim());
        const res = await api.get<{ payments: PaymentRow[]; total: number }>(
          `/admin/payments?${params.toString()}`,
          { token },
        );
        setRows(res.payments);
        setTotal(res.total);
        setPage(toPage);
      } catch (err) {
        setNotice({ kind: "err", text: errorMessage(err) });
      }
      setListLoading(false);
    },
    [token, page, status, type, search],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, h] = await Promise.all([
        api.get<PaymentMetrics>("/admin/payments/metrics?days=30", { token }),
        api.get<PaymentsHealth>("/admin/payments/health", { token }),
      ]);
      setMetrics(m);
      setHealth(h);
      await loadList(1);
    } catch (err) {
      setError(errorMessage(err));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Re-fetch the list when a dropdown filter changes (search uses the button).
  useEffect(() => {
    if (!loading) loadList(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type]);

  const refund = async (p: PaymentRow) => {
    if (
      !window.confirm(
        `Refund ${formatCurrency(p.amount)} to ${p.userEmail}?\n\nThis asks Cashfree to refund the payment and will claw back the credits/unlock once Cashfree confirms. It cannot be undone here.`,
      )
    ) {
      return;
    }
    setRefundingId(p.id);
    setNotice(null);
    try {
      await api.post(`/admin/payments/${p.id}/refund`, {}, { token });
      setNotice({ kind: "ok", text: `Refund initiated for ${p.userEmail}. It will settle as REFUNDED shortly.` });
      await Promise.all([loadList(page), api.get<PaymentsHealth>("/admin/payments/health", { token }).then(setHealth)]);
    } catch (err) {
      setNotice({ kind: "err", text: errorMessage(err) });
    }
    setRefundingId(null);
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

  if (error) return <TabError message={error} onRetry={load} />;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const typeColors: Record<string, string> = {
    CREDITS: "from-blue-500 to-cyan-500",
    SUBSCRIPTION: "from-purple-500 to-violet-500",
    REPORT: "from-amber-500 to-yellow-500",
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gradient mb-6">Payments</h2>

      {notice && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            notice.kind === "ok"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500"
              : "bg-red-500/10 border border-red-500/20 text-red-500"
          }`}
        >
          {notice.text}
        </div>
      )}

      {/* Health strip */}
      {health && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className={`surface-card p-4 ${health.pendingStuck > 0 ? "ring-1 ring-amber-500/40" : ""}`}>
            <p className="text-xs text-ink-500 mb-1">Stuck (pending &gt;15m)</p>
            <p className={`text-2xl font-bold ${health.pendingStuck > 0 ? "text-amber-500" : "text-ink-900"}`}>
              {health.pendingStuck}
            </p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-ink-500 mb-1">Success rate (24h)</p>
            <p className="text-2xl font-bold text-ink-900">{pct(health.successRate24h)}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-ink-500 mb-1">Succeeded (24h)</p>
            <p className="text-2xl font-bold text-emerald-500">{health.succeeded24h}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-ink-500 mb-1">Failed (24h)</p>
            <p className="text-2xl font-bold text-red-400">{health.failed24h}</p>
          </div>
          <div className="surface-card p-4">
            <p className="text-xs text-ink-500 mb-1">Refunded (24h)</p>
            <p className="text-2xl font-bold text-ink-900">{health.refunded24h}</p>
          </div>
        </div>
      )}

      {/* Revenue KPIs */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Revenue today", value: formatCurrency(metrics.revenue.today) },
            { label: "Revenue (7d)", value: formatCurrency(metrics.revenue.last7) },
            { label: "Revenue (30d)", value: formatCurrency(metrics.revenue.last30) },
            { label: "Gross (all time)", value: formatCurrency(metrics.revenue.gross) },
          ].map((m) => (
            <div key={m.label} className="surface-card p-5">
              <p className="text-xs text-ink-500 mb-1">{m.label}</p>
              <p className="text-2xl font-bold text-ink-900 tabular-nums">{m.value}</p>
            </div>
          ))}
          <div className="surface-card p-5">
            <p className="text-xs text-ink-500 mb-1">Success rate ({metrics.windowDays}d)</p>
            <p className="text-2xl font-bold text-emerald-500">{pct(metrics.successRate)}</p>
          </div>
          <div className="surface-card p-5">
            <p className="text-xs text-ink-500 mb-1">Refund rate ({metrics.windowDays}d)</p>
            <p className="text-2xl font-bold text-ink-900">{pct(metrics.refundRate)}</p>
          </div>
        </div>
      )}

      {/* Revenue trend + by type */}
      {metrics && (
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="surface-card p-6">
            <h3 className="text-sm font-bold text-ink-900 mb-4">Daily revenue ({metrics.windowDays}d)</h3>
            {metrics.dailyRevenue.length === 0 ? (
              <p className="text-sm text-ink-500 text-center py-8">No successful payments yet.</p>
            ) : (
              (() => {
                const max = Math.max(...metrics.dailyRevenue.map((d) => d.amount), 1);
                return (
                  <div className="flex items-end gap-1 h-40">
                    {metrics.dailyRevenue.map((d) => (
                      <div key={d.date} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: ${formatCurrency(d.amount)}`}>
                        <div
                          className="w-full bg-gradient-to-t from-primary-600 to-mystic-500 rounded-t transition-all"
                          style={{ height: `${Math.max((d.amount / max) * 100, 1)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>

          <div className="surface-card p-6">
            <h3 className="text-sm font-bold text-ink-900 mb-4">Revenue by product ({metrics.windowDays}d)</h3>
            {metrics.byType.length === 0 ? (
              <p className="text-sm text-ink-500 text-center py-8">No revenue in this window.</p>
            ) : (
              (() => {
                const max = Math.max(...metrics.byType.map((t) => t.amount), 1);
                return metrics.byType.map((t) => (
                  <div key={t.type} className="flex items-center gap-3 mb-3 last:mb-0">
                    <span className="text-xs text-ink-500 w-28 shrink-0">{t.type}</span>
                    <div className="flex-1 h-3 bg-black/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${typeColors[t.type] ?? "from-slate-500 to-slate-400"} rounded-full`}
                        style={{ width: `${(t.amount / max) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-ink-900 w-24 text-right tabular-nums">{formatCurrency(t.amount)}</span>
                    <span className="text-xs text-ink-500 w-12 text-right">×{t.count}</span>
                  </div>
                ));
              })()
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-1.5 rounded-lg bg-black/[0.04] border border-black/[0.10] text-ink-900 text-xs">
          <option value="">All statuses</option>
          {["PENDING", "SUCCESS", "FAILED", "REFUNDED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="px-3 py-1.5 rounded-lg bg-black/[0.04] border border-black/[0.10] text-ink-900 text-xs">
          <option value="">All types</option>
          {["CREDITS", "SUBSCRIPTION", "REPORT"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") loadList(1); }}
          placeholder="Search name or email…"
          className="px-3 py-1.5 rounded-lg bg-black/[0.04] border border-black/[0.10] text-ink-900 text-xs flex-1 min-w-[180px]"
        />
        <button onClick={() => loadList(1)} className="px-3 py-1.5 rounded-lg btn-secondary text-xs font-medium">Search</button>
      </div>

      {/* Payments table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.10]">
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">User</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-ink-500">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">When</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-ink-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !listLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-500">No payments match.</td></tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="border-b border-black/5 hover:bg-black/[0.04]">
                    <td className="px-4 py-3 text-ink-900">
                      {p.userName}
                      <br /><span className="text-xs text-ink-500">{p.userEmail}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-700 tabular-nums">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3">{statusBadge(p.status)}</td>
                    <td className="px-4 py-3 text-ink-500">{p.type}</td>
                    <td className="px-4 py-3 text-ink-500 text-xs">{formatDateTime(p.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {p.status === "SUCCESS" ? (
                        <button
                          onClick={() => refund(p)}
                          disabled={refundingId === p.id}
                          className="px-3 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium disabled:opacity-50"
                        >
                          {refundingId === p.id ? "Refunding…" : "Refund"}
                        </button>
                      ) : (
                        <span className="text-xs text-ink-500">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-black/[0.10] text-xs text-ink-500">
          <span>{total.toLocaleString()} payment{total === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => loadList(page - 1)} disabled={page <= 1 || listLoading} className="px-2 py-1 rounded bg-black/[0.05] disabled:opacity-40">Prev</button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={() => loadList(page + 1)} disabled={page >= totalPages || listLoading} className="px-2 py-1 rounded bg-black/[0.05] disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
