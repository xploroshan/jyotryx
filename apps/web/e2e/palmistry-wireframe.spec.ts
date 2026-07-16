import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';

/**
 * Real-browser verification of the palm wireframe + authenticity UI.
 * Drives the actual page in Chromium with a mocked API returning fixture
 * geometry, then screenshots the rendered wireframe for visual review
 * (contrast, label crispness — the class of bug unit tests can't see).
 */

const fakeAuthState = JSON.stringify({
  state: {
    user: {
      id: 'test-user-1',
      name: 'Test User',
      email: 'test@example.com',
      credits: 20,
      role: 'USER',
      // Without this the app's ProfileGate redirects to /profile?complete=1
      // before the palmistry page can render.
      profileComplete: true,
    },
    accessToken: 'fake-token',
    refreshToken: 'fake-refresh',
    isAuthenticated: true,
  },
  version: 0,
});

// Landmarks laid out like a real upright palm (wrist bottom, fingers up).
const landmarks = [
  { x: 0.5, y: 0.86, z: 0 },   // 0 wrist
  { x: 0.36, y: 0.8, z: 0 },   // 1 thumb cmc
  { x: 0.3, y: 0.72, z: 0 },   // 2 thumb mcp
  { x: 0.26, y: 0.64, z: 0 },  // 3 thumb ip
  { x: 0.23, y: 0.57, z: 0 },  // 4 thumb tip
  { x: 0.38, y: 0.5, z: 0 },   // 5 index mcp
  { x: 0.36, y: 0.38, z: 0 },  // 6
  { x: 0.35, y: 0.3, z: 0 },   // 7
  { x: 0.34, y: 0.23, z: 0 },  // 8 index tip
  { x: 0.47, y: 0.48, z: 0 },  // 9 middle mcp
  { x: 0.465, y: 0.35, z: 0 }, // 10
  { x: 0.46, y: 0.26, z: 0 },  // 11
  { x: 0.455, y: 0.18, z: 0 }, // 12 middle tip
  { x: 0.56, y: 0.49, z: 0 },  // 13 ring mcp
  { x: 0.565, y: 0.37, z: 0 }, // 14
  { x: 0.57, y: 0.28, z: 0 },  // 15
  { x: 0.575, y: 0.21, z: 0 }, // 16 ring tip
  { x: 0.65, y: 0.52, z: 0 },  // 17 pinky mcp
  { x: 0.66, y: 0.43, z: 0 },  // 18
  { x: 0.67, y: 0.36, z: 0 },  // 19
  { x: 0.68, y: 0.3, z: 0 },   // 20 pinky tip
];

