"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuthStore, useAuthHydrated } from "@/lib/store";
import { Toast } from "@/components/ui/Toast";

interface ReferralStatus {
  enabled: boolean;
  bonusDays: number;
  code: string;
  shareUrl: string;
  totalReferrals: number;
  activatedReferrals: number;
  pendingReferrals: number;
  rejectedReferrals: number;
  maxPerReferrer: number;
  remainingSlots: number;
  recent: Array<{
    refereeName: string;
    refereeEmail: string;
    bonusDays: number;
    status: string;
    activatedAt: string | null;
    createdAt: string;
  }>;
}

export default function ReferralPage() {
  const router = useRouter();
  const isHydrated = useAuthHydrated();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"code" | "url" | null>(null);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      router.push("/auth?mode=login&next=/referral");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, isAuthenticated]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<ReferralStatus>("/referral/me", {
        token: accessToken!,
      });
      setStatus(data);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : (err as Error)?.message || "Failed to load referrals";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const copy = async (value: string, kind: "code" | "url") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Best-effort; some browsers block clipboard without HTTPS
    }
  };

  const sharePayload = (s: ReferralStatus) =>
    `Join me on MyAstro360! Sign up with my code ${s.code} and we both get ${s.bonusDays} days of Premium for free. ${s.shareUrl}`;

  const shareNative = async (s: ReferralStatus) => {
    const text = sharePayload(s);
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: "MyAstro360 — multi-tradition astrology",
          text,
          url: s.shareUrl,
        });
        return;
      } catch {
        // Fall through to clipboard if share was cancelled.
      }
    }
    await copy(text, "url");
  };

  if (!isHydrated || loading) {
    return (
      <div className="relative min-h-screen">
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-12">
          <div className="surface-card p-8 text-center text-[rgba(12,8,5,0.66)]">Loading…</div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="relative min-h-screen">
        <div className="relative z-10 mx-auto max-w-4xl px-4 py-12">
          {error && <Toast message={error} tone="error" onClose={() => setError("")} />}
        </div>
      </div>
    );
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(sharePayload(status))}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(
    "Try MyAstro360 — get free Premium",
  )}&body=${encodeURIComponent(sharePayload(status))}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    sharePayload(status),
  )}`;

  return (
    <div className="relative min-h-screen">
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-12 fade-in-up">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gradient">Invite friends, get free Premium</h1>
          <p className="text-secondary mt-2 text-sm max-w-2xl">
            When a friend signs up with your code, you both get{" "}
            <span className="text-primary-300 font-semibold">{status.bonusDays} days</span> of
            Premium — full access to every chart, report and AI consultation.
            {status.maxPerReferrer > 0 && (
              <>
                {" "}
                You can claim this bonus up to{" "}
                <span className="text-emphasis">{status.maxPerReferrer}</span> times — you have{" "}
                <span className="text-primary-300 font-semibold">
                  {status.remainingSlots}
                </span>{" "}
                left.
              </>
            )}
          </p>
        </header>

        {error && (
          <div className="mb-6">
            <Toast message={error} tone="error" onClose={() => setError("")} />
          </div>
        )}

        {!status.enabled && (
          <div className="mb-6">
            <Toast
              message="The referral program is currently paused. Your code below will start working again as soon as it's re-enabled."
              tone="info"
              onClose={() => undefined}
            />
          </div>
        )}

        {/* Code + share card */}
        <section className="surface-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[rgba(12,8,5,0.66)] mb-1">Your code</p>
              <p className="text-3xl font-mono tracking-widest text-surface-950">{status.code}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copy(status.code, "code")}
                className="focus-ring px-4 py-2 rounded-lg bg-white/5 hover:bg-[rgba(12,8,5,0.07)] text-surface-950 text-sm font-medium"
              >
                {copied === "code" ? "Copied!" : "Copy code"}
              </button>
              <button
                type="button"
                onClick={() => copy(status.shareUrl, "url")}
                className="focus-ring px-4 py-2 rounded-lg bg-white/5 hover:bg-[rgba(12,8,5,0.07)] text-surface-950 text-sm font-medium"
              >
                {copied === "url" ? "Copied!" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={() => shareNative(status)}
                className="focus-ring px-4 py-2 rounded-lg btn-primary text-white text-sm font-medium"
              >
                Share
              </button>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-[rgba(255,252,245,0.78)] text-xs text-[rgba(12,8,5,0.72)] break-all">
            {status.shareUrl}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="focus-ring px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium"
            >
              WhatsApp
            </a>
            <a
              href={emailHref}
              className="focus-ring px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-medium"
            >
              Email
            </a>
            <a
              href={twitterHref}
              target="_blank"
              rel="noreferrer"
              className="focus-ring px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-medium"
            >
              X / Twitter
            </a>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Activated" value={status.activatedReferrals} accent="text-emerald-300" />
          <Stat label="Pending" value={status.pendingReferrals} accent="text-amber-300" />
          <Stat label="Rejected" value={status.rejectedReferrals} accent="text-[rgba(12,8,5,0.72)]" />
          <Stat
            label="Days earned"
            value={status.activatedReferrals * status.bonusDays}
            accent="text-primary-300"
          />
        </section>

        {/* Recent */}
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold text-surface-950 mb-4">Recent invites</h2>
          {status.recent.length === 0 ? (
            <p className="text-sm text-[rgba(12,8,5,0.66)]">
              No invites yet. Share your code to start earning Premium days.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {status.recent.map((r) => (
                <li key={r.createdAt + r.refereeEmail} className="py-3 flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      r.status === "ACTIVATED"
                        ? "bg-emerald-400"
                        : r.status === "PENDING"
                          ? "bg-amber-400"
                          : "bg-white/30"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-950 truncate" title={r.refereeName}>{r.refereeName}</p>
                    <p className="text-xs text-[rgba(12,8,5,0.66)] truncate" title={r.refereeEmail}>{r.refereeEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[rgba(12,8,5,0.66)]">
                      {r.status === "ACTIVATED" ? "+" : ""}
                      {r.status === "ACTIVATED" ? r.bonusDays : 0} days
                    </p>
                    <p className="text-[11px] text-[rgba(12,8,5,0.66)]">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs uppercase tracking-wide text-[rgba(12,8,5,0.66)] mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
