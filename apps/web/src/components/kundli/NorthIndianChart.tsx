"use client";

/**
 * North Indian (diamond) Rashi chart.
 *
 * Houses are FIXED in the North Indian style — house 1 is always the top
 * centre diamond and the rest run anticlockwise — while the rashi (sign)
 * that occupies each house rotates with the ascendant. Each house shows its
 * sign number plus the planets sitting in it, with degree-in-sign and a
 * retrograde marker, stacked so nothing overlaps or gets truncated.
 *
 * Geometry: a 400×400 viewBox with the outer square, both corner-to-corner
 * diagonals and the side-midpoint diamond — the classic 12-region layout.
 * The SVG scales to its container, so it stays crisp at any size.
 */

import { ChartHouse, ChartPlanet, abbr, signNumber } from "./chart-common";

export type { ChartHouse, ChartPlanet };

interface NorthIndianChartProps {
  houses: ChartHouse[];
  planetaryPositions?: ChartPlanet[];
  ascendant?: string;
  /** Wrapper class — defaults to a responsive, centred, square box. */
  className?: string;
}

// Label centroids for each house (1-based) in the 400×400 viewBox. These are
// the geometric centres of the 12 regions described above.
const HOUSE_CENTER: Record<number, { x: number; y: number }> = {
  1: { x: 200, y: 100 },
  2: { x: 100, y: 48 },
  3: { x: 48, y: 100 },
  4: { x: 100, y: 200 },
  5: { x: 48, y: 300 },
  6: { x: 100, y: 352 },
  7: { x: 200, y: 300 },
  8: { x: 300, y: 352 },
  9: { x: 352, y: 300 },
  10: { x: 300, y: 200 },
  11: { x: 352, y: 100 },
  12: { x: 300, y: 48 },
};

export function NorthIndianChart({
  houses,
  planetaryPositions,
  ascendant,
  className,
}: NorthIndianChartProps) {
  // Group planets by house, preferring the richer planetaryPositions
  // (degree + retrograde) and falling back to the plain houses[].planets.
  const byHouse = new Map<number, { label: string; retro: boolean }[]>();
  if (planetaryPositions?.length) {
    for (const p of planetaryPositions) {
      const list = byHouse.get(p.house) ?? [];
      const deg = Number.isFinite(p.degree) ? ` ${Math.floor(p.degree)}°` : "";
      list.push({ label: `${abbr(p.planet)}${deg}`, retro: p.isRetrograde });
      byHouse.set(p.house, list);
    }
  } else {
    for (const h of houses ?? []) {
      byHouse.set(
        h.house,
        (h.planets ?? []).map((name) => ({ label: abbr(name), retro: false })),
      );
    }
  }

  const stroke = "rgba(12,8,5,0.28)";
  const strokeSoft = "rgba(12,8,5,0.16)";

  return (
    <div className={className ?? "w-full max-w-xl mx-auto aspect-square"}>
      <svg viewBox="0 0 400 400" className="w-full h-full" role="img" aria-label="North Indian Rashi chart">
        {/* Frame */}
        <rect x="6" y="6" width="388" height="388" rx="6" fill="rgba(255,252,245,0.55)" stroke={stroke} strokeWidth="1.5" />
        {/* Corner-to-corner diagonals */}
        <line x1="6" y1="6" x2="394" y2="394" stroke={strokeSoft} strokeWidth="1" />
        <line x1="394" y1="6" x2="6" y2="394" stroke={strokeSoft} strokeWidth="1" />
        {/* Side-midpoint diamond */}
        <polygon
          points="200,6 394,200 200,394 6,200"
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
        />

        {Array.from({ length: 12 }, (_, idx) => {
          const houseNum = idx + 1;
          const center = HOUSE_CENTER[houseNum];
          const houseData = houses?.find((h) => h.house === houseNum);
          const rashi = signNumber(houseData?.sign);
          const planets = byHouse.get(houseNum) ?? [];
          const lineHeight = 13;
          const stackHeight = planets.length * lineHeight;
          // Sign number sits just above the planet stack; the stack is
          // vertically centred on the house centroid.
          const signY = center.y - stackHeight / 2 - 5;
          const firstPlanetY = center.y - stackHeight / 2 + 10;

          return (
            <g key={houseNum}>
              {/* Rashi (sign) number — faint, anchors the house */}
              {rashi != null && (
                <text
                  x={center.x}
                  y={signY}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="sans-serif"
                  fill="rgba(12,8,5,0.34)"
                >
                  {rashi}
                </text>
              )}
              {/* Ascendant marker in house 1 */}
              {houseNum === 1 && (
                <text
                  x={center.x}
                  y={signY - 12}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fontFamily="sans-serif"
                  fill="rgba(217,70,239,0.95)"
                >
                  {ascendant ? `Asc · ${ascendant.slice(0, 3)}` : "Asc"}
                </text>
              )}
              {/* Planets, stacked */}
              {planets.map((p, i) => (
                <text
                  key={i}
                  x={center.x}
                  y={firstPlanetY + i * lineHeight}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fill={p.retro ? "var(--color-danger)" : "rgba(12,8,5,0.82)"}
                >
                  {p.label}{p.retro ? " (R)" : ""}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default NorthIndianChart;
