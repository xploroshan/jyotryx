/**
 * image-prep — palm-photo normalization (EXIF/downscale/HEIC).
 * computeTargetSize is pure; prepareImage's DOM pipeline is exercised with
 * stubbed Image/canvas (jsdom has no real codecs — the real-pixels path is
 * covered by the Playwright browser spec).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeTargetSize, prepareImage, ImagePrepError } from '@/lib/image-prep';

describe('computeTargetSize', () => {
  it('keeps images already within the bound (never upscales)', () => {
    expect(computeTargetSize(800, 600, 1536)).toEqual({ width: 800, height: 600 });
    expect(computeTargetSize(1536, 1024, 1536)).toEqual({ width: 1536, height: 1024 });
  });

  it('downscales the long edge to the bound, preserving aspect ratio', () => {
    expect(computeTargetSize(4032, 3024, 1536)).toEqual({ width: 1536, height: 1152 });
    // Portrait orientation: the HEIGHT is the long edge.
    expect(computeTargetSize(3024, 4032, 1536)).toEqual({ width: 1152, height: 1536 });
  });

  it('handles extreme aspect ratios without collapsing to 0', () => {
    const r = computeTargetSize(10000, 10, 1536);
    expect(r.width).toBe(1536);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });

  it('is defensive about nonsense dimensions', () => {
    expect(computeTargetSize(0, 0, 1536)).toEqual({ width: 1, height: 1 });
    expect(computeTargetSize(-5, 100, 1536)).toEqual({ width: 1, height: 1 });
  });
});

describe('prepareImage', () => {
  const realImage = global.Image;
  const realCreateObjectURL = URL.createObjectURL;
  const realRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    global.Image = realImage;
    URL.createObjectURL = realCreateObjectURL;
    URL.revokeObjectURL = realRevokeObjectURL;
    vi.restoreAllMocks();
  });

  function stubImage(behaviour: 'load' | 'error', width = 4032, height = 3024) {
    class StubImage {
      naturalWidth = width;
      naturalHeight = height;
      width = width;
      height = height;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        queueMicrotask(() => (behaviour === 'load' ? this.onload?.() : this.onerror?.()));
      }
    }
    global.Image = StubImage as any;
  }

  function stubCanvas() {
    const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag !== 'canvas') return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
      return {
        width: 0,
        height: 0,
        getContext: () => ctx,
        toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(['jpeg-bytes'], { type: 'image/jpeg' })),
        toDataURL: () => 'data:image/jpeg;base64,ZmFrZQ==',
      } as unknown as HTMLCanvasElement;
    }) as any);
    return ctx;
  }

  it('produces an upright, downscaled JPEG file + preview data URL', async () => {
    stubImage('load', 4032, 3024);
    const ctx = stubCanvas();
    const out = await prepareImage(new File(['x'], 'IMG_0481.HEIC', { type: 'image/heic' }));
    expect(out.width).toBe(1536);
    expect(out.height).toBe(1152);
    expect(out.file.type).toBe('image/jpeg');
    expect(out.file.name).toBe('IMG_0481.jpg');
    expect(out.dataUrl.startsWith('data:image/jpeg')).toBe(true);
    // The bitmap is drawn (EXIF orientation applied by the decoder).
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('throws a typed decode error when the browser cannot decode the file (HEIC on Chrome)', async () => {
    stubImage('error');
    await expect(prepareImage(new File(['x'], 'palm.heic', { type: 'image/heic' }))).rejects.toMatchObject({
      name: 'ImagePrepError',
      code: 'decode_failed',
    });
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('throws a typed error when canvas is unavailable', async () => {
    stubImage('load');
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      if (tag !== 'canvas') return document.createElementNS('http://www.w3.org/1999/xhtml', tag);
      return { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
    }) as any);
    await expect(prepareImage(new File(['x'], 'palm.jpg', { type: 'image/jpeg' }))).rejects.toMatchObject({
      code: 'canvas_unavailable',
    });
  });

  it('exposes ImagePrepError for instanceof checks in callers', () => {
    expect(new ImagePrepError('decode_failed')).toBeInstanceOf(Error);
  });
});
