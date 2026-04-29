"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TabError, errorMessage } from "./helpers";

interface ReferralStats {
  totalActivated: number;
  totalRejected: number;
  totalPending: number;
  bonusDaysGranted: number;
  distinctReferrers: number;
  settings: {
    enabled: boolean;
    bonusDays: number;
    maxPerReferrer: number;
  };
}

const PRESET_BONUS_DAYS = [15, 30];

export function ReferralTab({ token }: { token: string }) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(true);
  const [bonusDays, setBonusDays] = useState(30);
  const [maxPerReferrer, setMaxPerReferrer] = useState(10);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get<ReferralStats>("/admin/referral/stats", { token });
      setStats(data);
      setEnabled(data.settings.enabled);
      setBonusDays(data.settings.bonusDays);
      setMaxPerReferrer(data.settings.maxPerReferrer);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      // Settings live in `site_settings` and are read at activation
      // time, so this PUT is the only thing required for the next
      // signup to pick up the new values — no redeploy.
      await api.put<Record<string, string>>(
        "/admin/settings",
        {
          "referral.enabled": enabled ? "true" : "false",
          "referral.bonus_days": String(bonusDays),
          "referral.max_per_referrer": String(maxPerReferrer),
        },
        { token },
      );
      setSaveMsg({ tone: "success", text: "Referral settings saved." });
      await load();
    } catch (err) {
      setSaveMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 4000);
    }
  }, [enabled, bonusDays, maxPerReferrer, load, token]);

  if (loading) {
    return <div className="surface-card p-6 text-center text-surface-50/40">Loading…</div>;
  }
  if (loadError) {
    return <TabError message={loadError} onRetry={load} />;
  }
  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Aggregate stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Activated" value={stats.totalActivated} accent="text-emerald-400" />
        <Stat label="Rejected" value={stats.totalRejected} accent="text-surface-50/50" />
        <Stat label="Pending" value={stats.totalPending} accent="text-amber-400" />
        <Stat
          label="Premium days granted"
          value={stats.bonusDaysGranted}
          accent="text-primary-400"
          hint="Activated × bonusDays × 2 (both sides)"
        />
        <Stat label="Distinct referrers" value={stats.distinctReferrers} accent="text-blue-400" />
      </div>

      {/* Settings panel */}
      <div className="surface-card p-6">
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-surface-50">Program settings</h2>
          <p className="text-xs text-surface-50/40 mt-1">
            Changes take effect on the next signup — no redeploy needed.
          </p>
        </header>

        {saveMsg && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs border ${
              saveMsg.tone === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            {saveMsg.text}
          </div>
        )}

        <div className="space-y-5">
          {/* Enabled toggle */}
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm text-surface-50/80">
              <span className="block font-medium">Referral program enabled</span>
              <span className="block text-xs text-surface-50/40 mt-0.5">
                When off, codes still resolve but no bonuses are granted (rows are recorded as
                REJECTED with reason <code>program_disabled</code>).
              </span>
            </span>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? "bg-emerald-500" : "bg-white/20"
              }`}
              aria-pressed={enabled}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>

          {/* Bonus days */}
          <div>
            <label className="block text-sm font-medium text-surface-50/80 mb-2">
              Bonus days for both sides
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_BONUS_DAYS.map((d) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => setBonusDays(d)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    bonusDays === d
                      ? "bg-primary-600 text-surface-50"
                      : "bg-white/[0.04] hover:bg-white/[0.08] text-surface-50/70"
                  }`}
                >
                  {d} days
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={365}
                value={bonusDays}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setBonusDays(Number.isFinite(n) ? Math.max(1, Math.min(365, n)) : bonusDays);
                }}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm"
              />
              <span className="text-xs text-surface-50/40">days (1–365)</span>
            </div>
          </div>

          {/* Cap */}
          <div>
            <label className="block text-sm font-medium text-surface-50/80 mb-2">
              Max successful referrals per user
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={maxPerReferrer}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setMaxPerReferrer(
                  Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : maxPerReferrer,
                );
              }}
              className="w-32 px-3 py-2 rounded-lg surface-input text-sm"
            />
            <p className="text-xs text-surface-50/40 mt-1">
              Prevents code-farming. Above this, further activations are recorded as REJECTED
              with reason <code>cap_reached</code>.
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-5 py-2.5 rounded-lg btn-primary text-surface-50 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save settings"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEnabled(stats.settings.enabled);
                setBonusDays(stats.settings.bonusDays);
                setMaxPerReferrer(stats.settings.maxPerReferrer);
              }}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-surface-50/70 text-sm"
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs uppercase tracking-wide text-surface-50/40 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent}`}>{value.toLocaleString()}</p>
      {hint && <p className="text-[10px] text-surface-50/30 mt-1">{hint}</p>}
    </div>
  );
}
