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
  /**
   * Credit currency switch. When false (subscription model) the app hides all
   * credit UI: credit packs, ₹-per-use price labels, and the profile balance.
   * Defaults to true (legacy-safe) so an un-configured backend keeps its UI.
   */
  creditsEnabled: boolean;
  /** Whether free users can buy ₹100 overage packs (else they see Subscribe). */
  overageForFreeEnabled: boolean;
  reportPrice: number;
  palmistryPrice: number;
  /** Subscription prices (subscription model). */
  monthlyPrice: number;
  annualPrice: number;
  /** Overage pack price/size (₹100 → +2 palmistry, ₹100 → +350 chat). */
  palmistryOveragePrice: number;
  palmistryOverageCount: number;
  chatOveragePrice: number;
  chatOverageCount: number;
  reportsDelivered: number | null;
  loading: boolean;
}

const DEFAULTS: Omit<PricingConfig, "raw" | "loading"> = {
  subscriptionsEnabled: false,
  pricingEnabled: false,
  freeMode: false,
  creditsEnabled: true,
  overageForFreeEnabled: false,
  reportPrice: 199,
  palmistryPrice: 250,
  monthlyPrice: 99,
  annualPrice: 2999,
  palmistryOveragePrice: 100,
  palmistryOverageCount: 2,
  chatOveragePrice: 100,
  chatOverageCount: 350,
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
    // Absent → true, mirroring the backend's legacy-safe default.
    creditsEnabled: raw["feature.credits_enabled"] !== "false",
    overageForFreeEnabled: raw["feature.overage_for_free_enabled"] === "true",
    reportPrice: num("pricing.report.price", DEFAULTS.reportPrice),
    palmistryPrice: num("pricing.palmistry.price", DEFAULTS.palmistryPrice),
    monthlyPrice: num("pricing.monthly.price", DEFAULTS.monthlyPrice),
    annualPrice: num("pricing.annual.price", DEFAULTS.annualPrice),
    palmistryOveragePrice: num("pricing.credits.overage_palmistry.price", DEFAULTS.palmistryOveragePrice),
    palmistryOverageCount: num("pricing.credits.overage_palmistry.credits", DEFAULTS.palmistryOverageCount),
    chatOveragePrice: num("pricing.credits.overage_chat.price", DEFAULTS.chatOveragePrice),
    chatOverageCount: num("pricing.credits.overage_chat.credits", DEFAULTS.chatOverageCount),
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
