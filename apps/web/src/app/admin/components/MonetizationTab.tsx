"use client";

import React, { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TabError, errorMessage } from "./helpers";

interface BriefingStats {
  optedInUsers: number;
  sentLast7d: number;
  failedLast7d: number;
  todayStatus: { sent: number; failed: number; skipped: number };
  lastError: string | null;
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
  const [enrollingAll, setEnrollingAll] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

  // Paywall weights state
  const [paywallEnabled, setPaywallEnabled] = useState(true);
  const [controlWeight, setControlWeight] = useState(50);
  const [firstFreeWeight, setFirstFreeWeight] = useState(50);
  const [savingPaywall, setSavingPaywall] = useState(false);
  const [paywallMsg, setPaywallMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Credits & limits (subscription model). Read from the public pricing config
  // (which already surfaces feature.credits_enabled + limits.* + overage packs)
  // and written back through the generic /admin/settings endpoint.
  const [creditsOn, setCreditsOn] = useState(true);
  const [chatFree, setChatFree] = useState(50);
  const [chatSub, setChatSub] = useState(1000);
  const [palmFree, setPalmFree] = useState(2);
  const [palmSub, setPalmSub] = useState(4);
  const [chatOveragePrice, setChatOveragePrice] = useState(100);
  const [chatOverageCount, setChatOverageCount] = useState(350);
  const [palmOveragePrice, setPalmOveragePrice] = useState(100);
  const [palmOverageCount, setPalmOverageCount] = useState(2);
  const [savingCredits, setSavingCredits] = useState(false);
  const [creditsMsg, setCreditsMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [b, p, cfg] = await Promise.all([
        api.get<BriefingStats>("/admin/briefing/stats", { token }),
        api.get<PaywallStats>("/admin/experiments/paywall/stats", { token }),
        api.get<Record<string, string>>("/payments/pricing", { token }),
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

      const numv = (k: string, d: number) => {
        const n = parseInt(cfg[k] ?? "", 10);
        return Number.isFinite(n) && n >= 0 ? n : d;
      };
      setCreditsOn(cfg["feature.credits_enabled"] !== "false");
      setChatFree(numv("limits.chat.free", 50));
      setChatSub(numv("limits.chat.subscriber", 1000));
      setPalmFree(numv("limits.palmistry.free", 2));
      setPalmSub(numv("limits.palmistry.subscriber", 4));
      setChatOveragePrice(numv("pricing.credits.overage_chat.price", 100));
      setChatOverageCount(numv("pricing.credits.overage_chat.credits", 350));
      setPalmOveragePrice(numv("pricing.credits.overage_palmistry.price", 100));
      setPalmOverageCount(numv("pricing.credits.overage_palmistry.credits", 2));
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

  const runNow = async () => {
    // Trigger today's fan-out immediately. Idempotent — anyone who already got
    // today's mail is skipped — so this is safe to click after a fix/redeploy.
    setRunningNow(true);
    setBriefingMsg(null);
    try {
      const res = await api.post<{ selected: number; sent: number; failed: number; skipped: number }>(
        "/admin/briefing/run-now",
        {},
        { token },
      );
      setBriefingMsg({
        tone: res.failed > 0 ? "error" : "success",
        text: `Daily send ran: ${res.sent} sent, ${res.skipped} skipped, ${res.failed} failed (of ${res.selected}).`,
      });
      await load();
    } catch (err) {
      setBriefingMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setRunningNow(false);
      setTimeout(() => setBriefingMsg(null), 6000);
    }
  };

  const enableForAll = async () => {
    // Confirm before flipping every opted-out user, since this overrides
    // explicit opt-outs and emails are user-visible — we never want a
    // misclick to re-subscribe the entire base.
    const ok = window.confirm(
      "Enable the daily briefing for every user who is currently opted out?\n\n" +
        "This will overwrite explicit opt-outs and they will start receiving the morning email " +
        "until they turn it off again from their profile.",
    );
    if (!ok) return;
    setEnrollingAll(true);
    setBriefingMsg(null);
    try {
      const res = await api.post<{ updated: number }>(
        "/admin/briefing/enable-for-all",
        {},
        { token },
      );
      setBriefingMsg({
        tone: "success",
        text: `Enabled briefing for ${res.updated} previously-disabled user${res.updated === 1 ? "" : "s"}.`,
      });
      await load();
    } catch (err) {
      setBriefingMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setEnrollingAll(false);
      setTimeout(() => setBriefingMsg(null), 6000);
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

  const saveCreditsSettings = async () => {
    setSavingCredits(true);
    setCreditsMsg(null);
    try {
      await api.put<Record<string, string>>(
        "/admin/settings",
        {
          "feature.credits_enabled": creditsOn ? "true" : "false",
          "limits.chat.free": String(chatFree),
          "limits.chat.subscriber": String(chatSub),
          "limits.palmistry.free": String(palmFree),
          "limits.palmistry.subscriber": String(palmSub),
          "pricing.credits.overage_chat.price": String(chatOveragePrice),
          "pricing.credits.overage_chat.credits": String(chatOverageCount),
          "pricing.credits.overage_palmistry.price": String(palmOveragePrice),
          "pricing.credits.overage_palmistry.credits": String(palmOverageCount),
        },
        { token },
      );
      setCreditsMsg({ tone: "success", text: "Credits & limits saved." });
      await load();
    } catch (err) {
      setCreditsMsg({ tone: "error", text: errorMessage(err) });
    } finally {
      setSavingCredits(false);
      setTimeout(() => setCreditsMsg(null), 4000);
    }
  };

  if (loading) {
    return <div className="surface-card p-6 text-center text-ink-500">Loading…</div>;
  }
  if (loadError) {
    return <TabError message={loadError} onRetry={load} />;
  }
  if (!briefing || !paywall) return null;

  return (
    <div className="space-y-8">
      {/* ─── Credits & limits (subscription model) ──────────────────── */}
      <section>
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-ink-900">Credits &amp; limits</h2>
          <p className="text-xs text-ink-500 mt-1">
            Turn the credit currency off to run the subscription model: deterministic
            features become free, interpretation is subscriber-gated, and chat/palmistry
            are governed by the per-feature allowances below. Going live also needs{" "}
            <code>Subscriptions enabled</code>.
          </p>
        </header>
        <div className="surface-card p-6 space-y-5">
          {creditsMsg && (
            <div
              className={`p-3 rounded-lg text-xs border ${
                creditsMsg.tone === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}
            >
              {creditsMsg.text}
            </div>
          )}
          <Toggle
            label="Credits system enabled (off = subscription model)"
            value={creditsOn}
            onChange={setCreditsOn}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Chat — free (lifetime)">
              <input type="number" min="0" value={chatFree}
                onChange={(e) => setChatFree(clamp(parseInt(e.target.value, 10), 0, 1000000, 50))}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm" />
            </Field>
            <Field label="Chat — subscriber (per month)">
              <input type="number" min="0" value={chatSub}
                onChange={(e) => setChatSub(clamp(parseInt(e.target.value, 10), 0, 1000000, 1000))}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm" />
            </Field>
            <Field label="Palmistry — free (lifetime)">
              <input type="number" min="0" value={palmFree}
                onChange={(e) => setPalmFree(clamp(parseInt(e.target.value, 10), 0, 100000, 2))}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm" />
            </Field>
            <Field label="Palmistry — subscriber (per month)">
              <input type="number" min="0" value={palmSub}
                onChange={(e) => setPalmSub(clamp(parseInt(e.target.value, 10), 0, 100000, 4))}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm" />
            </Field>
            <Field label="Chat top-up — ₹ price / messages">
              <input type="number" min="0" value={chatOveragePrice}
                onChange={(e) => setChatOveragePrice(clamp(parseInt(e.target.value, 10), 0, 100000, 100))}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm" />
              <input type="number" min="0" value={chatOverageCount}
                onChange={(e) => setChatOverageCount(clamp(parseInt(e.target.value, 10), 0, 1000000, 350))}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm" />
            </Field>
            <Field label="Palmistry top-up — ₹ price / readings">
              <input type="number" min="0" value={palmOveragePrice}
                onChange={(e) => setPalmOveragePrice(clamp(parseInt(e.target.value, 10), 0, 100000, 100))}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm" />
              <input type="number" min="0" value={palmOverageCount}
                onChange={(e) => setPalmOverageCount(clamp(parseInt(e.target.value, 10), 0, 100000, 2))}
                className="w-24 px-3 py-2 rounded-lg surface-input text-sm" />
            </Field>
          </div>
          <button onClick={saveCreditsSettings} disabled={savingCredits}
            className="px-5 py-2.5 rounded-lg btn-primary text-white text-sm font-medium disabled:opacity-50">
            {savingCredits ? "Saving…" : "Save credits & limits"}
          </button>
        </div>
      </section>

      {/* ─── Briefings ──────────────────────────────────────────────── */}
      <section>
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-ink-900">Daily briefing emails</h2>
          <p className="text-xs text-ink-500 mt-1">
            Provider: <span className="text-ink-700">{briefing.provider}</span>
            {briefing.provider === "log" && (
              <>
                {" "}— <span className="text-amber-300">no real provider configured</span>; emails are
                logged but not sent. Set <code>RESEND_API_KEY</code> to enable real delivery.
              </>
            )}
          </p>
          {briefing.todayStatus.failed > 0 && briefing.lastError && (
            <p className="text-xs mt-1 text-red-500">
              Today&apos;s failures: <code className="text-red-600">{briefing.lastError}</code>
              {/^resend_4\d\d$/.test(briefing.lastError) && (
                <> — Resend rejected the send. Most often the <b>From email</b>&apos;s domain isn&apos;t
                verified in your Resend account. Verify it in Resend, or set the From email to a
                domain you have verified, then Save and re-run.</>
              )}
            </p>
          )}
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
              <span className="text-xs text-ink-500 ml-2">
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
                className="px-4 py-2 rounded-lg bg-black/[0.05] hover:bg-black/[0.08] text-ink-700 text-sm disabled:opacity-50"
              >
                {sendingTest ? "Sending…" : "Send test to me"}
              </button>
              <button
                onClick={runNow}
                disabled={runningNow}
                className="px-4 py-2 rounded-lg bg-emerald-100/70 hover:bg-emerald-100 border border-emerald-500/30 text-emerald-700 text-sm font-medium disabled:opacity-50"
                title="Run today's daily-briefing fan-out immediately. Idempotent — users who already received today's email are skipped."
              >
                {runningNow ? "Sending today's mail…" : "Send today's mail now"}
              </button>
              <button
                onClick={enableForAll}
                disabled={enrollingAll}
                className="px-4 py-2 rounded-lg bg-primary-100/70 hover:bg-primary-100 border border-primary-500/30 text-primary-300 text-sm font-medium disabled:opacity-50"
                title="Flip briefingEmailEnabled to true for every user currently opted out. Existing opt-outs will be overridden."
              >
                {enrollingAll ? "Enrolling…" : "Enable for all opted-out users"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Paywall A/B ─────────────────────────────────────────────── */}
      <section>
        <header className="mb-3">
          <h2 className="text-lg font-semibold text-ink-900">Paywall A/B — first kundli</h2>
          <p className="text-xs text-ink-500 mt-1">
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
              <tr className="border-b border-black/[0.10]">
                <Th>Variant</Th>
                <Th>Weight</Th>
                <Th>Assignments</Th>
                <Th>Conversions</Th>
                <Th>CVR</Th>
              </tr>
            </thead>
            <tbody>
              {paywall.variants.map((v) => (
                <tr key={v.variant} className="border-b border-black/5">
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
              <span className="text-xs text-ink-500 ml-2">
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
      <p className="text-xs uppercase tracking-wide text-ink-500 mb-1">{label}</p>
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
      <span className="text-sm text-ink-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        aria-pressed={value}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? "bg-emerald-500" : "bg-black/15"
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
      <label className="block text-sm font-medium text-ink-700 mb-2">{label}</label>
      <div className="flex items-center flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-3 text-xs font-medium text-ink-500">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-ink-700">{children}</td>;
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}
