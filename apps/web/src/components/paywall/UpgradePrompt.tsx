"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * In-product upgrade prompt, shown at a VALUE MOMENT (after the user has just
 * experienced value and hit a limit) — never as a cold wall before value.
 * The discipline is the `paywalls` skill's: ask to pay only once the product
 * has demonstrated worth, e.g. when chat credits run out mid-conversation.
 *
 * Copy is passed in by the caller so the component stays reusable and adds NO
 * new i18n keys of its own — callers wire already-translated strings. Every
 * interaction is measured (paywall_view / paywall_click / paywall_dismiss,
 * tagged with `trigger`) so we can see which value moment converts.
 */
export interface UpgradePromptProps {
  open: boolean;
  /** Analytics label for the value-moment that triggered this (e.g. "chat_credits"). */
  trigger: string;
  title: string;
  message: string;
  primaryCta: string;
  /** Where the primary CTA routes. Defaults to the pricing page. */
  primaryHref?: string;
  secondaryCta?: string;
  /** Where the secondary CTA routes. Falls back to primaryHref. */
  secondaryHref?: string;
  onClose: () => void;
}

export function UpgradePrompt({
  open,
  trigger,
  title,
  message,
  primaryCta,
  primaryHref = "/pricing",
  secondaryCta,
  secondaryHref,
  onClose,
}: UpgradePromptProps) {
  const router = useRouter();

  useEffect(() => {
    if (open) track("paywall_view", { trigger });
  }, [open, trigger]);

  if (!open) return null;

  const dismiss = () => {
    track("paywall_dismiss", { trigger });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="surface-card relative w-full max-w-sm p-6 text-center"
      >
        <h2 className="mb-2 text-lg font-semibold text-surface-950">{title}</h2>
        <p className="mb-5 text-sm text-[rgba(12,8,5,0.72)]">{message}</p>
        <button
          onClick={() => {
            track("paywall_click", { trigger, cta: "primary" });
            router.push(primaryHref);
          }}
          className="btn-primary mb-2 w-full rounded-lg py-2.5 text-sm font-medium text-white"
        >
          {primaryCta}
        </button>
        {secondaryCta ? (
          <button
            onClick={() => {
              track("paywall_click", { trigger, cta: "secondary" });
              router.push(secondaryHref ?? primaryHref);
            }}
            className="btn-secondary w-full rounded-lg py-2 text-sm font-medium"
          >
            {secondaryCta}
          </button>
        ) : null}
        <button
          onClick={dismiss}
          aria-label="Close"
          className="mt-3 text-xs text-[rgba(12,8,5,0.5)] transition-colors hover:text-[rgba(12,8,5,0.8)]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
