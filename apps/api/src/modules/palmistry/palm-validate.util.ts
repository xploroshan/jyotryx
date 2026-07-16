/**
 * Structural validation of the vision model's palmistry reading.
 *
 * Previously, ANY vision output that survived JSON.parse was persisted, and
 * any failure silently fell back to a canned reading identical for every user
 * (the "Same results for everyone" hole). Under the honesty contract, invalid
 * output counts as a FAILED analysis — the caller retries once and then fails
 * the reading with a refund; it never masquerades as a real reading.
 */

const MAJOR_LINES = ['heart line', 'head line', 'life line', 'fate line', 'sun line'];
const LINE_STRENGTHS = new Set(['strong', 'moderate', 'weak']);
const MOUNT_PROMINENCES = new Set(['elevated', 'normal', 'flat']);
const FINGER_LENGTHS = new Set(['long', 'average', 'short']);

export interface AnalysisValidation {
  ok: boolean;
  /** Machine-readable reasons for every failed requirement (empty when ok). */
  problems: string[];
}

/**
 * Validate the parsed reading against the contract the prompt demands.
 * Deliberately tolerant of extra fields — strict only about what the UI and
 * the grounding checks actually rely on.
 */
export function validatePalmistryAnalysis(data: unknown): AnalysisValidation {
  const problems: string[] = [];
  const d = data as Record<string, unknown> | null;
  if (!d || typeof d !== 'object') {
    return { ok: false, problems: ['not_an_object'] };
  }

  // Lines: array, ≥5 entries, all majors present, valid strengths, non-empty interpretations.
  const lines = d.lines;
  if (!Array.isArray(lines) || lines.length < 5) {
    problems.push('lines_missing_or_short');
  } else {
    const names = lines.map((l) => String((l as { name?: unknown })?.name ?? '').toLowerCase());
    for (const major of MAJOR_LINES) {
      if (!names.some((n) => n.includes(major))) problems.push(`missing_${major.replace(/\s+/g, '_')}`);
    }
    for (const l of lines) {
      const line = l as { strength?: unknown; interpretation?: unknown; name?: unknown };
      if (!LINE_STRENGTHS.has(String(line?.strength))) {
        problems.push('invalid_line_strength');
        break;
      }
      if (typeof line?.interpretation !== 'string' || line.interpretation.trim().length < 10) {
        problems.push('empty_line_interpretation');
        break;
      }
    }
  }

  // Mounts: ≥3, valid prominences.
  const mounts = d.mounts;
  if (!Array.isArray(mounts) || mounts.length < 3) {
    problems.push('mounts_missing_or_short');
  } else if (mounts.some((m) => !MOUNT_PROMINENCES.has(String((m as { prominence?: unknown })?.prominence)))) {
    problems.push('invalid_mount_prominence');
  }

  // Fingers: ≥3, valid length classes.
  const fingers = d.fingerAnalysis;
  if (!Array.isArray(fingers) || fingers.length < 3) {
    problems.push('fingers_missing_or_short');
  } else if (fingers.some((f) => !FINGER_LENGTHS.has(String((f as { length?: unknown })?.length)))) {
    problems.push('invalid_finger_length');
  }

  // Narrative sections the UI renders directly.
  for (const key of ['overallReading', 'healthInsights', 'careerInsights', 'relationshipInsights'] as const) {
    const v = d[key];
    if (typeof v !== 'string' || v.trim().length < 30) problems.push(`weak_${key}`);
  }

  return { ok: problems.length === 0, problems };
}
