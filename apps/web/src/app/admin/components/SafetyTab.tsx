"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
  FlaggedMessageRow,
  FlaggedStatus,
  ResolveAction,
} from "./types";

const STATUS_OPTIONS: Array<{ value: FlaggedStatus; label: string }> = [
  { value: "pending",   label: "Pending" },
  { value: "approved",  label: "Approved" },
  { value: "hidden",    label: "Hidden" },
  { value: "actioned",  label: "Actioned" },
];

const ACTIONS: Array<{ id: ResolveAction; label: string; tone: string }> = [
  { id: "approve",  label: "Approve",  tone: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" },
  { id: "hide",     label: "Hide",     tone: "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" },
  { id: "actioned", label: "Actioned", tone: "bg-red-500/10 text-red-400 hover:bg-red-500/20" },
];

export function SafetyTab({ token }: { token: string }) {
  const [status, setStatus] = useState<FlaggedStatus>("pending");
  const [rows, setRows] = useState<FlaggedMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<FlaggedMessageRow[]>(
        `/admin/safety/flagged?status=${status}&limit=100`,
        { token },
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load flagged messages");
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string, action: ResolveAction) => {
    setPendingId(id);
    setError("");
    try {
      await api.post(`/admin/safety/flagged/${id}/resolve`, { action }, { token });
      setFlash(`Message ${action}d.`);
      setTimeout(() => setFlash(""), 2500);
      load();
    } catch (err: any) {
      setError(err?.message || "Failed to resolve flagged message");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}
      {flash && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {flash}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <label htmlFor="safety-status" className="text-xs text-surface-50/40">Status:</label>
        <select
          id="safety-status"
          data-testid="safety-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as FlaggedStatus)}
          className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-surface-50 text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={load}
          className="px-3 py-2 rounded-xl surface-card text-sm text-surface-50/60 hover:bg-white/10"
        >
          Refresh
        </button>
        {loading && <span className="text-xs text-surface-50/30">Loading…</span>}
      </div>

      {rows.length === 0 ? (
        <div className="surface-card p-6 text-surface-50/30 text-sm">
          {status === "pending"
            ? "No pending flagged messages — zero backlog 🎉"
            : `No ${status} messages.`}
        </div>
      ) : (
        <div className="space-y-3" data-testid="flagged-list">
          {rows.map((r) => (
            <div
              key={r.id}
              className="surface-card p-5"
              data-testid={`flagged-row-${r.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm text-surface-50">{r.userName ?? "(deleted user)"}</p>
                  <p className="text-xs text-surface-50/40">{r.userEmail ?? r.userId}</p>
                </div>
                <span className="text-xs text-surface-50/30 tabular-nums">
                  {new Date(r.createdAt).toLocaleString("en-IN", {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>

              {r.categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {r.categories.map((c) => (
                    <span
                      key={c}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {r.preview && (
                <div className="mb-3 p-3 rounded-lg bg-white/[0.03] text-sm text-surface-50/80 whitespace-pre-wrap">
                  {r.preview}
                </div>
              )}

              <ScoreGrid scores={r.scores} />

              {status === "pending" && (
                <div className="flex gap-2 mt-4">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => resolve(r.id, a.id)}
                      disabled={pendingId === r.id}
                      data-testid={`resolve-${a.id}-${r.id}`}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 ${a.tone}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreGrid({ scores }: { scores: Record<string, number> }) {
  const entries = Object.entries(scores)
    .filter(([, v]) => typeof v === "number" && v > 0.01)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 6);
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {entries.map(([k, v]) => {
        const pct = Math.round((v as number) * 100);
        const tone =
          pct >= 50 ? "text-red-400" : pct >= 20 ? "text-amber-400" : "text-surface-50/60";
        return (
          <div key={k} className="text-[11px] flex items-center justify-between bg-white/[0.02] px-2 py-1 rounded">
            <span className="text-surface-50/50 truncate max-w-[120px]">{k}</span>
            <span className={`tabular-nums ${tone}`}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