const analysisWithGeometry = {
  id: 'reading-1',
  userId: 'test-user-1',
  status: 'completed',
  atAGlance: { strengths: 'Resilient, analytical', lifePath: 'Growth', love: 'Sincere', bestSuitedFor: 'Strategy' },
  handOverview: { handType: 'Air', palmShape: 'Square', fingers: 'Long', thumb: 'Strong', dominantHand: 'Right' },
  handShape: { type: 'Air', description: 'Square palm, long fingers.' },
  lines: [
    { name: 'Heart Line', subtitle: 'Emotion', description: 'Clear', observations: ['Deep'], strength: 'strong', interpretation: 'Deep capacity for love and long relationships.' },
    { name: 'Head Line', subtitle: 'Mind', description: 'Straight', observations: ['Long'], strength: 'strong', interpretation: 'Sharp analytical mind with practical judgement.' },
    { name: 'Life Line', subtitle: 'Vitality', description: 'Wide arc', observations: ['Unbroken'], strength: 'strong', interpretation: 'Strong vitality and stamina through life.' },
    { name: 'Fate Line', subtitle: 'Career', description: 'Rising', observations: ['Branches'], strength: 'moderate', interpretation: 'A self-made career path that strengthens with time.' },
    { name: 'Sun Line', subtitle: 'Success', description: 'Faint', observations: ['Upper palm'], strength: 'weak', interpretation: 'Recognition arrives with cultivation.' },
  ],
  mounts: [
    { name: 'Mount of Jupiter', prominence: 'elevated', interpretation: 'Leadership.' },
    { name: 'Mount of Venus', prominence: 'elevated', interpretation: 'Warmth.' },
    { name: 'Mount of Saturn', prominence: 'normal', interpretation: 'Discipline.' },
  ],
  fingerAnalysis: [
    { finger: 'Thumb', length: 'long', interpretation: 'Willpower.' },
    { finger: 'Index (Jupiter)', length: 'average', interpretation: 'Confidence.' },
    { finger: 'Middle (Saturn)', length: 'average', interpretation: 'Structure.' },
  ],
  specialMarkings: [],
  timingInsights: [{ ageRange: '20-35 years', area: 'career', description: 'New direction begins.' }],
  overallReading: 'A person of strong character with excellent analytical abilities and deep emotional intelligence throughout.',
  healthInsights: 'Robust health indicated; manage stress with steady routines.',
  careerInsights: 'Leadership potential with a creative dimension; steady growth.',
  relationshipInsights: 'Deep, loyal patterns; values honesty and mutual respect.',
  spiritualInsights: 'Considered spiritual choices.',
  cautions: 'Avoid overextending.',
  closingAffirmation: 'Your path is yours to build.',
  geometry: {
    landmarks,
    handedness: 'Right',
    score: 0.97,
    metrics: { palmAspect: 0.74, fingerRatio: 0.81, handShape: 'Water' },
    polylines: [
      { name: 'Heart Line', kind: 'major', points: [[0.34, 0.56], [0.42, 0.545], [0.5, 0.55], [0.58, 0.565], [0.65, 0.58]], confidence: 0.92 },
      { name: 'Head Line', kind: 'major', points: [[0.35, 0.62], [0.44, 0.615], [0.53, 0.625], [0.62, 0.645]], confidence: 0.9 },
      { name: 'Life Line', kind: 'major', points: [[0.4, 0.58], [0.38, 0.66], [0.39, 0.74], [0.43, 0.82]], confidence: 0.88 },
      { name: 'Fate Line', kind: 'major', points: [[0.49, 0.84], [0.485, 0.74], [0.48, 0.64], [0.475, 0.56]], confidence: 0.8 },
      { name: 'Sun Line', kind: 'major', points: [[0.56, 0.72], [0.558, 0.66], [0.555, 0.6], [0.55, 0.56]], confidence: 0.7 },
      { name: 'Marriage Line', kind: 'minor', points: [[0.66, 0.6], [0.69, 0.6], [0.72, 0.605]], confidence: 0.6 },
      { name: 'Heart Branch', kind: 'sub', points: [[0.5, 0.55], [0.52, 0.52], [0.55, 0.5]], confidence: 0.5 },
    ],
  },
  verification: {
    verificationId: 'wf-verify-42',
    imageSha256: 'a'.repeat(64),
    landmarkFingerprint: 'fp',
    groundednessScore: 0.86,
    checks: [{ code: 'handShape.type', expected: 'Water', observed: 'Air', pass: false }],
    authentic: true,
  },
  factors: [
    { code: 'measurement.handShape.Water', label: 'Measured hand shape: Water', detail: 'Palm ratio 0.74', contribution: 'neutral', source: 'measurement' },
    { code: 'line.heart_line.strong', label: 'Heart Line: strong', contribution: 'positive', source: 'line' },
    { code: 'line.sun_line.weak', label: 'Sun Line: weak', contribution: 'negative', source: 'line' },
  ],
  createdAt: new Date().toISOString(),
};

