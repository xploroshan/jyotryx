/**
 * Palmistry authenticity layer — geometry validation, reading validation,
 * transparency factors, and verification/grounding. All pure functions.
 */
import {
  validatePolylines,
  majorLineCoverage,
  buildGeometryUserPrompt,
} from '../src/modules/palmistry/palm-geometry.util';
import { validatePalmistryAnalysis } from '../src/modules/palmistry/palm-validate.util';
import { buildPalmFactors } from '../src/modules/palmistry/palm-factors.util';
import {
  sha256Hex,
  newVerificationId,
  landmarkFingerprint,
  groundAnalysis,
} from '../src/modules/palmistry/palm-verification.util';
import { computePalmMetrics, LM, type PalmLandmark } from '../src/modules/palmistry/palm-metrics.util';
import { validPalmReadingJson } from './helpers/mocks';

const goodPolyline = {
  name: 'Heart Line',
  kind: 'major',
  points: [[0.2, 0.4], [0.4, 0.38], [0.6, 0.4], [0.8, 0.45]],
  confidence: 0.9,
};

describe('validatePolylines', () => {
  it('accepts well-formed polylines and normalizes values', () => {
    const out = validatePolylines({ polylines: [goodPolyline] });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Heart Line');
    expect(out[0].points.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1)).toBe(true);
  });

  it('drops out-of-range points, short lines, bad kinds and dot-sized lines', () => {
    expect(validatePolylines({ polylines: [{ ...goodPolyline, points: [[0.2, 0.4], [1.4, 0.5], [0.5, 0.5], [0.6, 0.6]] }] })).toHaveLength(0);
    expect(validatePolylines({ polylines: [{ ...goodPolyline, points: [[0.2, 0.4], [0.3, 0.4]] }] })).toHaveLength(0);
    expect(validatePolylines({ polylines: [{ ...goodPolyline, kind: 'imaginary' }] })).toHaveLength(0);
    // A "line" collapsed into a dot is a hallucination artifact.
    expect(
      validatePolylines({ polylines: [{ ...goodPolyline, points: [[0.5, 0.5], [0.505, 0.5], [0.5, 0.505], [0.505, 0.505]] }] }),
    ).toHaveLength(0);
  });

  it('dedupes repeated lines and never throws on garbage', () => {
    expect(validatePolylines({ polylines: [goodPolyline, goodPolyline] })).toHaveLength(1);
    expect(validatePolylines(null)).toEqual([]);
    expect(validatePolylines('garbage')).toEqual([]);
    expect(validatePolylines({ polylines: 'nope' })).toEqual([]);
  });

  it('computes major-line coverage', () => {
    const lines = validatePolylines({
      polylines: [
        goodPolyline,
        { ...goodPolyline, name: 'Head Line' },
        { ...goodPolyline, name: 'Life Line' },
      ],
    });
    expect(majorLineCoverage(lines)).toBeCloseTo(3 / 5);
    expect(majorLineCoverage([])).toBe(0);
  });
});

describe('buildGeometryUserPrompt', () => {
  it('embeds landmark anchors when available', () => {
    const lm: PalmLandmark[] = new Array(21).fill(null).map((_, i) => ({ x: i / 21, y: 0.5, z: 0 }));
    const prompt = buildGeometryUserPrompt({ landmarks: lm, handedness: 'Right', score: 0.9 });
    expect(prompt).toContain('Calibration anchors');
    expect(prompt).toContain('wrist');
  });
  it('works without landmarks', () => {
    expect(buildGeometryUserPrompt(null)).not.toContain('Calibration anchors');
  });
});

