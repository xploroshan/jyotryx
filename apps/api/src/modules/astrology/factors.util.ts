/**
 * "Show Your Work" — chart-factor extraction.
 *
 * Turns the deterministic outputs of the astrology engine (planetary
 * dignities, yogas, the active dasha, doshas) into a flat, uniform list of
 * the *specific* reasons behind a reading. The web UI surfaces this so a user
 * can see exactly which chart factors drive their result ("Saturn debilitated
 * in the 4th", "currently in Venus Mahadasha") instead of a vague prediction.
 *
 * This is a pure, dependency-free transform — no DI, no I/O — so it is trivial
 * to unit-test and can be reused by chat readings, reports, and the Decision
 * Room later. It only ever READS already-computed fields; it never recomputes
 * astronomy, which keeps the "same birth details → same factors" guarantee.
 *
 * Factor labels are composed in English from canonical planet/sign names —
 * matching how the kundli UI already renders planet/sign names — while the
 * `detail` reuses the engine's already-localized yoga/dosha descriptions.
 */

export type FactorContribution = 'positive' | 'negative' | 'neutral';
export type FactorSource = 'planet' | 'yoga' | 'dasha' | 'dosha' | 'panchang';

export interface ChartFactor {
  /** Stable, locale-independent identifier (e.g. "planet.Sun.exalted"). */
  code: string;
  /** Short human-readable summary of the factor. */
  label: string;
  /** Optional longer explanation (reuses the engine's localized prose). */
  detail?: string;
  /** Whether the factor reads as supportive, challenging, or neutral context. */
  contribution: FactorContribution;
  /** Which part of the chart this factor came from. */
  source: FactorSource;
}

// Structural input shapes — kept local (rather than imported from
// astrology.service) so this util has zero dependencies and no import cycle.
interface PlanetLike {
  planet: string;
  sign: string;
  house: number;
  status?: string;
  isCombust?: boolean;
}
interface YogaLike {
  name: string;
  description: string;
  effect: string;
}
interface DashaLike {
  planet: string;
  startDate: string;
  endDate: string;
}
interface DoshaLike {
  name: string;
  present: boolean;
  severity: string;
  description: string;
}

// Essential-dignity labels worth surfacing as standalone factors. Common
// relational states (Friendly/Enemy/Neutral) are intentionally omitted so the
// list stays decisive rather than listing all eleven bodies.
const POSITIVE_DIGNITIES = new Set(['Exalted', 'Own Sign', 'Mooltrikona', 'Moolatrikona']);
const NEGATIVE_DIGNITIES = new Set(['Debilitated']);

function dignitySlug(status: string): string {
  return status.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Build the factor list for a birth chart from its planetary positions,
 * detected yogas, and the currently-active mahadasha.
 *
 * @param now Injectable clock for deterministic tests; defaults to the
 *            current time when resolving the active dasha period.
 */
export function buildKundliFactors(
  chart: { planetaryPositions?: PlanetLike[]; yogas?: YogaLike[]; dashas?: DashaLike[] },
  now: Date = new Date(),
): ChartFactor[] {
  const factors: ChartFactor[] = [];

  // ── Planetary dignities & combustion ──────────────────────────────────
  for (const p of chart.planetaryPositions ?? []) {
    const status = p.status?.trim();
    if (status && POSITIVE_DIGNITIES.has(status)) {
      factors.push({
        code: `planet.${p.planet}.${dignitySlug(status)}`,
        label: `${p.planet} ${status.toLowerCase()} in ${p.sign} · House ${p.house}`,
        contribution: 'positive',
        source: 'planet',
      });
    } else if (status && NEGATIVE_DIGNITIES.has(status)) {
      factors.push({
        code: `planet.${p.planet}.${dignitySlug(status)}`,
        label: `${p.planet} ${status.toLowerCase()} in ${p.sign} · House ${p.house}`,
        contribution: 'negative',
        source: 'planet',
      });
    }
    if (p.isCombust) {
      factors.push({
        code: `planet.${p.planet}.combust`,
        label: `${p.planet} combust (close to the Sun) · House ${p.house}`,
        contribution: 'negative',
        source: 'planet',
      });
    }
  }

  // ── Yogas ─────────────────────────────────────────────────────────────
  for (const y of chart.yogas ?? []) {
    factors.push({
      code: `yoga.${y.name.replace(/\s+/g, '_')}`,
      label: y.name,
      detail: y.description,
      contribution: y.effect === 'benefic' ? 'positive' : y.effect === 'malefic' ? 'negative' : 'neutral',
      source: 'yoga',
    });
  }

  // ── Active mahadasha (timing context) ─────────────────────────────────
  const active = findActiveDasha(chart.dashas ?? [], now);
  if (active) {
    factors.push({
      code: `dasha.active.${active.planet}`,
      label: `Currently in ${active.planet} Mahadasha`,
      detail: `Active from ${active.startDate} to ${active.endDate}`,
      contribution: 'neutral',
      source: 'dasha',
    });
  }

  return factors;
}

/** Build factors for the doshas present in a dosha analysis. */
export function buildDoshaFactors(doshas: DoshaLike[] | undefined): ChartFactor[] {
  const factors: ChartFactor[] = [];
  for (const d of doshas ?? []) {
    if (!d.present) continue;
    factors.push({
      code: `dosha.${d.name.replace(/\s+/g, '_')}`,
      label: d.severity && d.severity !== 'none' ? `${d.name} (${d.severity})` : d.name,
      detail: d.description,
      contribution: 'negative',
      source: 'dosha',
    });
  }
  return factors;
}

/** Find the top-level mahadasha whose [startDate, endDate] window contains `now`. */
function findActiveDasha(dashas: DashaLike[], now: Date): DashaLike | null {
  const t = now.getTime();
  for (const d of dashas) {
    const start = Date.parse(d.startDate);
    const end = Date.parse(d.endDate);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (t >= start && t <= end) return d;
  }
  return null;
}
