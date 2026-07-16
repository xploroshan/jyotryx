/**
 * Lazy, self-hosted MediaPipe HandLandmarker.
 *
 * Everything loads on demand and from OUR origin only:
 *  - the @mediapipe/tasks-vision JS API is dynamically imported (code-split —
 *    it never enters the shared bundle),
 *  - the WASM runtime is served from /models/mediapipe (copied from
 *    node_modules at build time by scripts/copy-mediapipe-assets.mjs),
 *  - the hand_landmarker.task model is committed at the same path.
 * No CDN, no third-party origin at runtime.
 */

export interface PalmLandmark {
  x: number; // normalized 0–1, image coordinates
  y: number;
  z: number; // relative depth (wrist-anchored), unitless
}

export interface HandDetection {
  landmarks: PalmLandmark[]; // 21 points, MediaPipe hand topology
  /** Physical hand: 'Left' | 'Right' (already corrected by MediaPipe for image handedness). */
  handedness: 'Left' | 'Right';
  /** Detector confidence for the handedness/presence, 0–1. */
  score: number;
}

const ASSET_BASE = '/models/mediapipe';

type RunningMode = 'IMAGE' | 'VIDEO';

interface LandmarkerHandle {
  detectImage(source: TexImageSource): HandDetection | null;
  detectVideo(video: HTMLVideoElement, timestampMs: number): HandDetection | null;
  close(): void;
}

// One landmarker per running mode, created lazily and reused (creation costs
// ~100–300ms; switching modes requires a separate instance).
const instances: Partial<Record<RunningMode, Promise<LandmarkerHandle>>> = {};

async function createLandmarker(mode: RunningMode): Promise<LandmarkerHandle> {
  const vision = await import('@mediapipe/tasks-vision');
  const fileset = await vision.FilesetResolver.forVisionTasks(ASSET_BASE);
  const landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: `${ASSET_BASE}/hand_landmarker.task`,
      delegate: 'GPU', // falls back to CPU internally when WebGL is unavailable
    },
    runningMode: mode,
    numHands: 1,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  const toDetection = (result: {
    landmarks: Array<Array<{ x: number; y: number; z: number }>>;
    handednesses: Array<Array<{ categoryName: string; score: number }>>;
  }): HandDetection | null => {
    const lm = result.landmarks?.[0];
    const hd = result.handednesses?.[0]?.[0];
    if (!lm || lm.length !== 21 || !hd) return null;
    return {
      landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      handedness: hd.categoryName === 'Left' ? 'Left' : 'Right',
      score: hd.score ?? 0,
    };
  };

  return {
    detectImage: (source) => toDetection(landmarker.detect(source)),
    detectVideo: (video, ts) => toDetection(landmarker.detectForVideo(video, ts)),
    close: () => landmarker.close(),
  };
}

/** Get (or create) the shared landmarker for a running mode. Never throws at
 *  import time — failures surface from this promise so callers can degrade. */
export function getHandLandmarker(mode: RunningMode = 'IMAGE'): Promise<LandmarkerHandle> {
  if (!instances[mode]) {
    instances[mode] = createLandmarker(mode).catch((err) => {
      // Allow a retry on the next call instead of caching the failure forever.
      delete instances[mode];
      throw err;
    });
  }
  return instances[mode]!;
}

/**
 * Detect hand landmarks in a prepared palm photo (data URL or element).
 * Returns null when no hand is found or the pipeline fails — landmark data is
 * an enhancement; its absence must never block the reading.
 */
export async function detectPalmLandmarks(imageSource: string | TexImageSource): Promise<HandDetection | null> {
  try {
    const landmarker = await getHandLandmarker('IMAGE');
    const source =
      typeof imageSource === 'string' ? await loadImageElement(imageSource) : imageSource;
    return landmarker.detectImage(source);
  } catch {
    return null;
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image decode failed'));
    img.src = src;
  });
}
