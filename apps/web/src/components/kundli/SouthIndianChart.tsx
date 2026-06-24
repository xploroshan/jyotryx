"use client";

/**
 * South Indian Rashi chart.
 *
 * Opposite convention to the North Indian style: the twelve SIGNS are fixed in
 * a 4×4 ring (Pisces top-left, running clockwise) and the houses rotate — the
 * sign holding the ascendant is the 1st house. The ascendant cell is
 * highlighted and the house number is printed faintly in each sign so you can
 * still read the bhavas. Planets sit in their sign cell with degree + a
 * retrograde marker.
 */

import { ChartHouse, ChartPlanet, abbr, signNumber } from "./chart-common";

interface SouthIndianChartProps {
  houses: ChartHouse[];
  planetaryPositions?: ChartPlanet[];
  ascendant?: string;
  className?: string;
}

// Fixed (row, col) of each sign in the 4×4 grid. Pisces is top-left and the
// signs run clockwise around the ring; the inner 2×2 stays empty.
const SIGN_CELL: Record<number, { row: number; col: number }> = {
  12: { row: 1, col: 1 }, // Pisces
  1: { row: 1, col: 2 },  // Aries
  2: { row: 1, col: 3 },  // Taurus
  3: { row: 1, col: 4 },  // Gemini
  4: { row: 2, col: 4 },  // Cancer
  5: { row: 3, col: 4 },  // Leo
  6: { row: 4, col: 4 },  // Virgo
  7: { row: 4, col: 3 },  // Libra
  8: { row: 4, col: 2 },  // Scorpio
  9: { row: 4, col: 1 },  // Sagittarius
  10: { row: 3, col: 1 }, // Capricorn
  11: { row: 2, col: 1 }, // Aquarius
};

export function SouthIndianChart({
  houses,
  planetaryPositions,
  ascendant,
  className,
}: SouthIndianChartProps) {
  // Group planets by their SIGN number (1–12).
  const bySign = new Map<number, { label: string; retro: boolean }[]>();
  if (planetaryPositions?.length) {
    for (const p of planetaryPositions) {
      const n = signNumber(p.sign);
      if (n == null) continue;
      const deg = Number.isFinite(p.degree) ? ` ${Math.floor(p.degree)}°` : "";
      const list = bySign.get(n) ?? [];
      list.push({ label: `${abbr(p.planet)}${deg}`, retro: p.isRetrograde });
      bySign.set(n, list);
    }
  } else {
    for (const h of houses ?? []) {
      const n = signNumber(h.sign);
      if (n == null) continue;
      const list = bySign.get(n) ?? [];
      for (const name of h.planets ?? []) list.push({ label: abbr(name), retro: false });
      bySign.set(n, list);
    }
  }

  // House number for each sign = its offset from the ascendant sign + 1.
  const ascSignNum = signNumber(ascendant);
  const houseForSign = (signNum: number): number | null =>
    ascSignNum == null ? null : (((signNum - ascSignNum + 12) % 12) + 1);

  return (
    <div className={className ?? "w-full max-w-lg mx-auto aspect-square"}>
      <div className="grid h-full w-full grid-cols-4 grid-rows-4 gap-0 rounded-lg overflow-hidden border border-[rgba(12,8,5,0.28)]">
        {Array.from({ length: 16 }, (_, idx) => {
          const row = Math.floor(idx / 4) + 1;
          const col = (idx % 4) + 1;
          // Inner 2×2 (rows 2–3, cols 2–3) is the empty centre.
          const isCenter = row >= 2 && row <= 3 && col >= 2 && col <= 3;
          if (isCenter) {
            // Render the centre label once (top-left of the inner block).
            if (row === 2 && col === 2) {
              return (
                <div
                  key={idx}
                  className="col-span-2 row-span-2 flex items-center justify-center text-[rgba(12,8,5,0.66)] text-xs font-semibold tracking-wide"
                >
                  Rashi · D1
                </div>
              );
            }
            return null; // covered by the col-span-2 row-span-2 cell
          }
          const signNum = Object.entries(SIGN_CELL).find(
            ([, c]) => c.row === row && c.col === col,
          )?.[0];
          if (!signNum) return <div key={idx} />;
          const n = Number(signNum);
          const planets = bySign.get(n) ?? [];
          const houseNum = houseForSign(n);
          const isAsc = ascSignNum === n;

          return (
            <div
              key={idx}
              className={`relative border border-[rgba(12,8,5,0.16)] p-1 min-h-0 overflow-hidden ${
                isAsc ? "bg-[rgba(217,70,239,0.08)]" : ""
              }`}
            >
              {/* House number (faint) + Asc marker, top-left */}
              <div className="absolute top-0.5 left-1 text-[9px] leading-none text-[rgba(12,8,5,0.66)]">
                {houseNum ?? ""}
              </div>
              {isAsc && (
                <div className="absolute top-0.5 right-1 text-[9px] font-semibold leading-none text-[rgba(217,70,239,0.95)]">
                  Asc
                </div>
              )}
              {/* Sign number (faint), bottom-right */}
              <div className="absolute bottom-0.5 right-1 text-[8px] leading-none text-[rgba(12,8,5,0.26)]">
                {n}
              </div>
              {/* Planets */}
              <div className="flex h-full flex-col items-center justify-center gap-0 pt-2 font-mono text-[10px] sm:text-[11px] font-semibold leading-tight">
                {planets.map((p, i) => (
                  <span key={i} className={p.retro ? "text-red-600" : "text-[rgba(12,8,5,0.82)]"}>
                    {p.label}
                    {p.retro ? " (R)" : ""}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default SouthIndianChart;
