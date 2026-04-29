"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Self-saving toggle for the daily-briefing email opt-OUT.
 *
 * Defaults to ON for every account: new registrations get the briefing
 * automatically, and the migration in 20260505 enrolled the existing
 * base. This control is the user's escape hatch — flip it off and the
 * change is persisted immediately, no separate "Save" button.
 */
export default function BriefingPreferenceSection({ token }: { token: string }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get<{ briefingEmailEnabled: boolean }>("/briefing/preferences", { token })
      .then((res) => {
        if (!cancelled) setEnabled(!!res.briefingEmailEnabled);
      })
      .catch(() => {
        // Network/auth failure → assume the server-side default of ON
        // rather than off; flipping off is a deliberate user action and
        // we don't want a stale fetch to misrepresent it.
        if (!cancelled) setEnabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const update = async (next: boolean) => {
    setSaving(true);
    setError(null);
    setSaved(false);
    const previous = enabled;
    setEnabled(next); // optimistic
    try {
      await api.put("/briefing/preferences", { briefingEmailEnabled: next }, { token });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setEnabled(previous); // rollback
      setError(err?.message || "Couldn't update your preference. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-8 pt-8 border-t border-[rgba(12,8,5,0.10)]">
      <h3 className="font-display text-lg font-semibold text-surface-950 mb-2">
        Daily briefing email
      </h3>
      <p className="text-sm text-secondary mb-4 max-w-xl leading-relaxed">
        A personalised &ldquo;My Day&rdquo; briefing — tithi, nakshatra, what to do, what to
        avoid, your lucky number and Rahu Kaal — lands in your inbox each morning. It&rsquo;s
        on by default for everyone who registers. Turn it off here any time.
      </p>

      <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-900 border border-[rgba(12,8,5,0.08)] max-w-xl">
        <div>
          <p className="text-sm font-medium text-surface-950">Send me my briefing each morning</p>
          <p className="text-xs text-secondary mt-1">
            Delivered to your account email. Switching this off stops emails immediately —
            no other action needed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => enabled !== null && !saving && update(!enabled)}
          disabled={enabled === null || saving}
          aria-pressed={!!enabled}
          aria-busy={saving}
          aria-label={enabled ? "Turn off daily briefing email" : "Turn on daily briefing email"}
          className={`focus-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-primary-500" : "bg-white/20"
          } disabled:opacity-50`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-surface-950 shadow-sm transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-300" role="alert">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mt-3 text-xs text-emerald-300" role="status">
          Saved — your preference is now live.
        </p>
      )}
    </section>
  );
}