describe('validatePalmistryAnalysis', () => {
  it('requires the imageCheck verdict (readings without it never passed the palm-vs-back gate)', () => {
    const noCheck: any = validPalmReadingJson();
    delete noCheck.imageCheck;
    const v = validatePalmistryAnalysis(noCheck);
    expect(v.ok).toBe(false);
    expect(v.problems).toContain('missing_image_check');
  });

  it('accepts all known imageCheck subjects (gating happens in the pipeline, not here)', () => {
    for (const subject of ['palm', 'back_of_hand', 'not_a_hand', 'unclear']) {
      const d: any = validPalmReadingJson();
      d.imageCheck = { subject };
      expect(validatePalmistryAnalysis(d).problems).not.toContain('missing_image_check');
    }
  });

  it('accepts a complete reading', () => {
    expect(validatePalmistryAnalysis(validPalmReadingJson()).ok).toBe(true);
  });

  it('rejects a reading missing a major line', () => {
    const bad = validPalmReadingJson();
    // Swap the Fate Line for a minor line so the count stays ≥5 and the
    // major-presence rule (not the length rule) is what fires.
    bad.lines = bad.lines.map((l: any) =>
      l.name === 'Fate Line' ? { ...l, name: 'Mercury Line' } : l,
    );
    const v = validatePalmistryAnalysis(bad);
    expect(v.ok).toBe(false);
    expect(v.problems).toContain('missing_fate_line');
  });

  it('rejects a reading with too few lines', () => {
    const bad = validPalmReadingJson();
    bad.lines = bad.lines.slice(0, 3);
    const v = validatePalmistryAnalysis(bad);
    expect(v.ok).toBe(false);
    expect(v.problems).toContain('lines_missing_or_short');
  });

  it('rejects invalid enums and hollow narratives', () => {
    const badStrength = validPalmReadingJson();
    (badStrength.lines[0] as any).strength = 'super';
    expect(validatePalmistryAnalysis(badStrength).ok).toBe(false);

    const hollow = validPalmReadingJson();
    hollow.overallReading = 'ok';
    expect(validatePalmistryAnalysis(hollow).problems).toContain('weak_overallReading');
  });

  it('rejects non-objects', () => {
    expect(validatePalmistryAnalysis(null).ok).toBe(false);
    expect(validatePalmistryAnalysis('text').ok).toBe(false);
  });
});

describe('buildPalmFactors', () => {
  it('derives factors from the reading and measured metrics', () => {
    const metrics = computePalmMetrics(syntheticHand())!;
    const factors = buildPalmFactors(validPalmReadingJson() as any, metrics);

    // Measurement factors are present and marked as such.
    const measured = factors.filter((f) => f.source === 'measurement');
    expect(measured.length).toBeGreaterThan(0);
    expect(measured[0].code).toMatch(/^measurement\.handShape\./);

    // Line factors carry sentiment from strength.
    const heart = factors.find((f) => f.code === 'line.heart_line.strong');
    expect(heart?.contribution).toBe('positive');
    // Elevated mount → positive, valid stable codes throughout.
    expect(factors.find((f) => f.code === 'mount.mount_of_jupiter.elevated')?.contribution).toBe('positive');
    expect(factors.every((f) => /^[a-z0-9_.]+$/i.test(f.code))).toBe(true);
  });

  it('works without metrics (no measurement factors, no crash)', () => {
    const factors = buildPalmFactors(validPalmReadingJson() as any, null);
    expect(factors.some((f) => f.source === 'measurement')).toBe(false);
    expect(factors.some((f) => f.source === 'line')).toBe(true);
  });
});

describe('verification primitives', () => {
  it('sha256Hex is stable and hex-shaped', () => {
    const a = sha256Hex(Buffer.from('same-bytes'));
    expect(a).toBe(sha256Hex(Buffer.from('same-bytes')));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(sha256Hex(Buffer.from('different')));
  });

  it('verification ids are URL-safe and unique', () => {
    const id = newVerificationId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(newVerificationId()).not.toBe(id);
  });

  it('landmark fingerprints are deterministic and differ across clearly different hands', () => {
    // Quantization REDUCES jitter sensitivity but cannot guarantee stability at
    // cell boundaries — so the hard guarantees are determinism + distinctness.
    const hand = syntheticHand();
    const base = landmarkFingerprint({ landmarks: hand, handedness: 'Right', score: 0.9 });
    expect(landmarkFingerprint({ landmarks: hand, handedness: 'Right', score: 0.9 })).toBe(base);
    const other = hand.map((p) => ({ ...p, x: Math.min(1, p.x + 0.2) }));
    expect(landmarkFingerprint({ landmarks: other, handedness: 'Right', score: 0.9 })).not.toBe(base);
    // Handedness is part of the identity.
    expect(landmarkFingerprint({ landmarks: hand, handedness: 'Left', score: 0.9 })).not.toBe(base);
    expect(landmarkFingerprint(null)).toBeNull();
  });
});

