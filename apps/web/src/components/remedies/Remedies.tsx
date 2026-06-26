"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n";
import { getCurrentPosition, mapsSearchUrl } from "@/lib/geo";

export interface RemedyTemple {
  name: string;
  place: string;
  state: string;
  lat: number;
  lng: number;
  why: string;
}

export interface RemedyTempleSet {
  deity: string;
  searchQuery: string;
  temples: RemedyTemple[];
}

export interface RemedyDosha {
  name: string;
  remedies?: string[];
  remedyTemples?: RemedyTempleSet;
}

/**
 * Mitigation block for a present dosha: the textual remedies (mantra / gemstone
 * / charity, already localized from the API) plus curated authoritative temples
 * and a permission-graceful "find temples near me" that opens a maps search
 * centered on the user's location. No location is stored.
 */
export default function Remedies({ dosha }: { dosha: RemedyDosha }) {
  const { t } = useTranslation();
  const [locating, setLocating] = useState(false);

  const hasRemedies = !!dosha.remedies && dosha.remedies.length > 0;
  const temples = dosha.remedyTemples;
  if (!hasRemedies && !temples) return null;

  const findNearby = async () => {
    if (!temples || locating) return;
    setLocating(true);
    const coords = await getCurrentPosition();
    setLocating(false);
    if (typeof window !== "undefined") {
      window.open(mapsSearchUrl(temples.searchQuery, coords), "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="space-y-5">
      {hasRemedies && (
        <div>
          <h4 className="text-sm font-semibold text-surface-950 mb-2">{t.interpret.remedies}</h4>
          <ul className="space-y-1.5">
            {dosha.remedies!.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-emphasis leading-relaxed">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {temples && temples.temples.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-surface-950 mb-2">{t.interpret.temples}</h4>
          <ul className="space-y-2.5">
            {temples.temples.map((tpl, i) => (
              <li key={i} className="text-sm leading-relaxed">
                <span className="font-medium text-surface-950">{tpl.name}</span>
                <span className="text-[rgba(12,8,5,0.6)]">
                  {" — "}
                  {tpl.place}
                  {tpl.state ? `, ${tpl.state}` : ""}
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
            {locating ? t.interpret.locating : t.interpret.findNearby}
          </button>
          <p className="mt-2 text-xs text-[rgba(12,8,5,0.5)]">{t.interpret.locationNote}</p>
        </div>
      )}
    </div>
  );
}
