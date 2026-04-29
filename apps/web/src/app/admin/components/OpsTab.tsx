"use client";

import React, { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type {
  OpsLlmHealthResponse,
  QueueDepthRow,
  ServiceHealth,
  BroadcastAudience,
  CapacityForecast,
} from "./types";

type WindowHours = 1 | 24 | 168;

const WINDOW_OPTIONS: Array<{ value: WindowHours; label: string }> = [
  { value: 1,   label: "Last 1h" },
  { value: 24,  label: "Last 24h" },
  { value: 168, label: "Last 7d" },
];

export function OpsTab({ token }: { token: string }) {
  const [windowHours, setWindowHours] = useState<WindowHours>(1);
  const [health, setHealth] = useState<OpsLlmHealthResponse | null>(null);
  const [queues, setQueues] = useState<QueueDepthRow[]>([]);
  const [svc, setSvc] = useState<ServiceHealth | null>(null);
  const [capacity, setCapacity] = useState<CapacityForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<string>("");
  const [showBroadcast, setShowBroadcast] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [h, q, s, c] = await Promise.all([
        api.get<OpsLlmHealthResponse>(`/admin/ops/llm-health?window=${windowHours}`, { token }),
        api.get<QueueDepthRow[]>(`/admin/ops/queues`, { token }),
        api.get<ServiceHealth>(`/admin/ops/health`, { token }),
        api.get<CapacityForecast[]>(`/admin/forecast/capacity`, { token }).catch(() => []),
      ]);
      setHealth(h);
      setQueues(Array.isArray(q) ? q : []);
      setSvc(s);
      setCapacity(Array.isArray(c) ? c : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load ops data");
    } finally {
      setLoading(false);
    }
  }, [token, windowHours]);

  useEffect(() => { load(); }, [load]);

  const toggleProvider = async (provider: string, enable: boolean) => {
    try {
      const path = enable ? "enable" : "disable";
      await api.post(`/admin/llm/provider/${encodeURIComponent(provider)}/${path}`, {}, { token });
      setFlash(`${provider} ${enable ? "enabled" : "disabled"} — takes effect within 30s`);
      setTimeout(() => setFlash(""), 3000);
      load();
    } catch (err: any) {
      setError(err?.message || `Failed to ${enable ? "enable" : "disable"} ${provider}`);
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

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        <div className="flex items-center gap-2">
          <label htmlFor="ops-window" className="text-xs text-surface-900/40">Window:</label>
          <select
            id="ops-window"
            data-testid="ops-window"
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value) as WindowHours)}
            className="px-3 py-2 rounded-xl bg-surface-900/[0.03] border border-surface-900/[0.06] text-surface-900 text-sm"
          >
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowBroadcast(true)}
          className="px-3 py-2 rounded-xl btn-primary text-sm font-medium"
          data-testid="open-broadcast"
        >
          New broadcast
        </button>
        <button
          onClick={load}
          className="px-3 py-2 rounded-xl surface-card text-sm text-surface-900/60 hover:bg-surface-900/10"
        >
          Refresh
        </button>
        {loading && <span className="text-xs text-surface-900/30">Loading…</span>}
      </div>

      {/* Service health + queues */}
      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <ServiceHealthCard data={svc} />
        <QueueDepthCard rows={queues} />
      </div>

      {/* Error rate + kill-switch */}
      <ErrorRateCard
        rows={health?.errorRate ?? []}
        onToggle={toggleProvider}
      />

      {/* Latency percentiles */}
      <div className="grid lg:grid-cols-2 gap-4 mt-8">
        <LatencyCard title="Latency by feature" rows={health?.latencyByFeature ?? []} />
        <LatencyCard title="Latency by provider" rows={health?.latencyByProvider ?? []} />
      </div>

      {/* Cache hit rate */}
      <CacheHitCard rows={health?.cacheHitRate ?? []} />

      {/* Phase 4: capacity forecast — days until each provider hits
          its configured TPM ceiling at current peak-minute usage. */}
      <CapacityCard rows={capacity} />

      {showBroadcast && (
        <BroadcastModal
          token={token}
          onClose={() => setShowBroadcast(false)}
          onSent={(msg) => {
            setFlash(msg);
            setTimeout(() => setFlash(""), 4000);
          }}
        />
      )}
    </div>
  );
}

