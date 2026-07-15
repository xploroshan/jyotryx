"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";

export interface PlaceCoords {
  lat: number;
  lng: number;
}

interface GeoSuggestion {
  name: string;
  label: string;
  lat: number;
  lng: number;
  country: string | null;
  state: string | null;
  countryCode: string | null;
}

interface PlaceAutocompleteProps {
  id?: string;
  /** The place name text shown in the input. */
  value: string;
  /** Coordinates when the current `value` was picked from the list; null when
   *  the user typed free text we couldn't locate. */
  coords: PlaceCoords | null;
  /**
   * Fires on every change. `coords` is non-null only when the user selected a
   * suggestion — typing by hand clears it, because a hand-typed name isn't
   * geocoded and would otherwise carry stale coordinates.
   */
  onChange: (name: string, coords: PlaceCoords | null) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  "aria-invalid"?: boolean;
  className?: string;
  /** Extra hint under the field (e.g. the existing "used for lat/lng" copy). */
  hint?: React.ReactNode;
}

const DEBOUNCE_MS = 300;
const MIN_QUERY_LEN = 2;

/**
 * Birthplace type-ahead backed by the server geo proxy (`GET /geo/search`,
 * OSM/Photon). Selecting a suggestion captures real coordinates so charts are
 * cast for the actual place instead of the Delhi fallback. Free text is still
 * allowed — it just won't carry coordinates until a suggestion is picked.
 */
export function PlaceAutocomplete({
  id,
  value,
  coords,
  onChange,
  placeholder,
  required,
  disabled,
  "aria-invalid": ariaInvalid,
  className,
  hint,
}: PlaceAutocompleteProps) {
  const { t, locale } = useTranslation();
  const reactId = useId();
  const inputId = id ?? `place-${reactId}`;
  const listboxId = `${inputId}-listbox`;

  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Bumps per keystroke so a slow in-flight response can't overwrite a newer
  // query's results (last-write-wins race guard).
  const querySeq = useRef(0);
  // When we set the input by selecting a suggestion, skip the next search so the
  // dropdown doesn't reopen with the just-picked place.
  const suppressSearch = useRef(false);
  // Only search after the user has actually typed. A `value` that arrives from
  // the parent (profile prefill, SEO deep-link, saved-details seed) must not pop
  // the dropdown open or fire a geocode request on page load.
  const userEdited = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Debounced search on `value`.
  useEffect(() => {
    if (suppressSearch.current) {
      suppressSearch.current = false;
      return;
    }
    if (!userEdited.current) return; // programmatic prefill — don't search/open
    const q = value.trim();
    if (q.length < MIN_QUERY_LEN) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    const seq = ++querySeq.current;
    const handle = setTimeout(async () => {
      try {
        const lang = (locale || "en").slice(0, 2);
        const res = await api.get<GeoSuggestion[]>(
          `/geo/search?q=${encodeURIComponent(q)}&lang=${lang}`,
        );
        if (seq !== querySeq.current) return; // a newer query superseded this one
        setSuggestions(res);
        setActiveIndex(-1);
        setOpen(true);
      } catch {
        if (seq !== querySeq.current) return;
        setSuggestions([]);
        setOpen(true); // still open to show the "no results / type it in" note
      } finally {
        if (seq === querySeq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [value, locale]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const select = (s: GeoSuggestion) => {
    suppressSearch.current = true;
    onChange(s.name, { lat: s.lat, lng: s.lng });
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        select(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && value.trim().length >= MIN_QUERY_LEN;

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
          autoComplete="off"
          required={required}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            userEdited.current = true;
            onChange(e.target.value, null);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          className={className ?? "w-full px-4 py-3 rounded-xl surface-input"}
        />
        {/* A pin appears once a suggestion has been located. */}
        {coords && (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600"
            title={t.form.placeLocated}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
              <circle cx="12" cy="11" r="2.5" />
            </svg>
          </span>
        )}
      </div>

      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-[rgba(26,20,16,0.14)] bg-[rgb(255,252,245)] shadow-lg py-1"
        >
          {loading && suggestions.length === 0 && (
            <li className="px-4 py-2 text-sm text-secondary">
              {t.form.placeSearching}
            </li>
          )}
          {!loading && suggestions.length === 0 && (
            <li className="px-4 py-2 text-sm text-secondary">
              {t.form.placeNoResults}
            </li>
          )}
          {suggestions.map((s, i) => (
            <li
              key={`${s.label}-${s.lat}-${s.lng}`}
              id={`${listboxId}-opt-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // Use mousedown (fires before input blur) so the click registers.
              onMouseDown={(e) => {
                e.preventDefault();
                select(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`cursor-pointer px-4 py-2 text-sm flex items-center gap-2 ${
                i === activeIndex ? "bg-primary-500/10 text-emphasis" : "text-emphasis"
              }`}
            >
              <svg className="w-4 h-4 shrink-0 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <circle cx="12" cy="11" r="2.5" />
              </svg>
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ul>
      )}

      {hint && <div className="mt-1">{hint}</div>}
    </div>
  );
}
