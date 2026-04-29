"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { FunnelCounts, CohortRow, PaymentFailureRow } from "./types";

// Supported locales are mirrored from the web i18n constants. The tab
// doesn't own translation, just filtering — keeping it inline here
// avoids pulling the heavy i18n store into the admin bundle.
const LOCALE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "",   label: "All locales" },
  { value: "en", label: "English (en)" },
  { value: "hi", label: "Hindi (hi)" },
  { value: "ta", label: "Tamil (ta)" },
  { value: "te", label: "Telugu (te)" },
  { value: "bn", label: "Bengali (bn)" },
  { value: "mr", label: "Marathi (mr)" },
  { value: "gu", label: "Gujarati (gu)" },
  { value: "kn", label: "Kannada (kn)" },
  { value: "ml", label: "Malayalam (ml)" },
  { value: "pa", label: "Punjabi (pa)" },
  { value: "or", label: "Odia (or)" },
  { value: "as", label: "Assamese (as)" },
];

const PERIOD_OPTIONS: Array<{ value: 7 | 30 | 90; label: string }> = [
  { value: 7,  label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

export function FunnelTab({ token }: { token: string }) {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [locale, setLocale] = useState<string>("");
  const [weeks] = useState<number>(12);

  const [funnel, setFunnel] = useState<FunnelCounts | null>(null);
  const [cohorts, setCohorts] = useState<CohortRow[] | null>(null);
  const [failures, setFailures] = useState<PaymentFailureRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const qs = locale ? `&locale=${encodeURIComponent(locale)}` : "";
      const [funnelRes, cohortsRes, failuresRes] = await Promise.all([
        api.get<FunnelCounts>(`/admin/funnel?days=${days}${qs}`, { token }),
        api.get<CohortRow[]>(`/admin/cohorts?weeks=${weeks}${qs}`, { token }),
        // Payment failures aren't locale-bound — they stay scoped to
        // the same period window so the tab reads as one coherent view.
        api.get<PaymentFailureRow[]>(`/admin/payment-failures?days=${days}`, { token }),
      ]);
      setFunnel(funnelRes);
      setCohorts(Array.isArray(cohortsRes) ? cohortsRes : []);
      setFailures(Array.isArray(failuresRes) ? failuresRes : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load funnel data");
    } finally {
      setLoading(false);
    }
  }, [token, days, locale, weeks]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {error && (
        <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="flex items-center gap-2">
          <label htmlFor="funnel-period" className="text-xs text-surface-900/40">Period:</label>
          <select
            id="funnel-period"
            data-testid="funnel-period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as 7 | 30 | 90)}
            className="px-3 py-2 rounded-xl bg-surface-900/[0.03] border border-surface-900/[0.06] text-surface-900 text-sm"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="funnel-locale" className="text-xs text-surface-900/40">Locale:</label>
          <select
            id="funnel-locale"
            data-testid="funnel-locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="px-3 py-2 rounded-xl bg-surface-900/[0.03] border border-surface-900/[0.06] text-surface-900 text-sm"
          >
            {LOCALE_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        {loading && (
          <span className="text-xs text-surface-900/30">Loading…</span>
        )}
      </div>

      <FunnelChart data={funnel} />

      <h2 className="text-lg font-bold text-surface-900 mt-10 mb-4">Cohort retention</h2>
      <p className="text-xs text-surface-900/40 mb-4">
        Weekly signup cohorts. Each cell is the share of that cohort that opened
        a chat session in week N after signup.
      </p>
      <CohortGrid data={cohorts} weeks={weeks} />

      <h2 className="text-lg font-bold text-surface-900 mt-10 mb-4">Payment failures</h2>
      <p className="text-xs text-surface-900/40 mb-4">
        Payments in FAILED / REFUNDED status in the selected window. A sudden
        spike here usually precedes a churn uptick by 1–2 weeks.
      </p>
      <PaymentFailureList data={failures} windowDays={days} />
    </div>
  );
}

// ─── Funnel chart ─────────────────────────────────────────────────────────

function FunnelChart({ data }: { data: FunnelCounts | null }) {
  if (!data) {
    return (
      <div className="surface-card p-6 text-surface-900/30 text-sm">No funnel data.</div>
    );
  }
  const max = Math.max(1, ...data.stages.map((s) => s.count));
  return (
    <div className="surface-card p-6" data-testid="funnel-chart">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-surface-900">Acquisition funnel</h3>
        <span className="text-xs text-surface-900/40 tabular-nums">
          {data.totalSignups} signups · {data.windowDays}d
          {data.locale ? ` · ${data.locale}` : ""}
        </span>
      </div>
      <div className="space-y-3">
        {data.stages.map((s) => {
          const width = (s.count / max) * 100;
          return (
            <div key={s.stage} data-testid={`funnel-stage-${s.stage}`} className="group">
              <div className="flex items-center justify-between text-xs text-surface-900/60 mb-1">
                <span>{s.label}</span>
                <span className="tabular-nums">
                  {s.count.toLocaleString()} ·
                  {" "}{formatPct(s.conversionFromSignup)} of signups ·
                  {" "}{formatPct(s.conversionFromPrev)} from prior
                </span>
              </div>
              <div className="h-6 rounded-lg bg-surface-900/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-lg bg-gradient-to-r from-primary-500/80 to-accent-500/60"
                  style={{ width: `${Math.max(width, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cohort grid ──────────────────────────────────────────────────────────

function CohortGrid({ data, weeks }: { data: CohortRow[] | null; weeks: number }) {
  if (!data || data.length === 0) {
    return (
      <div className="surface-card p-6 text-surface-900/30 text-sm">
        No cohorts yet — check back once users have been active for a week.
      </div>
    );
  }
  const header = Array.from({ length: weeks }, (_, i) => `W${i}`);
  return (
    <div className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="cohort-grid">
          <thead>
            <tr className="border-b border-surface-900/[0.06]">
              <th className="text-left px-3 py-2 font-medium text-surface-900/40">Cohort</th>
              <th className="text-left px-3 py-2 font-medium text-surface-900/40">Size</th>
              {header.map((h) => (
                <th key={h} className="text-right px-2 py-2 font-medium text-surface-900/40">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.cohortWeek} className="border-b border-surface-900/[0.03]">
                <td className="px-3 py-2 text-surface-900/70 whitespace-nowrap">{row.cohortWeek}</td>
                <td className="px-3 py-2 text-surface-900/60 tabular-nums">{row.size}</td>
                {header.map((_, i) => {
                  const pct = row.retention[i] ?? 0;
                  return (
                    <td key={i} className="px-2 py-2 tabular-nums text-right">
                      <span
                        className="inline-block rounded px-1.5 py-0.5"
                        style={{
                          backgroundColor: heatColor(pct),
                          color: pct > 40 ? "#fff" : "rgba(255,255,255,0.6)",
                        }}
                      >
                        {pct.toFixed(0)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Payment failures ─────────────────────────────────────────────────────

function PaymentFailureList({ data, windowDays }: { data: PaymentFailureRow[] | null; windowDays: number }) {
  if (!data || data.length === 0) {
    return (
      <div className="surface-card p-6 text-surface-900/30 text-sm">
        No failed or refunded payments in the last {windowDays} days.
      </div>
    );
  }
  return (
    <div className="surface-card overflow-hidden" data-testid="payment-failures">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-900/[0.06]">
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-900/40">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-900/40">Amount</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-900/40">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-900/40">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-surface-900/40">When</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-b border-surface-900/5">
                <td className="px-4 py-3 text-surface-900">
                  {p.userName}
                  <br />
                  <span className="text-xs text-surface-900/30">{p.userEmail}</span>
                </td>
                <td className="px-4 py-3 text-surface-900/60 tabular-nums">
                  {p.currency} {p.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    p.status === "REFUNDED"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-red-500/20 text-red-400"
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-surface-900/40">{p.type}</td>
                <td className="px-4 py-3 text-surface-900/30 text-xs">
                  {new Date(p.createdAt).toLocaleString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function heatColor(pct: number): string {
  // Perceptual ramp — darker green as retention climbs. 0→transparent.
  if (pct <= 0) return "rgba(255,255,255,0.02)";
  const alpha = Math.min(1, 0.15 + pct / 100);
  return `rgba(16, 185, 129, ${alpha.toFixed(2)})`;
}

function formatPct(frac: number): string {
  return `${(frac * 100).toFixed(1)}%`;
}
