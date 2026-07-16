/**
 * Palm metrics — deterministic hand-shape/finger classification from synthetic
 * landmark fixtures. These same fixtures are mirrored in the API suite
 * (apps/api/test/palm-metrics.util.spec.ts) to keep the client/server
 * implementations in lock-step.
 */
import { describe, it, expect } from 'vitest';
import { computePalmMetrics, LM, type FingerName } from '@/lib/palm/metrics';
import type { PalmLandmark } from '@/lib/palm/handLandmarker';

/**
 * Build a synthetic upright hand: wrist at bottom, knuckle row at palmLength
 * above it, straight vertical fingers. `aspect` = palmWidth/palmLength;
 * `middleRatio` = middle-finger length / palmLength.
 */
function syntheticHand(aspect: number, middleRatio: number): PalmLandmark[] {
  const L = 0.3; // palm length in normalized units
  const W = aspect * L;
  const wrist = { x: 0.5, y: 0.85, z: 0 };
  const rowY = wrist.y - L;
  const lm: PalmLandmark[] = new Array(21).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));

  lm[LM.WRIST] = wrist;
  lm[LM.INDEX_MCP] = { x: 0.5 - W / 2, y: rowY, z: 0 };
  lm[LM.MIDDLE_MCP] = { x: 0.5, y: rowY, z: 0 };
  lm[LM.RING_MCP] = { x: 0.5 + W / 6, y: rowY, z: 0 };
  lm[LM.PINKY_MCP] = { x: 0.5 + W / 2, y: rowY, z: 0 };

  // Straight vertical fingers: three equal segments above the MCP.
  const buildFinger = (mcpIdx: number, chain: number[], totalLen: number) => {
    const seg = totalLen / chain.length;
    let y = lm[mcpIdx].y;
    const x = lm[mcpIdx].x;
    for (const idx of chain) {
      y -= seg;
      lm[idx] = { x, y, z: 0 };
    }
  };
  const ratios: Record<FingerName, number> = {
    // Other fingers scale off the middle ratio with typical proportions.
    thumb: middleRatio * 0.8,
    index: middleRatio * 0.92,
    middle: middleRatio,
    ring: middleRatio * 0.92,
    little: middleRatio * 0.7,
  };
  buildFinger(LM.INDEX_MCP, [LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP], ratios.index * L);
  buildFinger(LM.MIDDLE_MCP, [LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP], ratios.middle * L);
  buildFinger(LM.RING_MCP, [LM.RING_PIP, LM.RING_DIP, LM.RING_TIP], ratios.ring * L);
  buildFinger(LM.PINKY_MCP, [LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP], ratios.little * L);
  // Thumb chain is MCP→IP→TIP (2 segments), CMC placed off to the side.
  lm[LM.THUMB_CMC] = { x: 0.5 - W * 0.7, y: wrist.y - L * 0.3, z: 0 };
  lm[LM.THUMB_MCP] = { x: 0.5 - W * 0.8, y: wrist.y - L * 0.5, z: 0 };
  const thumbLen = ratios.thumb * L;
  lm[LM.THUMB_IP] = { x: lm[LM.THUMB_MCP].x, y: lm[LM.THUMB_MCP].y - thumbLen / 2, z: 0 };
  lm[LM.THUMB_TIP] = { x: lm[LM.THUMB_MCP].x, y: lm[LM.THUMB_MCP].y - thumbLen, z: 0 };
  return lm;
}

describe('computePalmMetrics', () => {
  it('classifies a square palm + short fingers as Earth', () => {
    const m = computePalmMetrics(syntheticHand(0.95, 0.68));
    expect(m?.handShape).toBe('Earth');
  });

  it('classifies a square palm + long fingers as Air', () => {
    const m = computePalmMetrics(syntheticHand(0.95, 0.88));
    expect(m?.handShape).toBe('Air');
  });

  it('classifies a long palm + short fingers as Fire', () => {
    const m = computePalmMetrics(syntheticHand(0.72, 0.68));
    expect(m?.handShape).toBe('Fire');
  });

  it('classifies a long palm + long fingers as Water', () => {
    const m = computePalmMetrics(syntheticHand(0.72, 0.88));
    expect(m?.handShape).toBe('Water');
  });

  it('measures palm aspect and finger ratio close to the constructed values', () => {
    const m = computePalmMetrics(syntheticHand(0.9, 0.8))!;
    expect(m.palmAspect).toBeCloseTo(0.9, 1);
    expect(m.fingerRatio).toBeCloseTo(0.8, 1);
    // The knuckle row IS the palm width by construction.
    expect(m.palmWidth).toBeCloseTo(0.9 * 0.3, 2);
    expect(m.palmLength).toBeCloseTo(0.3, 2);
  });

  it('classifies finger lengths (middle long when clearly above typical)', () => {
    const long = computePalmMetrics(syntheticHand(0.9, 0.9))!;
    expect(long.fingerClasses.middle).toBe('long');
    const short = computePalmMetrics(syntheticHand(0.9, 0.62))!;
    expect(short.fingerClasses.middle).toBe('short');
    const avg = computePalmMetrics(syntheticHand(0.9, 0.78))!;
    expect(avg.fingerClasses.middle).toBe('average');
  });

  it('is deterministic (same landmarks → identical metrics)', () => {
    const hand = syntheticHand(0.85, 0.75);
    expect(computePalmMetrics(hand)).toEqual(computePalmMetrics(hand));
  });

  it('returns null for degenerate input', () => {
    expect(computePalmMetrics([])).toBeNull();
    expect(computePalmMetrics(new Array(21).fill({ x: 0.5, y: 0.5, z: 0 }))).toBeNull(); // zero-size palm
    const bad = syntheticHand(0.9, 0.8);
    bad[3] = { x: NaN, y: 0, z: 0 };
    expect(computePalmMetrics(bad)).toBeNull();
  });
});
