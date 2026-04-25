"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { GdprRequestRow, GdprStatus, GdprType } from "./types";

const STATUS_OPTIONS: Array<{ value: GdprStatus; label: string }> = [
  { value: "pending",   label: "Pending" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "rejected",  label: "Rejected" },
];

export function GdprTab({ token }: { token: string }) {
  const [status, setStatus] = useState<GdprStatus>("pending");
  const [rows, setRows] = useState<GdprRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<GdprRequestRow[]>(
        `/admin/gdpr/requests?status=${status}&limit=100`,
        { token },
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load GDPR requests");
    } finally {
      setLoading(false);
    }
  }, [token, status]);

  useEffect(() => { load(); }, [load]);

  const fulfill = async (id: string, userEmail: string | null) => {
    if (!confirm(`Fulfill GDPR request for ${userEmail ?? id}? For "delete" this permanently purges the user. For "export" it downloads their data.`)) return;
    setPendingId(id);
    setError("");
    try {
      const res = await api.post<{ row: GdprRequestRow; exportPayload?: unknown }>(
        `/admin/gdpr/requests/${id}/fulfill`,
        {},
        { token },
      );
      if (res.exportPayload) {
        downloadJson(res.exportPayload, `gdpr-export-${res.row.userId}-${id}.json`);
      }
      setFlash(
        res.row.type === "export"
          ? "Export bundled — download started."
          : "User deleted. Purge complete.",
      );
      setTimeout(() => setFlash(""), 3500);
      load();
    } catch (err: any) {
      setError(err?.message || "Fulfillment failed");
    } finally {
      setPendingId(null);
    }
  };

  const reject = async (id: string) => {
    const note = prompt("Why is this being rejected? (required)");
    if (!note) return;
    setPendingId(id);
    setError("");
    try {
      await api.post(`/admin/gdpr/requests/${id}/reject`, { note }, { token });
      setFlash("Request rejected.");
      setTimeout(() => setFlash(""), 2500);
      load();
    } catch (err: any) {
      setError(err?.message || "Rejection failed");
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
        <label htmlFor="gdpr-status" className="text-xs text-white/40">Status:</label>
        <select
          id="gdpr-status"
          data-testid="gdpr-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as GdprStatus)}
          className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white text-sm"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-2 rounded-xl btn-primary text-sm font-medium"
          data-testid="open-gdpr-create"
        >
          New request
        </button>
        <button
          onClick={load}
          className="px-3 py-2 rounded-xl surface-card text-sm text-white/60 hover:bg-white/10"
        >
          Refresh
        </button>
        {loading && <span className="text-xs text-white/30">Loading…</span>}
      </div>

      {rows.length === 0 ? (
        <div className="surface-card p-6 text-white/30 text-sm">
          {status === "pending"
            ? "No pending GDPR requests — SLA clock is clean."
            : `No ${status} requests.`}
        </div>
      ) : (
        <div className="space-y-3" data-testid="gdpr-list">
          {rows.map((r) => {
            const overdue = r.daysUntilDue < 0;
            const soon = r.daysUntilDue >= 0 && r.daysUntilDue <= 3;
            return (
              <div
                key={r.id}
                className="surface-card p-5"
                data-testid={`gdpr-row-${r.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-sm text-white">
                      {r.userName ?? "(deleted user)"}
                      <span className={`ml-2 text-[11px] px-2 py-0.5 rounded-full ${
                        r.type === "delete" ? "bg-red-500/10 text-red-400" : "bg-blue-500/10 text-blue-400"
                      }`}>
                        {r.type.toUpperCase()}
                      </span>
                    </p>
                    <p className="text-xs text-white/40 truncate">{r.userEmail ?? r.userId}</p>
                  </div>
                  <div className="text-right">
                    {status === "pending" ? (
                      <span className={`text-xs tabular-nums ${
                        overdue ? "text-red-400" : soon ? "text-amber-400" : "text-white/50"
                      }`}>
                        {overdue
                          ? `overdue by ${Math.abs(r.daysUntilDue)}d`
                          : `due in ${r.daysUntilDue}d`}
                      </span>
                    ) : (
                      <span className="text-xs text-white/40 tabular-nums">
                        {r.fulfilledAt
                          ? new Date(r.fulfilledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                          : "—"}
                      </span>
                    )}
                    <p className="text-[11px] text-white/30 mt-1">
                      Due {new Date(r.dueBy).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>

                {r.note && (
                  <p className="text-xs text-white/50 mt-3 italic">&ldquo;{r.note}&rdquo;</p>
                )}

                {status === "pending" && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => fulfill(r.id, r.userEmail)}
                      disabled={pendingId === r.id}
                      data-testid={`fulfill-${r.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40"
                    >
                      Fulfill
                    </button>
                    <button
                      onClick={() => reject(r.id)}
                      disabled={pendingId === r.id}
                      data-testid={`reject-${r.id}`}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] text-white/60 hover:bg-white/10 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateRequestModal
          token={token}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setFlash("GDPR request created.");
            setTimeout(() => setFlash(""), 2500);
            setStatus("pending");
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateRequestModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [type, setType] = useState<GdprType>("export");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setSaving(true);
    setErr("");
    try {
      await api.post("/admin/gdpr/requests", { userId: userId.trim(), type, note }, { token });
      onCreated();
    } catch (e: any) {
      setErr(e?.message || "Failed to create request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="surface-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">New GDPR request</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">&times;</button>
        </div>
        {err && (
          <div className="mb-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-white/40 mb-1">User ID (UUID)</label>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white text-sm font-mono"
              data-testid="gdpr-user-id"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as GdprType)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white text-sm"
              data-testid="gdpr-type"
            >
              <option value="export">Export</option>
              <option value="delete">Delete</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-xl surface-card text-sm text-white/60 hover:bg-white/10">Cancel</button>
          <button
            onClick={submit}
            disabled={saving || !userId}
            data-testid="gdpr-create-submit"
            className="px-4 py-2 rounded-xl btn-primary text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
