/**
 * Deterministic palm measurements from MediaPipe's 21 hand landmarks —
 * the server-side trusted recompute powering the authenticity layer.
 *
 * MIRROR: apps/web/src/lib/palm/metrics.ts implements the same formulas
 * client-side (the API's Docker build can't import from packages/, so the
 * logic is duplicated; both suites share the same synthetic fixtures to stay
 * in lock-step). Change one → change both.
 *
 * The client sends raw landmarks (untrusted): parseHandLandmarks() validates
 * shape and ranges before anything downstream consumes them.
 */

export interface PalmLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandLandmarkInput {
  landmarks: PalmLandmark[]; // 21 points, MediaPipe topology
  handedness: 'Left' | 'Right';
  score: number;
}

// MediaPipe hand topology indices.
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
} as const;

export type HandShapeType = 'Earth' | 'Air' | 'Fire' | 'Water';
export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'little';
export type FingerLengthClass = 'long' | 'average' | 'short';

export interface PalmMetrics {
  palmWidth: number;
  palmLength: number;
  palmAspect: number;
  fingerRatio: number;
  fingerRatios: Record<FingerName, number>;
  handShape: HandShapeType;
  fingerClasses: Record<FingerName, FingerLengthClass>;
}

export const SQUARE_PALM_ASPECT_MIN = 0.88;
export const LONG_FINGER_RATIO_MIN = 0.78;

const FINGER_TYPICAL: Record<FingerName, number> = {
  thumb: 0.62,
  index: 0.72,
  middle: 0.78,
  ring: 0.72,
  little: 0.55,
};
const FINGER_CLASS_TOLERANCE = 0.08;

const FINGER_SEGMENTS: Record<FingerName, number[]> = {
  thumb: [LM.THUMB_MCP, LM.THUMB_IP, LM.THUMB_TIP],
  index: [LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP],
  middle: [LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP],
  ring: [LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP],
  little: [LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP],
};

function dist(a: PalmLandmark, b: PalmLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function chainLength(landmarks: PalmLandmark[], chain: number[]): number {
  let total = 0;
  for (let i = 1; i < chain.length; i++) total += dist(landmarks[chain[i - 1]], landmarks[chain[i]]);
  return total;
}

/**
 * Parse + validate the client-supplied landmark payload (JSON string or
 * object). Returns null on ANY invalid input — landmarks are an enhancement,
 * never a hard requirement, and garbage must not reach the math or the DB.
 */
export function parseHandLandmarks(raw: unknown): HandLandmarkInput | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    if (raw.length > 20_000) return null; // 21 points is ~2KB; anything huge is hostile
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const v = value as { landmarks?: unknown; handedness?: unknown; score?: unknown };
  if (!Array.isArray(v.landmarks) || v.landmarks.length !== 21) return null;
  const landmarks: PalmLandmark[] = [];
  for (const p of v.landmarks) {
    const q = p as { x?: unknown; y?: unknown; z?: unknown };
    const x = Number(q?.x);
    const y = Number(q?.y);
    const z = Number(q?.z ?? 0);
    // Normalized image coordinates with tolerance for slight out-of-frame points.
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    if (x < -0.5 || x > 1.5 || y < -0.5 || y > 1.5) return null;
    landmarks.push({ x, y, z });
  }
  const handedness = v.handedness === 'Left' ? 'Left' : v.handedness === 'Right' ? 'Right' : null;
  if (!handedness) return null;
  const score = Number(v.score);
  if (!Number.isFinite(score) || score < 0 || score > 1) return null;
  return { landmarks, handedness, score };
}

/** Compute all palm metrics. Returns null for degenerate geometry. */
export function computePalmMetrics(landmarks: PalmLandmark[]): PalmMetrics | null {
  if (!Array.isArray(landmarks) || landmarks.length !== 21) return null;
  if (landmarks.some((p) => !Number.isFinite(p?.x) || !Number.isFinite(p?.y))) return null;

  const palmWidth = dist(landmarks[LM.INDEX_MCP], landmarks[LM.PINKY_MCP]);
  const palmLength = dist(landmarks[LM.WRIST], landmarks[LM.MIDDLE_MCP]);
  if (palmWidth <= 1e-6 || palmLength <= 1e-6) return null;

  const fingerRatios = Object.fromEntries(
    (Object.keys(FINGER_SEGMENTS) as FingerName[]).map((f) => [
      f,
      chainLength(landmarks, FINGER_SEGMENTS[f]) / palmLength,
    ]),
  ) as Record<FingerName, number>;

  const palmAspect = palmWidth / palmLength;
  const fingerRatio = fingerRatios.middle;

  const squarePalm = palmAspect >= SQUARE_PALM_ASPECT_MIN;
  const longFingers = fingerRatio >= LONG_FINGER_RATIO_MIN;
  const handShape: HandShapeType = squarePalm
    ? longFingers ? 'Air' : 'Earth'
    : longFingers ? 'Water' : 'Fire';

  const fingerClasses = Object.fromEntries(
    (Object.keys(fingerRatios) as FingerName[]).map((f) => {
      const delta = fingerRatios[f] - FINGER_TYPICAL[f];
      const cls: FingerLengthClass =
        delta > FINGER_CLASS_TOLERANCE ? 'long' : delta < -FINGER_CLASS_TOLERANCE ? 'short' : 'average';
      return [f, cls];
    }),
  ) as Record<FingerName, FingerLengthClass>;

  return {
    palmWidth: round4(palmWidth),
    palmLength: round4(palmLength),
    palmAspect: round4(palmAspect),
    fingerRatio: round4(fingerRatio),
    fingerRatios: mapValues(fingerRatios, round4),
    handShape,
    fingerClasses,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function mapValues<K extends string, V, W>(obj: Record<K, V>, fn: (v: V) => W): Record<K, W> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v as V)])) as Record<K, W>;
}
