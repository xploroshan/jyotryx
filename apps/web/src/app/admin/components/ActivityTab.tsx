"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Badge, TabError, errorMessage, formatDateTime } from "./helpers";
import type { ActivityLog } from "./types";

export function ActivityTab({ token }: { token: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [undoing, setUndoing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (actionFilter) params.set("action", actionFilter);
      const res = await api.get<{ logs: ActivityLog[]; total: number }>(`/admin/activity?${params}`, { token });
      setLogs(res.logs);
      setTotal(res.total);
    } catch (err) {
      // Distinguish "fetch failed" from "no activity yet". The previous
      // code masked errors as an empty list, so a 500 on /admin/activity
      // showed the same "No activity logged yet" message as a healthy
      // brand-new install.
      // eslint-disable-next-line no-console
      console.error("[admin/activity] failed to load", err);
      setLoadError(errorMessage(err));
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, actionFilter]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleUndo = async (logId: string) => {
    if (!confirm("Are you sure you want to undo this action? This will revert the changes.")) return;
    setUndoing(logId);
    setMessage(null);
    try {
      const res = await api.post<{ success: boolean; message: string }>(`/admin/activity/${logId}/undo`, {}, { token });
      setMessage({ type: "success", text: res.message });
      loadLogs();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to undo" });
    } finally {
      setUndoing(null);
    }
  };

  const actionLabels: Record<string, string> = {
    USER_UPDATE: "User Updated",
    USER_DELETE: "User Deleted",
    USER_CREDITS_UPDATE: "Credits Changed",
    USER_ROLE_CHANGE: "Role Changed",
    SUBSCRIPTION_CANCEL: "Subscription Cancelled",
    SUBSCRIPTION_UPDATE: "Subscription Updated",
  };

  const actionColors: Record<string, string> = {
    USER_UPDATE: "text-blue-400 bg-blue-500/10",
    USER_DELETE: "text-red-400 bg-red-500/10",
    USER_CREDITS_UPDATE: "text-amber-400 bg-amber-500/10",
    USER_ROLE_CHANGE: "text-purple-400 bg-purple-500/10",
    SUBSCRIPTION_CANCEL: "text-red-400 bg-red-500/10",
    SUBSCRIPTION_UPDATE: "text-cyan-400 bg-cyan-500/10",
  };

  function renderChanges(prev: any, next: any) {
    if (!prev && !next) return null;
    const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
    return (
      <div className="mt-2 space-y-1">
        {Array.from(allKeys).map((key) => (
          <div key={key} className="text-xs flex items-center gap-2">
            <span className="text-white/30 w-20 shrink-0">{key}:</span>
            {prev?.[key] !== undefined && (
              <span className="text-red-400 line-through">{String(prev[key])}</span>
            )}
            {next?.[key] !== undefined && (
              <>
                <span className="text-white/20">&rarr;</span>
                <span className="text-emerald-400">{String(next[key])}</span>
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gradient">Activity Log</h2>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/60 text-sm">
          <option value="">All Actions</option>
          <option value="USER_UPDATE">User Updates</option>
          <option value="USER_DELETE">User Deletions</option>
          <option value="USER_CREDITS_UPDATE">Credit Changes</option>
          <option value="USER_ROLE_CHANGE">Role Changes</option>
          <option value="SUBSCRIPTION_CANCEL">Subscription Cancellations</option>
        </select>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
          {message.text}
        </div>
      )}

      <p className="text-sm text-white/30 mb-4">{total} total actions recorded</p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="w-6 h-6 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : loadError ? (
        <TabError message={loadError} onRetry={loadLogs} />
      ) : logs.length === 0 ? (
        <div className="surface-card p-8 text-center text-white/30">
          <p className="text-lg mb-2">No activity logged yet</p>
          <p className="text-sm">Admin actions like user edits, deletions, and subscription changes will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className={`surface-card p-4 ${log.undone ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[log.action] || "text-white/40 bg-white/[0.03]"}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                    {log.undone && <Badge variant="warning">UNDONE</Badge>}
                  </div>
                  <p className="text-sm text-white">
                    {log.entityType}: <span className="text-primary-400">{log.entityLabel || log.entityId}</span>
                  </p>
                  <p className="text-xs text-white/30 mt-1">
                    by {log.adminEmail} &middot; {formatDateTime(log.createdAt)}
                    {log.undone && log.undoneAt && <span> &middot; Undone at {formatDateTime(log.undoneAt)}</span>}
                  </p>
                  {renderChanges(log.previousData, log.newData)}
                </div>
                {!log.undone && log.action !== "USER_DELETE" && (
                  <button
                    onClick={() => handleUndo(log.id)}
                    disabled={undoing === log.id}
                    className="shrink-0 ml-4 px-3 py-1.5 rounded-lg bg-amber-500/10 text-xs text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
                  >
                    {undoing === log.id ? "Undoing..." : "Undo"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg surface-card text-xs text-white/60 disabled:opacity-30">Prev</button>
          <span className="text-sm text-white/40">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg surface-card text-xs text-white/60 disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}
