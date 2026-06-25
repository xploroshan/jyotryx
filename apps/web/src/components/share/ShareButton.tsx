"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * Reusable share control for any reading/page. Drives the referral loop: the
 * cheapest distribution we have is a happy user forwarding a result on
 * WhatsApp. Prefers the native share sheet (mobile) and falls back to a
 * WhatsApp deep link + copy-to-clipboard, so it works everywhere.
 *
 * Prop-driven copy so it adds NO new i18n keys — callers pass already-localized
 * labels (e.g. the existing `matchShare.*` strings). Every share fires
 * `share_clicked` tagged with `trigger` + `method`, so referral becomes a
 * measurable channel (see the analytics layer).
 */
export interface ShareButtonProps {
  /** Absolute or root-relative URL to share. Root-relative is resolved to the current origin. */
  url: string;
  /** Message text used for native share / WhatsApp. */
  text: string;
  /** Analytics label for what's being shared (e.g. "horoscope", "daily_briefing"). */
  trigger: string;
  shareLabel: string;
  copyLabel: string;
  copiedLabel: string;
  className?: string;
}

function toAbsolute(u: string): string {
  if (/^https?:\/\//.test(u)) return u;
  if (typeof window !== "undefined") {
    return window.location.origin + (u.startsWith("/") ? u : `/${u}`);
  }
  return u;
}

export function ShareButton({
  url,
  text,
  trigger,
  shareLabel,
  copyLabel,
  copiedLabel,
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareNativeOrWhatsapp = async () => {
    const absUrl = toAbsolute(url);
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ text, url: absUrl });
        track("share_clicked", { trigger, method: "native" });
        return;
      } catch {
        // User cancelled, or share unsupported for these fields — fall through.
      }
    }
    track("share_clicked", { trigger, method: "whatsapp" });
    if (typeof window !== "undefined") {
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${text} ${absUrl}`)}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(toAbsolute(url));
      track("share_clicked", { trigger, method: "copy" });
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permission) — no-op.
    }
  };

  return (
    <div className={className ?? "flex items-center gap-2"}>
      <button
        type="button"
        onClick={shareNativeOrWhatsapp}
        className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium"
      >
        {shareLabel}
      </button>
      <button
        type="button"
        onClick={copyLink}
        className="btn-secondary rounded-lg px-3 py-1.5 text-xs font-medium"
      >
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}
