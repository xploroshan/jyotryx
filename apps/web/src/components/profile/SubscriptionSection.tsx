"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface MySubscription {
  id: string;
  plan: string;
  status: string;
  startDate: string;
  endDate: string | null;
  provider: string | null;
  active: boolean;
  cancellable: boolean;
}

const PLAN_LABEL: Record<string, string> = {
  MONTHLY: "Premium — Monthly",
  ANNUAL: "Premium — Annual",
  FREE: "Free",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

/**
 * "Your subscription" card for the profile. Shows the current plan and, when an
 * active subscription exists, a Cancel button. Cancel is immediate: it stops the
 * Cashfree mandate and ends Premium access right away. Self-contained (mirrors
 * BriefingPreferenceSection); `onCancelled` lets the parent refresh the role badge.
 */
export default function SubscriptionSection({
  token,
  onCancelled,
}: {
  token: string;
  onCancelled?: () => void;
}) {
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<MySubscription | null>("/payments/subscription", { token });
      setSub(res ?? null);
    } catch {
      setSub(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async () => {
    if (
      !window.confirm(
        "Cancel your subscription? Your Premium access ends immediately and you won't be charged again. This can't be undone — you'd need to subscribe again.",
      )
    ) {
      return;
    }
    setCancelling(true);
    setError(null);
    setDone(false);
    try {
      await api.post("/payments/subscription/cancel", {}, { token });
      setDone(true);
      await load();
      onCancelled?.();
      setTimeout(() => setDone(false), 4000);
    } catch (err: any) {
      setError(err?.message || "Couldn't cancel your subscription. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <section className="surface-card p-6">
      <h3 className="text-lg font-bold text-surface-950 mb-2">Your subscription</h3>

      {loading ? (
        <p className="text-sm text-secondary">Loading…</p>
      ) : !sub || !sub.active ? (
        <>
          <p className="text-sm text-secondary mb-4 max-w-xl leading-relaxed">
            You&rsquo;re on the <span className="font-medium text-surface-950">Free</span> plan.
            {sub && sub.status === "CANCELLED" ? " Your previous subscription was cancelled." : ""}{" "}
            Upgrade for unlimited interpretations, your monthly report, more palmistry and chat.
          </p>
          <Link href="/pricing" className="inline-block px-5 py-2.5 rounded-lg btn-primary text-white text-sm font-medium">
            View plans
          </Link>
        </>
      ) : (
        <>
          <div className="rounded-xl bg-surface-900 border border-[rgba(12,8,5,0.08)] p-4 max-w-xl mb-4 space-y-1">
            <p className="text-sm">
              <span className="text-secondary">Plan:</span>{" "}
              <span className="font-medium text-surface-950">{PLAN_LABEL[sub.plan] ?? sub.plan}</span>
            </p>
            <p className="text-sm">
              <span className="text-secondary">Status:</span>{" "}
              <span className="font-medium text-emerald-600">Active</span>
            </p>
            <p className="text-sm">
              <span className="text-secondary">Started:</span>{" "}
              <span className="text-surface-950">{fmtDate(sub.startDate)}</span>
            </p>
            {sub.endDate && (
              <p className="text-sm">
                <span className="text-secondary">Renews/ends:</span>{" "}
                <span className="text-surface-950">{fmtDate(sub.endDate)}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="focus-ring px-5 py-2.5 rounded-lg border border-red-500/40 text-sm font-medium text-red-600 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel subscription"}
          </button>
          <p className="text-xs text-secondary mt-2 max-w-xl">
            Cancelling stops future charges and ends Premium access immediately.
          </p>
        </>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {done && !error && (
        <p className="mt-3 text-xs text-emerald-600" role="status">
          Your subscription has been cancelled.
        </p>
      )}
    </section>
  );
}
