/**
 * Pure wireframe geometry — Catmull-Rom smoothing + Sobel edge-snapping.
 */
import { describe, it, expect } from 'vitest';
import {
  smoothPath,
  toGrayscale,
  sobelMagnitude,
  snapPointsToEdges,
  type Point,
} from '@/lib/palm/wireframePath';

describe('smoothPath', () => {
  it('builds an M + C path through all points', () => {
    const d = smoothPath([[0, 0], [10, 10], [20, 5], [30, 15]]);
    expect(d.startsWith('M 0,0')).toBe(true);
    expect(d.match(/C /g)?.length).toBe(3); // one cubic per segment
    expect(d).toContain('30,15'); // ends at the last point
  });

  it('handles degenerate inputs without throwing', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([[5, 5]])).toBe('M 5,5');
    expect(smoothPath([[0, 0], [10, 0]])).toContain('C');
  });

  it('is deterministic', () => {
    const pts: Point[] = [[1, 2], [3, 4], [5, 2]];
    expect(smoothPath(pts)).toBe(smoothPath(pts));
  });
});

describe('edge detection + snapping', () => {
  // A 96x96 image (≥ MIN_SNAP_IMAGE_PX), black except a bright vertical
  // stripe at x=60.
  const W = 96;
  const H = 96;
  function stripeImage(): Uint8ClampedArray {
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = x === 60 ? 255 : 10;
        const o = (y * W + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = v;
        data[o + 3] = 255;
      }
    }
    return data;
  }

  it('sobel magnitude peaks at the stripe edges', () => {
    const gray = toGrayscale(stripeImage(), W, H);
    const mag = sobelMagnitude(gray, W, H);
    const rowStart = 48 * W;
    // Edge columns (59/61) carry far more gradient than flat regions.
    expect(mag[rowStart + 59]).toBeGreaterThan(mag[rowStart + 5] + 100);
    expect(mag[rowStart + 61]).toBeGreaterThan(mag[rowStart + 5] + 100);
  });

  it('snaps a nearby point onto the edge, leaves far points alone', () => {
    const gray = toGrayscale(stripeImage(), W, H);
    const mag = sobelMagnitude(gray, W, H);
    // Point 3px left of the stripe: should snap toward the edge (x≈59-61).
    const [snappedNear] = snapPointsToEdges([[57 / 95, 0.5]], mag, W, H, 6);
    expect(snappedNear[0] * 95).toBeGreaterThan(58);
    // Point 20px away (outside radius): unchanged.
    const [snappedFar] = snapPointsToEdges([[40 / 95, 0.5]], mag, W, H, 6);
    expect(Math.round(snappedFar[0] * 95)).toBe(40);
  });
});
