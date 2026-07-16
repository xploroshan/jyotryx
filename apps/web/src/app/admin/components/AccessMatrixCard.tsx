"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

// ─── Types (mirror apps/api FeatureAccessService.getEffectiveAccess) ────────

type AccessCell =
  | { mode: "free" }
  | { mode: "one_time_unlock" }
  | { mode: "credits"; costCredits: number }
  | { mode: "metered"; limit: number; period: "month" | "lifetime" }
  | { mode: "not_applicable" };

interface AccessMatrix {
  flags: { freeMode: boolean; creditsEnabled: boolean; subscriptionsEnabled: boolean };
  features: Array<{
    feature: "chat" | "palmistry" | "report";
    freeUser: AccessCell;
    subscriber: AccessCell;
  }>;
}

const FEATURE_LABELS: Record<AccessMatrix["features"][number]["feature"], string> = {
  chat: "Chat with Astrologer",
  palmistry: "Palmistry",
  report: "Reports",
};

function cellLabel(cell: AccessCell): { text: string; tone: "free" | "paid" | "muted" } {
  switch (cell.mode) {
    case "free":
      return { text: "Free", tone: "free" };
    case "one_time_unlock":
      return { text: "One-time unlock", tone: "paid" };
    case "credits":
      return {
        text: `${cell.costCredits} credit${cell.costCredits === 1 ? "" : "s"} / message`,
        tone: "paid",
      };
    case "metered":
      return {
        text:
          cell.period === "month"
            ? `${cell.limit} / month`
            : `${cell.limit} total (lifetime)`,
        tone: "paid",
      };
    case "not_applicable":
      return { text: "n/a — subscriptions off", tone: "muted" };
  }
}

function FlagChip({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        on ? "bg-emerald-500/15 text-emerald-700" : "bg-black/[0.06] text-ink-500"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-emerald-500" : "bg-black/30"}`} />
      {label}: {on ? "ON" : "off"}
    </span>
  );
}

/**
 * Live "what does each feature cost right now?" readout, computed by the API
 * from the SAME primitives the real feature gates use (GET /admin/access-matrix).
 * This is the ground truth for the toggles above — if this table says "Free",
 * the gates let users through; a test suite pins every cell to the real gate
 * behavior. Re-fetched after every settings save (refreshKey).
 */
export function AccessMatrixCard({
  token,
  refreshKey,
  pricingPageEnabled,
}: {
  token: string;
  refreshKey: number;
  /** From the settings form — used only for the config-consistency warnings. */
  pricingPageEnabled: boolean;
}) {
  const [matrix, setMatrix] = useState<AccessMatrix | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get<AccessMatrix>("/admin/access-matrix", { token });
      setMatrix(res);
    } catch (err: any) {
      setError(err.message || "Failed to load effective access");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Toggle combinations that leave users at a dead end (a 402 whose CTA
  // cannot succeed). Surfaced here because the admin panel is where the
  // combination gets created.
  const warnings: string[] = [];
  if (matrix && !matrix.flags.freeMode) {
    if (matrix.flags.creditsEnabled && !pricingPageEnabled) {
      warnings.push(
        "Chat charges credits, but the pricing page is hidden — users who run out of credits have no way to buy more. Enable “Show pricing page” or turn on free mode.",
      );
    }
    if (!matrix.flags.creditsEnabled && !matrix.flags.subscriptionsEnabled) {
      warnings.push(
        "Metered mode is on but subscriptions are disabled — users who hit their free limits are told to subscribe, and subscribing will fail. Enable subscriptions or free mode.",
      );
    }
    if (pricingPageEnabled && !matrix.flags.subscriptionsEnabled) {
      warnings.push(
        "The pricing page is visible while subscriptions are disabled — its Subscribe buttons will fail. Enable subscriptions or hide the pricing page.",
      );
    }
  }

  return (
    <div className="surface-card p-6 mb-8 border border-primary-500/20">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h4 className="font-bold text-ink-900">Effective access right now</h4>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs text-primary-500 hover:text-primary-400 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="text-xs text-ink-500 mb-4">
        Computed live by the server from the saved settings — this is exactly what the
        feature gates enforce. Mode switches update it the moment you flip them; price
        and limit fields apply after their Save button.
      </p>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {matrix && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <FlagChip label="Free mode" on={matrix.flags.freeMode} />
            <FlagChip label="Credits" on={matrix.flags.creditsEnabled} />
            <FlagChip label="Subscriptions" on={matrix.flags.subscriptionsEnabled} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.10]">
                  <th className="text-left px-3 py-2 text-xs font-medium text-ink-500">Feature</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-ink-500">Free user</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-ink-500">Subscriber</th>
                </tr>
              </thead>
              <tbody>
                {matrix.features.map((row) => {
                  const freeCell = cellLabel(row.freeUser);
                  const subCell = cellLabel(row.subscriber);
                  const toneClass = (tone: "free" | "paid" | "muted") =>
                    tone === "free"
                      ? "text-emerald-700 font-medium"
                      : tone === "paid"
                        ? "text-ink-900"
                        : "text-ink-500";
                  return (
                    <tr key={row.feature} className="border-b border-black/5">
                      <td className="px-3 py-2.5 text-ink-700">{FEATURE_LABELS[row.feature]}</td>
                      <td className={`px-3 py-2.5 ${toneClass(freeCell.tone)}`}>{freeCell.text}</td>
                      <td className={`px-3 py-2.5 ${toneClass(subCell.tone)}`}>{subCell.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {warnings.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="text-xs font-bold text-amber-700 mb-2">
                ⚠ This combination strands paying users
              </p>
              <ul className="list-disc pl-4 space-y-1">
                {warnings.map((w) => (
                  <li key={w} className="text-xs text-amber-800">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
