/**
 * Deterministic palm measurements from MediaPipe's 21 hand landmarks.
 *
 * These are REAL measurements of the user's hand — the grounding data for the
 * authenticity layer. The classical Earth/Air/Fire/Water hand shape is
 * *defined* by palm proportions × finger length, so it can be computed here
 * deterministically instead of trusted from the vision model.
 *
 * MIRROR: apps/api/src/modules/palmistry/palm-metrics.util.ts re-implements
 * these exact formulas server-side (the API's Docker build can't import from
 * packages/, so the logic is duplicated; both sides share fixture tests to
 * stay in lock-step). Change one → change both.
 */

import type { PalmLandmark } from './handLandmarker';

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
  /** Distance index-MCP → pinky-MCP (the knuckle row), in normalized units. */
  palmWidth: number;
  /** Distance wrist → middle-MCP, in normalized units. */
  palmLength: number;
  /** palmWidth / palmLength. ~1 → square palm, lower → long palm. */
  palmAspect: number;
  /** Middle-finger length (sum of segments) / palmLength. */
  fingerRatio: number;
  /** Per-finger length (sum of segments) relative to palmLength. */
  fingerRatios: Record<FingerName, number>;
  /** Deterministic Earth/Air/Fire/Water classification. */
  handShape: HandShapeType;
  /** Per-finger long/average/short vs typical proportions. */
  fingerClasses: Record<FingerName, FingerLengthClass>;
}

// Classification thresholds (documented so the classifier is auditable):
// a palm is "square" when the knuckle row is at least 88% of the palm length;
// fingers are "long" when the middle finger reaches 78% of the palm length.
export const SQUARE_PALM_ASPECT_MIN = 0.88;
export const LONG_FINGER_RATIO_MIN = 0.78;

// Typical middle-of-range finger:palm proportions (anthropometric averages);
// ±8% around these bounds classifies long/average/short.
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
