/**
 * Frame-quality gates for the guided palm scan — pure functions over ImageData
 * bytes so they're unit-testable without a camera.
 *
 * Thresholds are RELATIVE/percentile-based where possible so darker skin tones
 * and varied lighting aren't unfairly rejected: brightness uses a wide
 * acceptable band and measures the palm ROI (not the background), sharpness
 * uses Laplacian variance which is contrast-normalised by nature of the
 * gradient operator.
 */

export interface FrameQuality {
  /** Mean luma of the ROI (0–255). */
  meanLuma: number;
  /** Fraction of ROI pixels at/near white — blown-out highlights (0–1). */
  clippedHighlights: number;
  /** Variance of the Laplacian — the classic blur metric (higher = sharper). */
  laplacianVariance: number;
  brightnessOk: boolean;
  sharpnessOk: boolean;
}

// Wide luma band: accepts deep skin tones in ordinary room light while still
// rejecting silhouettes and blown-out frames.
export const LUMA_MIN = 50;
export const LUMA_MAX = 215;
export const CLIPPED_MAX = 0.12;
// Laplacian variance below this reads as motion blur / defocus at 160px ROI.
export const SHARPNESS_MIN = 60;

/**
 * Measure a frame region. `data` is RGBA bytes of an ALREADY-CROPPED region
 * (callers crop to the hand bounding box before measuring, so background
 * doesn't skew the stats).
 */
export function measureFrameQuality(data: Uint8ClampedArray, width: number, height: number): FrameQuality {
  const n = width * height;
  const gray = new Float32Array(n);
  let sum = 0;
  let clipped = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const v = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    gray[i] = v;
    sum += v;
    if (v >= 245) clipped++;
  }
  const meanLuma = sum / n;
  const clippedHighlights = clipped / n;

  // Laplacian (4-neighbour) variance.
  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      lapSum += lap;
      lapSqSum += lap * lap;
      count++;
    }
  }
  const mean = count ? lapSum / count : 0;
  const laplacianVariance = count ? lapSqSum / count - mean * mean : 0;

  return {
    meanLuma: round2(meanLuma),
    clippedHighlights: round4(clippedHighlights),
    laplacianVariance: round2(laplacianVariance),
    brightnessOk: meanLuma >= LUMA_MIN && meanLuma <= LUMA_MAX && clippedHighlights <= CLIPPED_MAX,
    sharpnessOk: laplacianVariance >= SHARPNESS_MIN,
  };
}

export interface HandPoseGates {
  handPresent: boolean;
  correctHand: boolean;
  palmFacing: boolean;
  coverageOk: boolean;
}

/**
 * Pose gates from landmarks (normalized 0–1 in the video frame).
 *
 * - `expectedHand`: Vedic convention — male → Right palm, female → Left.
 * - `mirrored`: front cameras preview mirrored; MediaPipe reports handedness
 *   for the IMAGE it sees, so a mirrored selfie view flips Left/Right.
 * - Palm-facing: for a palm toward the camera, the thumb sits on the wrist→
 *   middle axis' expected side; we use the sign of the cross product of
 *   (index MCP − wrist) × (pinky MCP − wrist), which flips between palm and
 *   back of hand, adjusted by handedness.
 */
export function evaluateHandPose(
  landmarks: { x: number; y: number }[] | null,
  opts: {
    expectedHand: 'Left' | 'Right' | null;
    detectedHand: 'Left' | 'Right' | null;
    mirrored: boolean;
    /** Fraction of the frame's height the hand bbox spans. */
    minCoverage?: number;
  },
): HandPoseGates {
  const minCoverage = opts.minCoverage ?? 0.55;
  if (!landmarks || landmarks.length !== 21 || !opts.detectedHand) {
    return { handPresent: false, correctHand: false, palmFacing: false, coverageOk: false };
  }

  // Handedness, corrected for a mirrored preview.
  const physicalHand = opts.mirrored
    ? opts.detectedHand === 'Left' ? 'Right' : 'Left'
    : opts.detectedHand;
  const correctHand = !opts.expectedHand || physicalHand === opts.expectedHand;

  // Palm facing the camera: cross-product z of the palm plane.
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];
  const v1 = { x: indexMcp.x - wrist.x, y: indexMcp.y - wrist.y };
  const v2 = { x: pinkyMcp.x - wrist.x, y: pinkyMcp.y - wrist.y };
  const crossZ = v1.x * v2.y - v1.y * v2.x;
  // For an upright hand seen palm-on (image coordinates, y grows DOWNWARD):
  // Right hand → index MCP appears LEFT of pinky MCP → crossZ positive;
  // Left hand → negative. Showing the BACK of the hand mirrors the layout and
  // flips the sign. (Mirrored selfie previews flip the image, which flips
  // crossZ AND the reported handedness together, so comparing against the
  // DETECTED hand needs no extra correction.)
  const palmFacing = opts.detectedHand === 'Right' ? crossZ > 0 : crossZ < 0;

  // Coverage: hand bbox height fraction, inside frame margins.
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const inFrame = minX > 0.02 && maxX < 0.98 && minY > 0.02 && maxY < 0.98;
  const coverageOk = inFrame && maxY - minY >= minCoverage;

  return { handPresent: true, correctHand, palmFacing, coverageOk };
}

/** Landmark displacement between two frames (mean per-point movement). */
export function landmarkMovement(
  a: { x: number; y: number }[] | null,
  b: { x: number; y: number }[] | null,
): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return sum / a.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
