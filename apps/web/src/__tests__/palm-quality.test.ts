/**
 * Guided-scan quality gates — pure functions over synthetic ImageData/landmarks.
 */
import { describe, it, expect } from 'vitest';
import {
  measureFrameQuality,
  evaluateHandPose,
  landmarkMovement,
  LUMA_MIN,
} from '@/lib/palm/quality';

function solidFrame(w: number, h: number, v: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = v;
    data[o + 3] = 255;
  }
  return data;
}

function texturedFrame(w: number, h: number, base: number): Uint8ClampedArray {
  // Checkerboard = strong Laplacian response (sharp).
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = (x + y) % 2 === 0 ? base + 60 : base - 60;
      const o = (y * w + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = Math.max(0, Math.min(255, v));
      data[o + 3] = 255;
    }
  }
  return data;
}

describe('measureFrameQuality', () => {
  it('rejects a too-dark frame and accepts a lit, textured one', () => {
    const dark = measureFrameQuality(solidFrame(32, 32, 20), 32, 32);
    expect(dark.brightnessOk).toBe(false);
    expect(dark.meanLuma).toBeLessThan(LUMA_MIN);

    const good = measureFrameQuality(texturedFrame(32, 32, 128), 32, 32);
    expect(good.brightnessOk).toBe(true);
    expect(good.sharpnessOk).toBe(true);
  });

  it('rejects blown-out highlights and flat (blurry) frames', () => {
    const blown = measureFrameQuality(solidFrame(32, 32, 250), 32, 32);
    expect(blown.brightnessOk).toBe(false); // clipped highlights

    const flat = measureFrameQuality(solidFrame(32, 32, 128), 32, 32);
    expect(flat.sharpnessOk).toBe(false); // zero texture = no focus signal
    expect(flat.brightnessOk).toBe(true);
  });
});

// A synthetic upright RIGHT hand seen palm-on: index MCP left of pinky MCP.
function palmOnRightHand(scale = 0.6): { x: number; y: number }[] {
  const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  const top = 0.5 - scale / 2;
  const bottom = 0.5 + scale / 2;
  lm[0] = { x: 0.5, y: bottom }; // wrist
  lm[5] = { x: 0.35, y: top + 0.1 }; // index MCP (left in image for right palm)
  lm[9] = { x: 0.45, y: top + 0.08 };
  lm[13] = { x: 0.55, y: top + 0.09 };
  lm[17] = { x: 0.65, y: top + 0.12 }; // pinky MCP
  // Fingertips above the knuckles.
  lm[8] = { x: 0.34, y: top };
  lm[12] = { x: 0.45, y: top - 0.02 + 0.02 };
  lm[16] = { x: 0.55, y: top };
  lm[20] = { x: 0.66, y: top + 0.03 };
  return lm;
}

describe('evaluateHandPose', () => {
  it('passes a well-framed right palm when the right hand is expected', () => {
    const gates = evaluateHandPose(palmOnRightHand(0.7), {
      expectedHand: 'Right',
      detectedHand: 'Right',
      mirrored: false,
    });
    expect(gates.handPresent).toBe(true);
    expect(gates.correctHand).toBe(true);
    expect(gates.palmFacing).toBe(true);
    expect(gates.coverageOk).toBe(true);
  });

  it('flags the wrong hand (and corrects for mirrored selfie preview)', () => {
    // Detected Left in a non-mirrored view = physically Left → wrong.
    expect(
      evaluateHandPose(palmOnRightHand(0.7), {
        expectedHand: 'Right',
        detectedHand: 'Left',
        mirrored: false,
      }).correctHand,
    ).toBe(false);
    // Detected Left in a MIRRORED view = physically Right → correct.
    expect(
      evaluateHandPose(palmOnRightHand(0.7), {
        expectedHand: 'Right',
        detectedHand: 'Left',
        mirrored: true,
      }).correctHand,
    ).toBe(true);
  });

  it('fails coverage when the hand is too small in frame', () => {
    const gates = evaluateHandPose(palmOnRightHand(0.3), {
      expectedHand: null,
      detectedHand: 'Right',
      mirrored: false,
    });
    expect(gates.coverageOk).toBe(false);
  });

  it('detects the back of the hand (palm not facing)', () => {
    // Mirror the x-coordinates: for a detected RIGHT hand, index now sits to
    // the RIGHT of pinky — the camera sees the back of the hand.
    const back = palmOnRightHand(0.7).map((p) => ({ x: 1 - p.x, y: p.y }));
    const gates = evaluateHandPose(back, {
      expectedHand: 'Right',
      detectedHand: 'Right',
      mirrored: false,
    });
    expect(gates.palmFacing).toBe(false);
  });

  it('reports no hand for null/partial landmarks', () => {
    expect(evaluateHandPose(null, { expectedHand: null, detectedHand: null, mirrored: false }).handPresent).toBe(false);
    expect(
      evaluateHandPose(palmOnRightHand().slice(0, 10), { expectedHand: null, detectedHand: 'Right', mirrored: false })
        .handPresent,
    ).toBe(false);
  });
});

describe('landmarkMovement', () => {
  it('is ~0 for identical frames and grows with motion', () => {
    const a = palmOnRightHand();
    expect(landmarkMovement(a, a)).toBe(0);
    const moved = a.map((p) => ({ x: p.x + 0.05, y: p.y }));
    expect(landmarkMovement(a, moved)).toBeCloseTo(0.05, 3);
    expect(landmarkMovement(null, a)).toBe(Number.POSITIVE_INFINITY);
  });
});
