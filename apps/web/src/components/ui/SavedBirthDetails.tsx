"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/store";
import { useTranslation } from "@/i18n";

export interface BirthDetailsValue {
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
}

interface SavedBirthDetailsProps {
  /** Current birth details held by the parent feature. */
  value: BirthDetailsValue;
  /** Called whenever the details change (seeding from profile or user edits). */
  onChange: (next: BirthDetailsValue) => void;
  /**
   * Which optional fields this feature actually needs. Date of birth is
   * always required; time and place default to required too. A feature that
   * only consumes the birth date (e.g. profections, annual profections)
   * passes `{ time: false, place: false }` so we neither ask for nor
   * summarise fields it ignores.
   */
  fields?: { time?: boolean; place?: boolean };
  /** Disambiguates input ids when several birth forms share one page. */
  idPrefix?: string;
  className?: string;
}

/**
 * Shared birth-details block that lets every feature reuse the details the
 * user already entered once (during onboarding / on their profile) instead
 * of re-collecting them.
 *
 * - When the saved profile already has the fields this feature needs, it
 *   renders a compact "Using your profile details" summary with an Edit
 *   affordance — no empty form to refill.
 * - When something is missing (or the user taps Edit), it falls back to the
 *   familiar date / time / place inputs, pre-seeded with whatever is on file.
 *
 * The component is presentational + self-seeding: it reads the saved details
 * from the auth store and pushes them up via `onChange`, so the parent only
 * has to keep a `BirthDetailsValue` in state and read it when submitting.
 */
export default function SavedBirthDetails({
  value,
  onChange,
  fields,
  idPrefix = "birth",
  className = "",
}: SavedBirthDetailsProps) {
  const { t, locale } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const needTime = fields?.time !== false;
  const needPlace = fields?.place !== false;

  // The details on file, normalised to the same shape the inputs use.
  const saved: BirthDetailsValue = {
    dateOfBirth: user?.dateOfBirth?.slice(0, 10) ?? "",
    timeOfBirth: user?.timeOfBirth ?? "",
    placeOfBirth: user?.placeOfBirth ?? "",
  };

  const savedComplete = Boolean(
    saved.dateOfBirth &&
      (!needTime || saved.timeOfBirth) &&
      (!needPlace || saved.placeOfBirth),
  );

  const matchesSaved =
    value.dateOfBirth === saved.dateOfBirth &&
    (!needTime || value.timeOfBirth === saved.timeOfBirth) &&
    (!needPlace || value.placeOfBirth === saved.placeOfBirth);

  const valueEmpty =
    !value.dateOfBirth &&
    (!needTime || !value.timeOfBirth) &&
    (!needPlace || !value.placeOfBirth);

  // Seed the parent from the saved profile exactly once, when the details
  // become available. The auth store rehydrates asynchronously, so the saved
  // values can arrive a tick after first render — hence the effect rather
  // than a useState initializer (which would miss the late hydration).
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (savedComplete && valueEmpty) {
      seeded.current = true;
      onChange(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedComplete, valueEmpty]);

  // Collapsed (summary) whenever we have a complete, untouched set of saved
  // details. The user can expand to override for a one-off chart.
  const [editing, setEditing] = useState(false);
  const showSummary = savedComplete && matchesSaved && !editing;

  const update = (patch: Partial<BirthDetailsValue>) =>
    onChange({ ...value, ...patch });

  const fmtDate = (s: string) => {
    if (!s) return "";
    try {
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return s;
      return d.toLocaleDateString(locale || undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return s;
    }
  };

  if (showSummary) {
    const parts = [fmtDate(value.dateOfBirth)];
    if (needTime && value.timeOfBirth) parts.push(value.timeOfBirth);
    if (needPlace && value.placeOfBirth) parts.push(value.placeOfBirth);
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border divider bg-[rgba(255,252,245,0.86)] px-3 py-2.5 ${className}`}
      >
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-[rgba(12,8,5,0.66)]">
            {t.common.usingProfileDetails}
          </p>
          <p className="truncate text-sm text-surface-950">{parts.join(" · ")}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="focus-ring shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-500/10 transition-colors"
        >
          {t.common.edit}
        </button>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <label
          htmlFor={`${idPrefix}-dob`}
          className="block text-xs text-secondary mb-1"
        >
          {t.form.dateOfBirth}
        </label>
        <input
          id={`${idPrefix}-dob`}
          type="date"
          value={value.dateOfBirth}
          onChange={(e) => update({ dateOfBirth: e.target.value })}
          required
          className="w-full bg-[rgba(255,252,245,0.86)] border divider rounded-lg px-3 py-2 text-sm text-surface-950 [color-scheme:dark]"
        />
      </div>
      {needTime && (
        <div>
          <label
            htmlFor={`${idPrefix}-tob`}
            className="block text-xs text-secondary mb-1"
          >
            {t.form.timeOfBirth}
          </label>
          <input
            id={`${idPrefix}-tob`}
            type="time"
            value={value.timeOfBirth}
            onChange={(e) => update({ timeOfBirth: e.target.value })}
            required
            className="w-full bg-[rgba(255,252,245,0.86)] border divider rounded-lg px-3 py-2 text-sm text-surface-950 [color-scheme:dark]"
          />
        </div>
      )}
      {needPlace && (
        <div>
          <label
            htmlFor={`${idPrefix}-pob`}
            className="block text-xs text-secondary mb-1"
          >
            {t.form.placeOfBirth}
          </label>
          <input
            id={`${idPrefix}-pob`}
            type="text"
            value={value.placeOfBirth}
            onChange={(e) => update({ placeOfBirth: e.target.value })}
            placeholder={t.form.placePlaceholder}
            required
            className="w-full bg-[rgba(255,252,245,0.86)] border divider rounded-lg px-3 py-2 text-sm text-surface-950"
          />
        </div>
      )}
      {/* Offer a one-tap revert to the saved profile once it's complete and the
          user has diverged — so editing for a one-off chart isn't a trap. */}
      {savedComplete && !matchesSaved && (
        <button
          type="button"
          onClick={() => {
            onChange(saved);
            setEditing(false);
          }}
          aria-label={t.common.usingProfileDetails}
          className="focus-ring inline-flex items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
        >
          <span aria-hidden>↺</span>
          {t.common.usingProfileDetails}
        </button>
      )}
    </div>
  );
}