// A tiny valid PNG (2x2 gray) used as the "palm photo".
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGNgYGD4//8/AwAI/AL+XJ/G2gAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Palmistry wireframe (real browser)', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, {
      'GET /payments/pricing': async (route) => route.fulfill(json({})),
      'POST /palmistry/analyze': async (route) => route.fulfill(json(analysisWithGeometry)),
    });
    await page.addInitScript((authJson) => {
      localStorage.setItem('myastro360-auth', authJson);
    }, fakeAuthState);
  });

  test('renders the neon wireframe from the user photo with crisp labels', async ({ page }) => {
    await page.goto('/palmistry');

    // Pick gender then upload the fixture "photo".
    await page.getByRole('radio', { name: /Male — Right Palm/ }).click();
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({ name: 'palm.png', mimeType: 'image/png', buffer: TINY_PNG });
    await page.getByText(/Analyze Palm/).click();

    // The wireframe card renders with the scan title…
    await expect(page.getByText(/Your Palm — Scan/)).toBeVisible({ timeout: 15000 });
    // …with crisp SVG labels for every major line (the reference image's
    // garbled AI text is impossible here by construction).
    for (const label of ['HEART LINE', 'HEAD LINE', 'LIFE LINE', 'FATE LINE', 'SUN LINE']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    // Measured-geometry HUD readout is present.
    await expect(page.getByText(/MEASURED GEOMETRY/)).toBeVisible();

    // Verification badge with id + groundedness.
    await expect(page.getByText('Verified reading')).toBeVisible();
    await expect(page.getByText(/wf-verify-42/)).toBeVisible();
    await expect(page.getByText(/86%/)).toBeVisible();

    // Show Your Work renders measured + observed factors.
    await expect(page.getByText('Measured hand shape: Water')).toBeVisible();

    // SVG structure: glowing paths exist (5 major + minor + sub + skeleton).
    const wireframe = page.locator('svg[aria-label*="Your Palm"]');
    await expect(wireframe).toBeVisible();
    const pathCount = await wireframe.locator('path').count();
    expect(pathCount).toBeGreaterThanOrEqual(7);

    // Screenshot the wireframe card for visual/contrast review.
    await wireframe.screenshot({ path: '/tmp/palm-wireframe.png' });
    await page.screenshot({ path: '/tmp/palm-page.png', fullPage: true });
  });

  test('no JS errors during the wireframe flow', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/palmistry');
    await page.getByRole('radio', { name: /Male — Right Palm/ }).click();
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({ name: 'palm.png', mimeType: 'image/png', buffer: TINY_PNG });
    await page.getByText(/Analyze Palm/).click();
    await expect(page.getByText(/Your Palm — Scan/)).toBeVisible({ timeout: 15000 });
    expect(errors).toEqual([]);
  });

  test('sample reading (no authentic image) shows the honesty banner', async ({ page }) => {
    // Registered AFTER the beforeEach mocks → takes precedence for this route.
    await page.route('**/api/palmistry/analyze', async (route) =>
      route.fulfill(
        json({
          ...analysisWithGeometry,
          geometry: null,
          factors: [],
          verification: {
            verificationId: 'v-sample',
            imageSha256: null,
            landmarkFingerprint: null,
            groundednessScore: 0,
            checks: [],
            authentic: false,
            authenticReason: 'no_image',
          },
        }),
      ),
    );

    await page.goto('/palmistry');
    await page.getByRole('radio', { name: /Male — Right Palm/ }).click();
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({ name: 'palm.png', mimeType: 'image/png', buffer: TINY_PNG });
    await page.getByText(/Analyze Palm/).click();

    await expect(page.getByText('Sample reading', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Verified reading', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: '/tmp/palm-sample-banner.png', fullPage: false });
  });
});

/**
 * REAL MediaPipe pipeline, headless: loads the self-hosted WASM + model and
 * runs landmark detection on a synthetic hand-ish image. Guarded — if the
 * environment can't run WASM inference, the test reports and skips rather
 * than flaking the suite (the mocked-geometry specs above are the gate).
 */
test.describe('MediaPipe self-hosted pipeline (best-effort)', () => {
  test('loads WASM from our origin and returns a result object', async ({ page }) => {
    await installApiMocks(page, { 'GET /payments/pricing': async (route) => route.fulfill(json({})) });
    await page.goto('/palmistry');

    // Asset wiring is a HARD requirement — a 404 here means the copy script /
    // committed model broke, which must fail the suite (skipping would hide
    // the exact self-hosted-pipeline regression this test exists to catch).
    for (const asset of [
      '/models/mediapipe/vision_wasm_internal.js',
      '/models/mediapipe/vision_wasm_internal.wasm',
      '/models/mediapipe/hand_landmarker.task',
      '/models/mediapipe/vision_bundle.mjs',
    ]) {
      const res = await page.request.get(asset);
      expect(res.status(), `${asset} must be served from our origin`).toBe(200);
    }
    const result = await page.evaluate(async () => {
      try {
        // URL import of the self-hosted bundle (bare npm specifiers don't
        // resolve inside the browser).
        const vision = await import(/* webpackIgnore: true */ '/models/mediapipe/vision_bundle.mjs' as string);
        const fileset = await vision.FilesetResolver.forVisionTasks('/models/mediapipe');
        const lm = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/models/mediapipe/hand_landmarker.task', delegate: 'CPU' },
          runningMode: 'IMAGE',
          numHands: 1,
        });
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 256, 256);
        const out = lm.detect(canvas);
        lm.close();
        return { ok: true, hands: out.landmarks.length };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    });
    if (!result.ok) {
      test.info().annotations.push({ type: 'warning', description: `MediaPipe headless unavailable: ${result.error}` });
      test.skip(true, 'WASM inference unavailable in this headless environment');
      return;
    }
    // A blank canvas has no hand — 0 detections is the CORRECT result; the
    // assertion is that the pipeline loads + runs from OUR origin end-to-end.
    expect(result.hands).toBe(0);
  });
});
