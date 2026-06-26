"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { getCurrentPosition, mapsSearchUrl } from "@/lib/geo";

export interface MitigationPlace {
  name: string;
  place: string;
  state: string;
  lat: number;
  lng: number;
  why: string;
  distanceKm?: number;
}

export interface MitigationItem {
  title: string;
  detail: string;
  caution?: string;
}

export interface MitigationGroup {
  modality: string;
  items: MitigationItem[];
}

export interface MitigationPlan {
  issue: string;
  label: string;
  planet?: string;
  deity: string;
  overview: string;
  searchQuery: string;
  temples: MitigationPlace[];
  groups: MitigationGroup[];
  disclaimer: string;
}

// Render order for the non-temple modality groups.
const MODALITY_ORDER = [
  "food",
  "activity",
  "charity",
  "fasting",
  "gemstone",
  "mantra",
  "rudraksha",
];

/**
 * "How to mitigate" block. Shows a full, multi-modal mitigation plan for an
 * adverse condition — temples/religious places (location-rankable), food & diet,
 * activities & lifestyle, charity, fasting, and gemstones/mantras/rudraksha.
 *
 * Pass a ready `plan` (e.g. from a dosha result that already carries one) OR an
 * `issue` key to fetch from /astrology/mitigation/:issue. `remedies` is an
 * optional list of already-localized short remedies (from the KB) shown up top.
 * Fails quietly — never blocks the page.
 */
export default function Mitigation({
  plan: initialPlan,
  issue,
  remedies,
  bare = false,
  className = "",
}: {
  plan?: MitigationPlan;
  issue?: string;
  remedies?: string[];
  /** Render without the outer surface-card / big heading, for embedding inside another card. */
  bare?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [plan, setPlan] = useState<MitigationPlan | null>(initialPlan ?? null);
  const [loading, setLoading] = useState(!initialPlan && !!issue);
  const [locating, setLocating] = useState(false);

  // Fetch by issue when no plan was supplied directly.
  useEffect(() => {
    if (initialPlan || !issue) return;
    let cancelled = false;
    setLoading(true);
    Promise.resolve(api.get<MitigationPlan>(`/astrology/mitigation/${encodeURIComponent(issue)}`))
      .then((res) => {
        if (!cancelled) {
          setPlan(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [issue, initialPlan]);

  const m = t.mitigate;

  // Re-rank temples nearest-first from the user's location.
  const findNearby = async () => {
    if (locating) return;
    const key = plan?.issue ?? issue;
    setLocating(true);
    const coords = await getCurrentPosition();
    if (!coords) {
      setLocating(false);
      // No permission — open a plain maps search instead.
      if (plan && typeof window !== "undefined") {
        window.open(mapsSearchUrl(plan.searchQuery), "_blank", "noopener,noreferrer");
      }
      return;
    }
    try {
      if (key) {
        const res = await api.get<MitigationPlan>(
          `/astrology/mitigation/${encodeURIComponent(key)}?lat=${coords.lat}&lng=${coords.lng}`,
        );
        setPlan(res);
      }
    } catch {
      if (plan && typeof window !== "undefined") {
        window.open(mapsSearchUrl(plan.searchQuery, coords), "_blank", "noopener,noreferrer");
      }
    } finally {
      setLocating(false);
    }
  };

  const hasRemedies = !!remedies && remedies.length > 0;

  const Wrapper = bare ? "div" : "section";
  const wrapperClass = bare ? className : `surface-card p-6 ${className}`;

  if (loading) {
    return (
      <Wrapper className={wrapperClass} aria-busy="true">
        {!bare && <h2 className="text-lg font-semibold text-surface-950 mb-3">{m.heading}</h2>}
        <div className="space-y-2.5 animate-pulse" aria-hidden="true">
          <div className="h-3.5 w-3/4 rounded bg-[rgba(12,8,5,0.08)]" />
          <div className="h-3.5 w-full rounded bg-[rgba(12,8,5,0.08)]" />
        </div>
      </Wrapper>
    );
  }

  if (!plan && !hasRemedies) return null;

  const ranked = plan?.temples.some((tpl) => typeof tpl.distanceKm === "number");
  const orderedGroups = plan
    ? [...plan.groups].sort(
        (a, b) => MODALITY_ORDER.indexOf(a.modality) - MODALITY_ORDER.indexOf(b.modality),
      )
    : [];

  return (
    <Wrapper className={wrapperClass}>
      {!bare && <h2 className="text-lg font-semibold text-surface-950 mb-1">{m.heading}</h2>}
      {!bare && plan?.label && (
        <p className="text-xs font-medium uppercase tracking-wide text-primary-700 mb-3">{plan.label}</p>
      )}

      {plan?.overview && <p className="text-sm text-emphasis leading-relaxed mb-5">{plan.overview}</p>}

      {/* Already-localized quick remedies from the KB, when provided. */}
      {hasRemedies && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-surface-950 mb-2">{m.quickRemedies}</h3>
          <ul className="space-y-1.5">
            {remedies!.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-emphasis leading-relaxed">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Temples / religious places — location-rankable. */}
      {plan && plan.temples.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-surface-950 mb-2">
            {m.modality.temple}
            {ranked ? ` · ${m.nearestSuffix}` : ""}
          </h3>
          <ul className="space-y-2.5">
            {plan.temples.slice(0, ranked ? 5 : 4).map((tpl, i) => (
              <li key={i} className="text-sm leading-relaxed">
                <span className="font-medium text-surface-950">{tpl.name}</span>
                <span className="text-[rgba(12,8,5,0.6)]">
                  {" — "}
                  {tpl.place}
                  {tpl.state ? `, ${tpl.state}` : ""}
                  {typeof tpl.distanceKm === "number" ? ` · ~${tpl.distanceKm} ${m.away}` : ""}
                </span>
                <span className="block text-[rgba(12,8,5,0.66)]">{tpl.why}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={findNearby}
            disabled={locating}
            className="btn-secondary mt-3 text-sm disabled:opacity-60"
          >
            {locating ? m.locating : m.nearbyButton}
          </button>
          <p className="mt-2 text-xs text-[rgba(12,8,5,0.5)]">{m.locationNote}</p>
        </div>
      )}

      {/* Other modalities. */}
      {orderedGroups.length > 0 && (
        <div className="space-y-4">
          {orderedGroups.map((g) => (
            <div key={g.modality}>
              <h3 className="text-sm font-semibold text-surface-950 mb-1.5">
                {m.modality[g.modality as keyof typeof m.modality] ?? g.modality}
              </h3>
              <ul className="space-y-2">
                {g.items.map((it, i) => (
                  <li key={i} className="text-sm leading-relaxed">
                    <span className="font-medium text-surface-950">{it.title}</span>
                    <span className="block text-emphasis">{it.detail}</span>
                    {it.caution && (
                      <span className="mt-0.5 block text-xs text-[rgba(12,8,5,0.55)]">
                        {m.caution}: {it.caution}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="mt-5 text-xs text-[rgba(12,8,5,0.5)]">{plan?.disclaimer ?? m.disclaimer}</p>
    </Wrapper>
  );
}
