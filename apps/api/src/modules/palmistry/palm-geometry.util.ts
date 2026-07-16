/**
 * Palm-crease geometry extraction — prompt + validation for the dedicated
 * vision call that traces the palm lines as coordinates.
 *
 * MediaPipe landmarks give the hand's skeleton but NOT the creases; this
 * second, focused structured-output call asks the vision model to trace each
 * visible line as a polyline in normalized image coordinates, anchored to the
 * landmark frame we already measured (the anchors are literal positions in
 * the same coordinate system, which measurably improves spatial grounding).
 *
 * Everything returned by the model is treated as untrusted and hard-validated:
 * out-of-range points, undersized/oversized polylines and unknown kinds are
 * dropped. A failed/empty geometry NEVER blocks the reading — the client just
 * renders the classic diagram instead of the personalized wireframe.
 */

import type { HandLandmarkInput } from './palm-metrics.util';
import { LM } from './palm-metrics.util';

export interface PalmPolyline {
  /** Canonical line name, e.g. "Heart Line", "Girdle of Venus". */
  name: string;
  kind: 'major' | 'minor' | 'sub';
  /** Normalized [x,y] image coordinates, 0–1, ≥4 and ≤24 points. */
  points: [number, number][];
  /** Model's own confidence in the trace, 0–1. */
  confidence: number;
}

export const MAJOR_LINE_NAMES = ['Heart Line', 'Head Line', 'Life Line', 'Fate Line', 'Sun Line'] as const;

const MIN_POINTS = 4;
const MAX_POINTS = 24;
const MAX_POLYLINES = 14;

export function buildGeometrySystemPrompt(): string {
  return `You are a precise computer-vision annotator specialised in palmistry. Your ONLY job is to trace the visible palm creases in the image as polylines in NORMALIZED image coordinates (x and y between 0 and 1, where (0,0) is the top-left corner and (1,1) the bottom-right corner of the FULL image).

Return STRICT JSON:
{
  "polylines": [
    { "name": "Heart Line", "kind": "major", "points": [[x,y],[x,y],...], "confidence": 0.0-1.0 }
  ]
}

Rules:
- Trace each line with 6-16 points ordered along the crease, following its actual curvature in THIS image.
- "kind": "major" for Heart/Head/Life/Fate/Sun lines; "minor" for other named lines (Mercury/Health Line, Marriage Line(s), Girdle of Venus, Bracelets, Travel Lines, Intuition Line); "sub" for small branches or secondary creases splitting off a line.
- Include every major line you can see. If a major line is genuinely not visible, omit it — do NOT invent geometry.
- Points MUST lie on the palm in the image. Accuracy beats completeness: a shorter, correct trace is better than a longer guess.
- Do not include any prose, only the JSON object.`;
}

export function buildGeometryUserPrompt(landmarkData: HandLandmarkInput | null): string {
  let anchors = '';
  if (landmarkData) {
    const lm = landmarkData.landmarks;
    const f = (i: number) => `(${lm[i].x.toFixed(3)}, ${lm[i].y.toFixed(3)})`;
    anchors = `\n\nCalibration anchors — these hand landmarks were measured in the SAME normalized coordinate system, use them to locate the palm precisely:
- wrist: ${f(LM.WRIST)}
- index-finger base knuckle: ${f(LM.INDEX_MCP)}
- middle-finger base knuckle: ${f(LM.MIDDLE_MCP)}
- ring-finger base knuckle: ${f(LM.RING_MCP)}
- little-finger base knuckle: ${f(LM.PINKY_MCP)}
- thumb base: ${f(LM.THUMB_CMC)}
The palm surface lies between the wrist and the knuckle row. The Heart Line runs below the knuckle row; the Head Line below it; the Life Line arcs around the thumb base.`;
  }
  return `Trace the palm creases in this image as specified.${anchors}`;
}

/**
 * Validate + sanitize the model's geometry JSON. Returns only well-formed
 * polylines (possibly empty). Never throws.
 */
export function validatePolylines(raw: unknown): PalmPolyline[] {
  const out: PalmPolyline[] = [];
  const root = (raw && typeof raw === 'object' ? (raw as { polylines?: unknown }).polylines : null);
  if (!Array.isArray(root)) return out;
  const seen = new Set<string>();
  for (const item of root) {
    if (out.length >= MAX_POLYLINES) break;
    const p = item as { name?: unknown; kind?: unknown; points?: unknown; confidence?: unknown };
    const name = typeof p?.name === 'string' ? p.name.trim().slice(0, 60) : '';
    if (!name) continue;
    const kind = p?.kind === 'major' || p?.kind === 'minor' || p?.kind === 'sub' ? p.kind : null;
    if (!kind) continue;
    if (!Array.isArray(p.points) || p.points.length < MIN_POINTS) continue;
    const points: [number, number][] = [];
    let valid = true;
    for (const pt of p.points.slice(0, MAX_POINTS)) {
      const x = Number(Array.isArray(pt) ? pt[0] : NaN);
      const y = Number(Array.isArray(pt) ? pt[1] : NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        valid = false;
        break;
      }
      points.push([round4(x), round4(y)]);
    }
    if (!valid || points.length < MIN_POINTS) continue;
    // A "line" whose bounding box is a dot is a hallucination artifact.
    const xs = points.map((q) => q[0]);
    const ys = points.map((q) => q[1]);
    if (Math.max(...xs) - Math.min(...xs) < 0.02 && Math.max(...ys) - Math.min(...ys) < 0.02) continue;
    const confidence = clamp01(Number(p.confidence));
    // Dedupe by name+kind (models occasionally repeat a line).
    const key = `${name.toLowerCase()}|${kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, kind, points, confidence });
  }
  return out;
}

/** Fraction of the five classical major lines present in the geometry (0–1). */
export function majorLineCoverage(polylines: PalmPolyline[]): number {
  const present = new Set(
    polylines.filter((p) => p.kind === 'major').map((p) => p.name.toLowerCase()),
  );
  const hits = MAJOR_LINE_NAMES.filter((n) => present.has(n.toLowerCase())).length;
  return hits / MAJOR_LINE_NAMES.length;
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, round4(n))) : 0;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