describe('groundAnalysis', () => {
  it('corrects a wrong hand-shape claim and records the failed check', () => {
    const metrics = computePalmMetrics(syntheticHand(0.72, 0.68))!; // Fire by construction
    const analysis: any = {
      handShape: { type: 'Air', description: 'claimed' },
      handOverview: { handType: 'Air' },
      fingerAnalysis: [],
    };
    const res = groundAnalysis(analysis, metrics, []);
    expect(analysis.handShape.type).toBe('Fire');
    expect(analysis.handOverview.handType).toBe('Fire');
    expect(res.corrections).toBeGreaterThan(0);
    expect(res.checks.find((c) => c.code === 'handShape.type')?.pass).toBe(false);
  });

  it('passes checks and applies no corrections when the model agrees with measurements', () => {
    const metrics = computePalmMetrics(syntheticHand(0.95, 0.88))!; // Air
    const analysis: any = { handShape: { type: 'Air', description: 'ok' }, fingerAnalysis: [] };
    const res = groundAnalysis(analysis, metrics, []);
    expect(res.corrections).toBe(0);
    expect(res.checks.every((c) => c.pass)).toBe(true);
    expect(res.groundednessScore).toBeGreaterThan(0);
  });

  it('scores 0 with no metrics and no geometry (nothing anchors the reading)', () => {
    const res = groundAnalysis({ fingerAnalysis: [] }, null, []);
    expect(res.groundednessScore).toBe(0);
  });
});

/** Same synthetic-hand builder as palm-metrics.util.spec.ts (kept local). */
function syntheticHand(aspect = 0.9, middleRatio = 0.8): PalmLandmark[] {
  const L = 0.3;
  const W = aspect * L;
  const wrist = { x: 0.5, y: 0.85, z: 0 };
  const rowY = wrist.y - L;
  const lm: PalmLandmark[] = new Array(21).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
  lm[LM.WRIST] = wrist;
  lm[LM.INDEX_MCP] = { x: 0.5 - W / 2, y: rowY, z: 0 };
  lm[LM.MIDDLE_MCP] = { x: 0.5, y: rowY, z: 0 };
  lm[LM.RING_MCP] = { x: 0.5 + W / 6, y: rowY, z: 0 };
  lm[LM.PINKY_MCP] = { x: 0.5 + W / 2, y: rowY, z: 0 };
  const buildFinger = (mcpIdx: number, chain: number[], totalLen: number) => {
    const seg = totalLen / chain.length;
    let y = lm[mcpIdx].y;
    const x = lm[mcpIdx].x;
    for (const idx of chain) {
      y -= seg;
      lm[idx] = { x, y, z: 0 };
    }
  };
  buildFinger(LM.INDEX_MCP, [LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP], middleRatio * 0.92 * L);
  buildFinger(LM.MIDDLE_MCP, [LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP], middleRatio * L);
  buildFinger(LM.RING_MCP, [LM.RING_PIP, LM.RING_DIP, LM.RING_TIP], middleRatio * 0.92 * L);
  buildFinger(LM.PINKY_MCP, [LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP], middleRatio * 0.7 * L);
  lm[LM.THUMB_CMC] = { x: 0.5 - W * 0.7, y: wrist.y - L * 0.3, z: 0 };
  lm[LM.THUMB_MCP] = { x: 0.5 - W * 0.8, y: wrist.y - L * 0.5, z: 0 };
  const thumbLen = middleRatio * 0.8 * L;
  lm[LM.THUMB_IP] = { x: lm[LM.THUMB_MCP].x, y: lm[LM.THUMB_MCP].y - thumbLen / 2, z: 0 };
  lm[LM.THUMB_TIP] = { x: lm[LM.THUMB_MCP].x, y: lm[LM.THUMB_MCP].y - thumbLen, z: 0 };
  return lm;
}