// ─── Service health ────────────────────────────────────────────────────────

function ServiceHealthCard({ data }: { data: ServiceHealth | null }) {
  return (
    <div className="surface-card p-6" data-testid="service-health-card">
      <h3 className="text-sm font-semibold text-surface-900 mb-4">Service health</h3>
      {!data ? (
        <p className="text-xs text-surface-900/30">Loading…</p>
      ) : (
        <div className="space-y-2">
          <HealthRow label="Database" status={data.database} />
          <HealthRow label="Redis"    status={data.redis} />
          {Object.keys(data.details).length > 0 && (
            <ul className="text-[11px] text-surface-900/40 mt-3 space-y-1">
              {Object.entries(data.details).map(([k, v]) => (
                <li key={k}><span className="text-surface-900/30">{k}:</span> {String(v)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function HealthRow({ label, status }: { label: string; status: "up" | "down" }) {
  const color = status === "up" ? "bg-emerald-400" : "bg-red-500";
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-surface-900/70">{label}</span>
      <span className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <span className={status === "up" ? "text-emerald-400 text-xs" : "text-red-400 text-xs"}>
          {status}
        </span>
      </span>
    </div>
  );
}

// ─── Queue depth ───────────────────────────────────────────────────────────

function QueueDepthCard({ rows }: { rows: QueueDepthRow[] }) {
  return (
    <div className="surface-card p-6" data-testid="queue-depth-card">
      <h3 className="text-sm font-semibold text-surface-900 mb-4">BullMQ queues</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-900/[0.06]">
              <th className="text-left py-2 pr-4 text-surface-900/40 font-medium">Queue</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">Waiting</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">Active</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">Delayed</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">Failed</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">Done</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.queue} className="border-b border-surface-900/[0.03]">
                <td className="py-2 pr-4 text-surface-900/70">{r.queue}</td>
                <td className="text-right px-2 text-surface-900/60 tabular-nums">{r.waiting}</td>
                <td className="text-right px-2 text-surface-900/60 tabular-nums">{r.active}</td>
                <td className="text-right px-2 text-surface-900/60 tabular-nums">{r.delayed}</td>
                <td className={`text-right px-2 tabular-nums ${r.failed > 0 ? "text-red-400" : "text-surface-900/60"}`}>{r.failed}</td>
                <td className="text-right px-2 text-surface-900/40 tabular-nums">{r.completed}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-4 text-surface-900/30">No queues reported</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── LLM error rate + kill-switch ──────────────────────────────────────────

function ErrorRateCard({
  rows,
  onToggle,
}: {
  rows: Array<{ provider: string; total: number; errors: number; errorRate: number; topErrors: Array<{ errorCode: string; count: number }> }>;
  onToggle: (provider: string, enable: boolean) => void;
}) {
  return (
    <div className="surface-card p-6" data-testid="error-rate-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-surface-900">LLM error rate</h3>
          <p className="text-xs text-surface-900/40 mt-0.5">
            Failed calls ÷ total calls per provider. Disable a provider here to remove it from the failover chain within 30s.
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {rows.map((r) => {
          const pct = Math.round(r.errorRate * 1000) / 10;
          const tone = pct >= 5 ? "text-red-400" : pct >= 1 ? "text-amber-400" : "text-emerald-400";
          return (
            <div
              key={r.provider}
              className="p-3 rounded-lg bg-surface-900/[0.03]"
              data-testid={`error-rate-row-${r.provider}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-900">{r.provider}</span>
                <span className={`text-xs font-bold tabular-nums ${tone}`}>{pct.toFixed(1)}%</span>
              </div>
              <p className="text-[11px] text-surface-900/40 mt-1 tabular-nums">
                {r.errors.toLocaleString()} / {r.total.toLocaleString()} calls failed
              </p>
              {r.topErrors.length > 0 && (
                <ul className="text-[11px] text-surface-900/40 mt-2 space-y-0.5">
                  {r.topErrors.map((t) => (
                    <li key={t.errorCode}>
                      <span className="text-surface-900/60">{t.errorCode}</span>: {t.count}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onToggle(r.provider, false)}
                  className="flex-1 text-[11px] px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  data-testid={`disable-${r.provider}`}
                >
                  Disable
                </button>
                <button
                  onClick={() => onToggle(r.provider, true)}
                  className="flex-1 text-[11px] px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  data-testid={`enable-${r.provider}`}
                >
                  Enable
                </button>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-xs text-surface-900/30 col-span-full text-center py-4">
            No LLM calls recorded in this window.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Latency buckets ───────────────────────────────────────────────────────

function LatencyCard({ title, rows }: { title: string; rows: Array<{ key: string; count: number; p50: number; p95: number; p99: number }> }) {
  return (
    <div className="surface-card p-6" data-testid={`latency-${title.replace(/\s/g, "-").toLowerCase()}`}>
      <h3 className="text-sm font-semibold text-surface-900 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-900/[0.06]">
              <th className="text-left py-2 pr-3 text-surface-900/40 font-medium">Key</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">Count</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">p50</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">p95</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">p99</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 10).map((r) => (
              <tr key={r.key} className="border-b border-surface-900/[0.03]">
                <td className="py-2 pr-3 text-surface-900/70 truncate max-w-[140px]">{r.key}</td>
                <td className="text-right px-2 text-surface-900/40 tabular-nums">{r.count.toLocaleString()}</td>
                <td className="text-right px-2 text-surface-900/60 tabular-nums">{r.p50}ms</td>
                <td className="text-right px-2 text-surface-900/60 tabular-nums">{r.p95}ms</td>
                <td className="text-right px-2 text-surface-900/60 tabular-nums">{r.p99}ms</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="text-center py-3 text-surface-900/30">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Cache hit rate ────────────────────────────────────────────────────────

function CacheHitCard({ rows }: { rows: Array<{ feature: string; total: number; hits: number; hitRate: number }> }) {
  return (
    <div className="surface-card p-6 mt-8" data-testid="cache-hit-card">
      <h3 className="text-sm font-semibold text-surface-900 mb-4">Cache hit rate by feature</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-900/[0.06]">
              <th className="text-left py-2 pr-3 text-surface-900/40 font-medium">Feature</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">Hits</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">Total</th>
              <th className="text-right px-2 py-2 text-surface-900/40 font-medium">Hit rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 15).map((r) => {
              const pct = (r.hitRate * 100).toFixed(1);
              return (
                <tr key={r.feature} className="border-b border-surface-900/[0.03]">
                  <td className="py-2 pr-3 text-surface-900/70 truncate max-w-[220px]">{r.feature}</td>
                  <td className="text-right px-2 text-surface-900/60 tabular-nums">{r.hits.toLocaleString()}</td>
                  <td className="text-right px-2 text-surface-900/40 tabular-nums">{r.total.toLocaleString()}</td>
                  <td className="text-right px-2 text-emerald-400 tabular-nums">{pct}%</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="text-center py-3 text-surface-900/30">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Phase 4: capacity forecast ────────────────────────────────────────────

function CapacityCard({ rows }: { rows: CapacityForecast[] }) {
  return (
    <div className="surface-card p-6 mt-8" data-testid="capacity-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-surface-900">Capacity forecast</h3>
          <p className="text-xs text-surface-900/40 mt-0.5">
            Days until peak-minute TPM crosses the configured provider ceiling. Set <code className="text-surface-900/60">pricing.llm.&#123;provider&#125;.tpm_limit</code> to enable.
          </p>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {rows.map((r) => {
          const danger = r.daysUntilHit !== null && r.daysUntilHit <= 7;
          const warn   = r.daysUntilHit !== null && r.daysUntilHit <= 30 && !danger;
          const tone = danger ? "text-red-400" : warn ? "text-amber-400" : "text-emerald-400";
          return (
            <div
              key={r.provider}
              className="p-3 rounded-lg bg-surface-900/[0.03]"
              data-testid={`capacity-row-${r.provider}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-surface-900">{r.provider}</span>
                {r.tpmLimit === null ? (
                  <span className="text-[11px] text-surface-900/30">no limit set</span>
                ) : (
                  <span className={`text-xs font-bold tabular-nums ${tone}`}>
                    {r.daysUntilHit === null ? "stable" : `${r.daysUntilHit}d`}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-surface-900/40 tabular-nums">
                Peak: {r.currentPeakTpm.toLocaleString()} TPM
                {r.tpmLimit !== null && ` / ${r.tpmLimit.toLocaleString()}`}
              </p>
              <p className="text-[11px] text-surface-900/30 tabular-nums mt-0.5">
                slope: {r.slopePerDay >= 0 ? "+" : ""}{r.slopePerDay.toLocaleString()} TPM/day
              </p>
            </div>
          );
        })}
        {rows.length === 0 && (
          <p className="text-xs text-surface-900/30 col-span-full text-center py-4">
            No capacity data — waiting on llm_usage rows for the last 7d.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Broadcast modal ───────────────────────────────────────────────────────

function BroadcastModal({
  token,
  onClose,
  onSent,
}: {
  token: string;
  onClose: () => void;
  onSent: (msg: string) => void;
}) {
  const [audienceType, setAudienceType] = useState<"all" | "premium" | "locale">("all");
  const [locale, setLocale] = useState("hi");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setSending(true);
    setErr("");
    try {
      const audience: BroadcastAudience =
        audienceType === "locale" ? { type: "locale", locale } : { type: audienceType };
      const res = await api.post<{ jobId: string; audienceSize: number }>(
        "/admin/broadcast",
        { audience, subject, body, channel: "inapp" },
        { token },
      );
      onSent(`Broadcast enqueued (job ${res.jobId}, ${res.audienceSize} users).`);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Failed to enqueue broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" data-testid="broadcast-modal">
      <div className="surface-card w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-900">New broadcast</h3>
          <button onClick={onClose} className="text-surface-900/40 hover:text-surface-900 text-xl">&times;</button>
        </div>
        {err && (
          <div className="mb-4 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{err}</div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-surface-900/40 mb-1">Audience</label>
            <select
              value={audienceType}
              onChange={(e) => setAudienceType(e.target.value as any)}
              data-testid="broadcast-audience"
              className="w-full px-3 py-2 rounded-lg bg-surface-900/[0.03] border border-surface-900/[0.06] text-surface-900 text-sm"
            >
              <option value="all">All users</option>
              <option value="premium">Premium + admin</option>
              <option value="locale">Locale</option>
            </select>
          </div>
          {audienceType === "locale" && (
            <div>
              <label className="block text-xs text-surface-900/40 mb-1">Locale code</label>
              <input
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                placeholder="hi"
                className="w-full px-3 py-2 rounded-lg bg-surface-900/[0.03] border border-surface-900/[0.06] text-surface-900 text-sm font-mono"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-surface-900/40 mb-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              data-testid="broadcast-subject"
              maxLength={200}
              className="w-full px-3 py-2 rounded-lg bg-surface-900/[0.03] border border-surface-900/[0.06] text-surface-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-surface-900/40 mb-1">Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              data-testid="broadcast-body"
              rows={4}
              maxLength={4000}
              className="w-full px-3 py-2 rounded-lg bg-surface-900/[0.03] border border-surface-900/[0.06] text-surface-900 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl surface-card text-sm text-surface-900/60 hover:bg-surface-900/10"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={sending || subject.length === 0 || body.length === 0}
            data-testid="broadcast-submit"
            className="px-4 py-2 rounded-xl btn-primary text-sm font-medium disabled:opacity-50"
          >
            {sending ? "Enqueuing…" : "Send"}
          </button>
        </div>
        <p className="text-[11px] text-surface-900/30 mt-3">
          Rate-limited to 1 broadcast per admin per hour. Current transport: in-app notification.
        </p>
      </div>
    </div>
  );
}
