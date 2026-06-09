"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Public monetization config, read from the unauthenticated
 * `GET /payments/pricing` endpoint (backed by SiteSettings). Drives the
 * two operating modes:
 *   - subscriptionsEnabled === false → Mode A "Free launch": the app is
 *     free except the three pay-per-use features.
 *   - pricingEnabled === false → hide the /pricing page + nav/footer links
 *     and show the "Free" hero badge.
 *
 * Also surfaces the admin-editable one-time prices and the social-proof
 * "reports delivered" counter so feature pages can render them without a
 * second round trip.
 */
export interface PricingConfig {
  raw: Record<string, string>;
  subscriptionsEnabled: boolean;
  pricingEnabled: boolean;
  /** Master switch: when true the three paid features are free for everyone. */
  freeMode: boolean;
  reportPrice: number;
  palmistryPrice: number;
  reportsDelivered: number | null;
  loading: boolean;
}

const DEFAULTS: Omit<PricingConfig, "raw" | "loading"> = {
  subscriptionsEnabled: false,
  pricingEnabled: false,
  freeMode: false,
  reportPrice: 199,
  palmistryPrice: 250,
  reportsDelivered: null,
};

function parseConfig(raw: Record<string, string>): Omit<PricingConfig, "raw" | "loading"> {
  const num = (key: string, fallback: number) => {
    const v = parseInt(raw[key] ?? "", 10);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  const delivered = parseInt(raw["social.reports_delivered"] ?? "", 10);
  return {
    subscriptionsEnabled: raw["feature.subscriptions_enabled"] === "true",
    pricingEnabled: raw["feature.pricing_page_enabled"] === "true",
    freeMode: raw["feature.free_mode"] === "true",
    reportPrice: num("pricing.report.price", DEFAULTS.reportPrice),
    palmistryPrice: num("pricing.palmistry.price", DEFAULTS.palmistryPrice),
    reportsDelivered: Number.isFinite(delivered) ? delivered : null,
  };
}

export function usePricingConfig(): PricingConfig {
  const [state, setState] = useState<PricingConfig>({
    raw: {},
    loading: true,
    ...DEFAULTS,
  });

  useEffect(() => {
    let cancelled = false;
    api
      .get<Record<string, string>>("/payments/pricing")
      .then((raw) => {
        if (cancelled) return;
        setState({ raw, loading: false, ...parseConfig(raw) });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
