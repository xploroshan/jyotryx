/**
 * Pure geometry helpers for the palm wireframe (no DOM): Catmull-Rom → cubic
 * Bézier smoothing for crease polylines, and Sobel-based edge snapping that
 * nudges each polyline point onto the strongest nearby crease edge so the
 * rendered line hugs the user's actual palm crease.
 */

export type Point = [number, number];

/**
 * Build a smooth SVG path (`M … C …`) through the points using centripetal
 * Catmull-Rom converted to cubic Béziers. Points are in the caller's
 * coordinate space (already scaled).
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${fmt(points[0][0])},${fmt(points[0][1])}`;
  const p = points;
  let d = `M ${fmt(p[0][0])},${fmt(p[0][1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(p.length - 1, i + 2)];
    // Standard Catmull-Rom → Bézier control points (tension 1/6).
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${fmt(c1[0])},${fmt(c1[1])} ${fmt(c2[0])},${fmt(c2[1])} ${fmt(p2[0])},${fmt(p2[1])}`;
  }
  return d;
}

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

/** Luma-weighted grayscale from RGBA ImageData bytes. */
export function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  return gray;
}

/** Sobel gradient magnitude of a grayscale image. */
export function sobelMagnitude(gray: Float32Array, width: number, height: number): Float32Array {
  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] - 2 * gray[i - 1] - gray[i + width - 1] +
        gray[i - width + 1] + 2 * gray[i + 1] + gray[i + width + 1];
      const gy =
        -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] +
        gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
      mag[i] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

/** Below this size the gradient grid is too coarse for snapping to mean
 *  anything — a 6px radius on a 32px image would let points teleport. */
export const MIN_SNAP_IMAGE_PX = 64;

/**
 * Snap each normalized point to the strongest edge within `radiusPx` in the
 * gradient image. Points stay put when no stronger edge is nearby — the model
 * trace is a good prior; snapping only refines it onto the visible crease.
 * Undersized images are returned unchanged (refinement, never distortion).
 */
export function snapPointsToEdges(
  points: Point[], // normalized 0–1
  mag: Float32Array,
  width: number,
  height: number,
  radiusPx = 6,
): Point[] {
  if (Math.min(width, height) < MIN_SNAP_IMAGE_PX) return points;
  return points.map(([nx, ny]) => {
    const cx = Math.round(nx * (width - 1));
    const cy = Math.round(ny * (height - 1));
    let bestX = cx;
    let bestY = cy;
    let best = mag[cy * width + cx] * 1.15; // current spot gets a 15% prior bonus
    for (let dy = -radiusPx; dy <= radiusPx; dy++) {
      for (let dx = -radiusPx; dx <= radiusPx; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
        // Weight nearer candidates higher so the point doesn't jump to a
        // parallel crease.
        const w = 1 - Math.hypot(dx, dy) / (radiusPx * 1.5);
        const score = mag[y * width + x] * w;
        if (score > best) {
          best = score;
          bestX = x;
          bestY = y;
        }
      }
    }
    // Hard bound: never let a snap move a point more than the search radius in
    // normalized units — a jump beyond that is a wrong crease, not this one.
    const maxShift = radiusPx / Math.min(width, height);
    const outX = bestX / (width - 1);
    const outY = bestY / (height - 1);
    if (Math.hypot(outX - nx, outY - ny) > maxShift * 1.5) return [nx, ny] as Point;
    return [outX, outY] as Point;
  });
}
