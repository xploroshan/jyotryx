/**
 * Client-side image normalization for photo uploads (palmistry).
 *
 * Phone photos routinely carry an EXIF orientation tag instead of physically
 * rotated pixels. If we upload them as-is, everything downstream that works in
 * pixel coordinates — hand landmarks, crease polylines, the wireframe overlay —
 * is computed against a sideways/upside-down image and misaligns. Decoding via
 * an <img> element applies EXIF orientation natively in every browser we
 * support (browserslist: Chrome/Edge/Firefox ≥93, Safari ≥15.4), so re-encoding
 * the decoded bitmap yields an upright JPEG with no orientation tag.
 *
 * Also downscales to a bounded long edge (default 1536px): plenty for both the
 * vision model (`detail: 'high'` tiles at 512px) and landmark detection, while
 * shrinking upload time and keeping canvases cheap on low-end phones.
 *
 * HEIC/HEIF: the API rejects it (the vision model can't read it). Safari can
 * decode HEIC in <img>, so there this pipeline silently converts it to JPEG;
 * everywhere else decoding fails and we surface a typed error so the UI can
 * show an actionable "please use JPG/PNG" message instead of a generic one.
 */

export interface PreparedImage {
  /** Upright, downscaled JPEG ready for upload. */
  file: File;
  /** Data URL of the same pixels, for the preview <img>. */
  dataUrl: string;
  width: number;
  height: number;
}

export type ImagePrepErrorCode = 'decode_failed' | 'canvas_unavailable' | 'encode_failed';

export class ImagePrepError extends Error {
  constructor(public readonly code: ImagePrepErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ImagePrepError';
  }
}

/** Bounded dimensions preserving aspect ratio; never upscales. Exported for tests. */
export function computeTargetSize(
  width: number,
  height: number,
  maxLongEdge: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 };
  const longEdge = Math.max(width, height);
  if (longEdge <= maxLongEdge) return { width: Math.round(width), height: Math.round(height) };
  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const JPEG_QUALITY = 0.9;

/**
 * Decode → orient → downscale → re-encode as JPEG.
 * Throws {@link ImagePrepError} on any failure (never returns a broken image).
 */
export async function prepareImage(file: File, maxLongEdge = 1536): Promise<PreparedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await decodeImage(objectUrl);
    const { width, height } = computeTargetSize(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      maxLongEdge,
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImagePrepError('canvas_unavailable');
    // White backing so transparent PNG regions don't turn black in JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToJpegBlob(canvas);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const outName = file.name.replace(/\.[a-z0-9]+$/i, '') || 'palm';
    return {
      file: new File([blob], `${outName}.jpg`, { type: 'image/jpeg' }),
      dataUrl,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImagePrepError('decode_failed'));
    img.src = src;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImagePrepError('encode_failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}
