"use client";

/**
 * A reliable time-of-birth selector built from plain <select> dropdowns
 * (Hour / Minute / AM-PM) instead of the native `<input type="time">`.
 *
 * The native Android Material time picker is unreliable for some Chrome /
 * WebView builds — the clock dialog can open without a usable confirm ("OK")
 * button, so a chosen time can never be committed and the field stays empty.
 * Dropdowns work consistently across every device and browser.
 *
 * The value is the same 24-hour "HH:mm" string the native input produced, so
 * this is a drop-in replacement everywhere `tob`/`timeOfBirth` is used.
 */

type Period = "AM" | "PM";

interface TimeOfBirthInputProps {
  /** 24-hour "HH:mm" value, or "" when unset. */
  value: string;
  onChange: (value: string) => void;
  /** Applied to the hour <select> so an external <label htmlFor> can focus it. */
  id?: string;
  required?: boolean;
  className?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59

function parse(value: string): { hour12: string; minute: string; period: Period } {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!match) return { hour12: "", minute: "", period: "AM" };
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) {
    return { hour12: "", minute: "", period: "AM" };
  }
  const period: Period = h >= 12 ? "PM" : "AM";
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12: String(hour12), minute: String(m), period };
}

function to24(hour12: string, minute: string, period: Period): string {
  if (hour12 === "" || minute === "") return "";
  let h = parseInt(hour12, 10);
  const m = parseInt(minute, 10);
  if (period === "AM") {
    if (h === 12) h = 0;
  } else if (h !== 12) {
    h += 12;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function TimeOfBirthInput({
  value,
  onChange,
  id,
  required = false,
  className = "",
}: TimeOfBirthInputProps) {
  const { hour12, minute, period } = parse(value);

  const selectClass = "px-3 py-3 rounded-xl surface-input min-w-0";

  const emit = (h: string, m: string, p: Period) => onChange(to24(h, m, p));

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <select
        id={id}
        aria-label="Hour"
        required={required}
        value={hour12}
        onChange={(e) => emit(e.target.value, minute, period)}
        className={`${selectClass} flex-1`}
      >
        <option value="">HH</option>
        {HOURS.map((h) => (
          <option key={h} value={String(h)}>
            {String(h).padStart(2, "0")}
          </option>
        ))}
      </select>
      <span className="text-emphasis font-semibold" aria-hidden="true">
        :
      </span>
      <select
        aria-label="Minute"
        required={required}
        value={minute}
        onChange={(e) => emit(hour12, e.target.value, period)}
        className={`${selectClass} flex-1`}
      >
        <option value="">MM</option>
        {MINUTES.map((m) => (
          <option key={m} value={String(m)}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        value={period}
        onChange={(e) => emit(hour12, minute, e.target.value as Period)}
        className={`${selectClass} flex-1`}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
