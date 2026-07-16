/**
 * Verification layer — makes a reading verifiable, unique and honest:
 *
 *  - `imageSha256`: content hash of the exact bytes analysed (uniqueness +
 *    duplicate detection).
 *  - `landmarkFingerprint`: quantized hash of the measured hand geometry — two
 *    different photos of the same palm produce nearby geometry, and it proves
 *    a real hand was measured (the canned fallback can never carry one).
 *  - `verificationId`: URL-safe id printed on the report (share-token pattern
 *    from match-share.service.ts).
 *  - Grounding: cross-checks the vision model's checkable claims against the
 *    deterministic measurements; mismatched claims are CORRECTED in the
 *    reading and recorded as failed checks. `groundednessScore` summarises
 *    how much of the reading is anchored to real, measured data.
 */

import { createHash, randomBytes } from 'crypto';
import type { HandLandmarkInput, PalmMetrics, FingerName } from './palm-metrics.util';
import type { PalmPolyline } from './palm-geometry.util';
import { majorLineCoverage } from './palm-geometry.util';

export interface VerificationCheck {
  code: string;
  expected: string; // deterministic measurement
  observed: string; // the model's claim
  pass: boolean;
}

export interface PalmVerification {
  verificationId: string;
  imageSha256: string | null;
  landmarkFingerprint: string | null;
  groundednessScore: number; // 0–1
  checks: VerificationCheck[];
  authentic: boolean;
  authenticReason?: 'no_image';
  duplicateOf?: { readingId: string; createdAt: string };
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function newVerificationId(): string {
  return randomBytes(18).toString('base64url');
}

/**
 * Quantized landmark hash: rounds each coordinate to a 64-cell grid (reducing —
 * not eliminating — detection-jitter sensitivity; values at a cell boundary can
 * still flip), then hashes the sequence with the handedness. Two photos of the
 * SAME palm land nearby; a fingerprint proves a real hand was measured.
 */
export function landmarkFingerprint(input: HandLandmarkInput | null): string | null {
  if (!input) return null;
  const quantized = input.landmarks
    .map((p) => `${Math.round(p.x * 64)},${Math.round(p.y * 64)}`)
    .join(';');
  return createHash('sha256').update(`${input.handedness}|${quantized}`).digest('hex').slice(0, 32);
}

interface AnalysisForGrounding {
  handShape?: { type?: string; description?: string };
  handOverview?: { handType?: string };
  fingerAnalysis?: Array<{ finger?: string; length?: string; interpretation?: string }>;
}

const FINGER_LABEL_TO_NAME: Array<[RegExp, FingerName]> = [
  [/thumb/i, 'thumb'],
  [/index|jupiter/i, 'index'],
  [/middle|saturn/i, 'middle'],
  [/ring|apollo/i, 'ring'],
  [/little|pinky|mercury/i, 'little'],
];

export interface GroundingResult {
  checks: VerificationCheck[];
  groundednessScore: number;
  /** Number of claims corrected in-place to match measurements. */
  corrections: number;
}

/**
 * Cross-check the model's measurable claims against deterministic metrics and
 * CORRECT the reading where they disagree (measurements win — they're real).
 * Mutates `analysis` in place; returns the audit trail.
 */
export function groundAnalysis(
  analysis: AnalysisForGrounding,
  metrics: PalmMetrics | null,
  polylines: PalmPolyline[],
): GroundingResult {
  const checks: VerificationCheck[] = [];
  let corrections = 0;

  if (metrics) {
    // Hand shape: definitionally palm-aspect × finger-ratio — computable.
    const claimed = String(analysis.handShape?.type ?? '').trim();
    if (claimed) {
      const pass = claimed.toLowerCase() === metrics.handShape.toLowerCase();
      checks.push({
        code: 'handShape.type',
        expected: metrics.handShape,
        observed: claimed,
        pass,
      });
      if (!pass && analysis.handShape) {
        analysis.handShape.type = metrics.handShape;
        analysis.handShape.description =
          `${metrics.handShape} hand (measured from your palm's proportions). ` +
          (analysis.handShape.description ?? '');
        if (analysis.handOverview?.handType) {
          analysis.handOverview.handType = metrics.handShape;
        }
        corrections++;
      }
    }

    // Finger length claims vs measured ratios.
    for (const fa of analysis.fingerAnalysis ?? []) {
      const label = String(fa?.finger ?? '');
      const match = FINGER_LABEL_TO_NAME.find(([re]) => re.test(label));
      const claimedLen = String(fa?.length ?? '');
      if (!match || !claimedLen) continue;
      const measured = metrics.fingerClasses[match[1]];
      const pass = claimedLen === measured;
      checks.push({
        code: `finger.${match[1]}.length`,
        expected: measured,
        observed: claimedLen,
        pass,
      });
      if (!pass) {
        fa.length = measured;
        corrections++;
      }
    }
  }

  // Groundedness: fraction of checkable claims that matched the measurements,
  // blended with how much of the classic line set was actually traced in the
  // image. No metrics and no geometry → 0 (nothing anchors the reading).
  const checkScore = checks.length
    ? checks.filter((c) => c.pass).length / checks.length
    : metrics ? 1 : 0;
  const coverage = majorLineCoverage(polylines);
  const groundednessScore = round2(
    metrics || polylines.length ? 0.6 * checkScore + 0.4 * coverage : 0,
  );

  return { checks, groundednessScore, corrections };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
