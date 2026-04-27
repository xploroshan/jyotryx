"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TabError, errorMessage } from "./helpers";

interface BriefingStats {
  optedInUsers: number;
  sentLast7d: number;
  failedLast7d: number;
  todayStatus: { sent: number; failed: number; skipped: number };
  settings: {
    enabled: boolean;
    sendHourUtc: number;
    fromEmail: string;
    fromName: string;
  };
  provider: "resend" | "log";
}

interface PaywallStats {
  experiment: string;
  enabled: boolean;
  totalAssignments: number;
  totalConversions: number;
  variants: Array<{
    variant: string;
    weight: number;
    assignments: number;
    conversions: number;
    conversionRate: number;
  }>;
}

/**
 * Single admin tab that surfaces both Phase-1 monetization features —
 * Daily briefings (operational + send-test) and Paywall A/B
 * (per-variant funnel). They share a tab because both are new, both
 * are pre-traffic, and giving each its own tab would dilute the
 * existing tab strip with empty cards for weeks.
 */
export function MonetizationTab({ token }: { token: string }) {
  const [briefing, setBriefing] = useState<BriefingStats | null>(null);
  const [paywall, setPaywall] = useState<PaywallStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Briefing settings panel state
  const [enabled, setEnabled] = useState(true);
  const [sendHour, setSendHour] = useState(1);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [savingBriefing, setSavingBriefing] = useState(false);
  const [briefingMsg, setBriefingMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  // Paywall weights state
  const [paywallEnabled, setPaywallEnabled] = useState(true);
  const [controlWeight, setControlWeight] = useState(50);
  const [firstFreeWeight, setFirstFreeWeight] = useState(50);
  const [savingPaywall, setSavingPaywall] = useState(false);
  const [paywallMsg, setPaywallMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [b, p] = await Promise.all([
        api.get<BriefingStats>("/admin/briefing/stats", { token }),
        api.get<PaywallStats>("/admin/experiments/paywall/stats", { token }),
      ]);
      setBriefing(b);
      setEnabled(b.settings.enabled);
      setSendHour(b.settings.sendHourUtc);
      setFromEmail(b.settings.fromEmail);
      setFromName(b.settings.fromName);

      setPaywall(p);
      setPaywallEnabled(p.enabled);
      const c = p.variants.find((v) => v.variant === "control");
      const f = p.variants.find((v) => v.variant === "first_free");
      if (c) setControlWeight(c.weight);
      if (f) setFirstFreeWeight(f.weight);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveBriefingSettings = async () => {
    setSavingBriefing(true);
    setBriefingMsg(null);
    try {
      await api.put<Record<string, string>>(
        "/admin/settings",
        {
          "notification.briefing.enabled": enabled ? "true" : "false",
          "notification.briefing.send_hour_utc": String(sendHour),
          "notification.briefing.from_email": fromEmail,
          "notification.briefing.from_name": fromName,
        },
        { token },
      );
      setBriefingMsg({ tone: "success", text: "Briefing settings saved." });
      await load();
    } catch (err) {
      setBriefingMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setSavingBriefing(false);
      setTimeout(() => setBriefingMsg(null), 4000);
    }
  };

  const sendTest = async () => {
    setSendingTest(true);
    setBriefingMsg(null);
    try {
      await api.post("/admin/briefing/send-test", {}, { token });
      setBriefingMsg({ tone: "success", text: "Test email sent — check the admin inbox." });
    } catch (err) {
      setBriefingMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setSendingTest(false);
      setTimeout(() => setBriefingMsg(null), 4000);
    }
  };

  const savePaywallSettings = async () => {
    setSavingPaywall(true);
    setPaywallMsg(null);
    try {
      await api.put<Record<string, string>>(
        "/admin/settings",
        {
          "paywall.experiment_enabled": paywallEnabled ? "true" : "false",
          "paywall.variant.control.weight": String(controlWeight),
          "paywall.variant.first_free.weight": String(firstFreeWeight),
        },
        { token },
      );
      setPaywallMsg({ tone: "success", text: "Paywall A/B settings saved." });
      await load();
    } catch (err) {
      setPaywallMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setSavingPaywall(false);
      setTimeout(() => setPaywallMsg(null), 4000);
    }
  };

  if (loading) {
    return <div className="surface-card p-6 text-center text-white/40">Loading…</div>;
  }
  if (loadError) {
    return <TabError message={loadError} onRetry={load} />;
  }
  if (!briefing || !paywall) return null;

  return (
    <div className="space-y-8">
      {/* ─── Briefings ──────────────────────────────────────────────── */}
      <section>
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-white">Daily briefing emails</h2>
          <p className="text-xs text-white/40 mt-1">
            Provider: <span className="text-white/70">{briefing.provider}</span>
            {briefing.provider === "log" && (
              <>
                {" "}— <span className="text-amber-300">no real provider configured</span>; emails are
                logged but not sent. Set <code>RESEND_API_KEY</code> to enable real delivery.
              </>
            )}
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <Stat label="Opted-in users"   value={briefing.optedInUsers}      accent="text-primary-400" />
          <Stat label="Sent last 7d"     value={briefing.sentLast7d}        accent="text-emerald-400" />
          <Stat label="Failed last 7d"   value={briefing.failedLast7d}      accent="text-red-400" />
          <Stat label="Sent today"       value={briefing.todayStatus.sent}  accent="text-emerald-400" />
          <Stat label="Failed today"     value={briefing.todayStatus.failed} accent="text-red-400" />
        </div>

        <div className="surface-card p-6">
          {briefingMsg && (
            <div
              className={`mb-4 p-3 rounded-lg text-xs border ${
                briefingMsg.tone === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}
            >
              {briefingMsg.text}
            </div>
          )}

          <div className="space-y-5">
            <Toggle label="Daily briefing emails enabled" value={enabled} onChange={setEnabled} />

            <Field label="Send hour (UTC, 0–23)">
              <input
                type="number"
                min={0}
                max={23}
                value={sendHour}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setSendHour(Number.isFinite(n) ? Math.max(0, Math.min(23, n)) : sendHour);
                }}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm"
              />
              <span className="text-xs text-white/40 ml-2">
                01:00 UTC ≈ 06:30 IST. Pick the hour your audience opens email.
              </span>
            </Field>

            <Field label="From email">
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full max-w-md px-3 py-2 rounded-lg surface-input text-sm"
              />
            </Field>

            <Field label="From name">
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="w-full max-w-md px-3 py-2 rounded-lg surface-input text-sm"
              />
            </Field>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={saveBriefingSettings}
                disabled={savingBriefing}
                className="px-5 py-2.5 rounded-lg btn-primary text-white text-sm font-medium disabled:opacity-50"
              >
                {savingBriefing ? "Saving…" : "Save briefing settings"}
              </button>
              <button
                onClick={sendTest}
                disabled={sendingTest}
                className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-sm disabled:opacity-50"
              >
                {sendingTest ? "Sending…" : "Send test to me"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Paywall A/B ─────────────────────────────────────────────── */}
      <section>
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-white">Paywall A/B — first kundli</h2>
          <p className="text-xs text-white/40 mt-1">
            <code>control</code>: first kundli costs credits as usual. <code>first_free</code>: a
            "your first kundli is on us" banner. Both groups hit the same backend; only the copy
            changes — server-side credit grant for "first_free" can land later.
          </p>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <Stat label="Total assignments" value={paywall.totalAssignments} accent="text-primary-400" />
          <Stat label="Total conversions" value={paywall.totalConversions} accent="text-emerald-400" />
          <Stat
            label="Overall CVR"
            value={
              paywall.totalAssignments === 0
                ? 0
                : Math.round((paywall.totalConversions / paywall.totalAssignments) * 10_000) / 100
            }
            accent="text-purple-400"
            suffix="%"
          />
        </div>

        <div className="surface-card overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <Th>Variant</Th>
                <Th>Weight</Th>
                <Th>Assignments</Th>
                <Th>Conversions</Th>
                <Th>CVR</Th>
              </tr>
            </thead>
            <tbody>
              {paywall.variants.map((v) => (
                <tr key={v.variant} className="border-b border-white/5">
                  <Td>
                    <code>{v.variant}</code>
                  </Td>
                  <Td>{v.weight}</Td>
                  <Td>{v.assignments.toLocaleString()}</Td>
                  <Td>{v.conversions.toLocaleString()}</Td>
                  <Td>
                    <span className="text-emerald-300">{v.conversionRate.toFixed(2)}%</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="surface-card p-6">
          {paywallMsg && (
            <div
              className={`mb-4 p-3 rounded-lg text-xs border ${
                paywallMsg.tone === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}
            >
              {paywallMsg.text}
            </div>
          )}

          <div className="space-y-5">
            <Toggle
              label="Paywall A/B test enabled"
              value={paywallEnabled}
              onChange={setPaywallEnabled}
            />

            <Field label="Control weight (0–100)">
              <input
                type="number"
                min={0}
                max={100}
                value={controlWeight}
                onChange={(e) => setControlWeight(clamp(parseInt(e.target.value, 10), 0, 100, controlWeight))}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm"
              />
            </Field>

            <Field label="First-free weight (0–100)">
              <input
                type="number"
                min={0}
                max={100}
                value={firstFreeWeight}
                onChange={(e) => setFirstFreeWeight(clamp(parseInt(e.target.value, 10), 0, 100, firstFreeWeight))}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm"
              />
              <span className="text-xs text-white/40 ml-2">
                Weights are relative — 50/50 is even, 0/100 ramps everyone to a single arm.
              </span>
            </Field>

            <div className="pt-2">
              <button
                onClick={savePaywallSettings}
                disabled={savingPaywall}
                className="px-5 py-2.5 rounded-lg btn-primary text-white text-sm font-medium disabled:opacity-50"
              >
                {savingPaywall ? "Saving…" : "Save A/B settings"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  suffix,
}: {
  label: string;
  value: number;
  accent: string;
  suffix?: string;
}) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs uppercase tracking-wide text-white/40 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent}`}>
        {value.toLocaleString()}
        {suffix ?? ""}
      </p>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-sm text-white/80">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-emerald-500" : "bg-white/20"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-2">{label}</label>
      <div className="flex items-center flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-xs font-medium text-white/40">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-white/80">{children}</td>;
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
