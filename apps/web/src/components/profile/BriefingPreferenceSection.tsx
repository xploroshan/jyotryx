"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Self-saving toggle for the daily-briefing email opt-in.
 *
 * Lives outside the main "Save changes" button on the profile page so
 * that flipping it is a single one-click action — the most common
 * usability bug with notification preferences is half-flipped state
 * because the user expected the toggle itself to save.
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
        if (!cancelled) setEnabled(false);
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
    <section className="mt-8 pt-8 border-t border-white/[0.06]">
      <h3 className="text-lg font-bold text-white mb-2">Daily briefing email</h3>
      <p className="text-sm text-white/40 mb-4 max-w-xl">
        Get a personalised "My Day" briefing in your inbox each morning — tithi, nakshatra, what
        to do, what to avoid, your lucky number and Rahu Kaal for today. Free, sent once per
        day, no marketing fluff.
      </p>

      <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.03] max-w-xl">
        <div>
          <p className="text-sm font-medium text-white">Send me my briefing each morning</p>
          <p className="text-xs text-white/40 mt-1">
            Delivered to your account email. You can turn it off any time from this page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => enabled !== null && !saving && update(!enabled)}
          disabled={enabled === null || saving}
          aria-pressed={!!enabled}
          aria-busy={saving}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            enabled ? "bg-emerald-500" : "bg-white/20"
          } disabled:opacity-50`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
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
