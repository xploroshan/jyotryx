import { test, expect } from '@playwright/test';
import { installApiMocks, json } from './helpers/mock-api';
import * as fs from 'fs';
import * as path from 'path';
import { evaluateCapturedStill } from '../src/lib/palm/quality';

/**
 * REAL-pipeline palmistry E2E — real photos through the real self-hosted
 * MediaPipe HandLandmarker, plus the page-level dorsal-rejection flow.
 *
 * Born from the dorsal-capture incident: every guided-camera gate showed
 * green on a photo of the BACK of a hand. Measured on these real photos:
 *  - MediaPipe's handedness label is ANATOMICAL (the classifier sees
 *    nails/knuckles): a right hand is 'Right' whichever side faces the
 *    camera (scores 0.93–0.97 across our fixtures).
 *  - The 2D winding (crossZ) encodes WHICH SIDE is shown: right palm →
 *    negative, right dorsal → positive (left mirrors both). The originally
 *    shipped palm-facing formula demanded the OPPOSITE sign — validated by
 *    a synthetic fixture with backwards anatomy — so it approved dorsal
 *    shots of the expected hand and rejected genuine palms.
 *  - The live gates run in VIDEO mode; its tracking can carry a lock through
 *    the shutter onto a still that IMAGE mode cannot even detect.
 * ONLY real photos through the real model can pin any of this.
 *
 * Fixtures (owner-supplied, anatomical names):
 *  - hand-dorsal-incident.jpg — the incident capture (back of right hand);
 *    undetectable in IMAGE mode.
 *  - hand-dorsal-right.jpg — natural back-of-right-hand photo.
 *  - hand-dorsal-left-mirrored.jpg — mirror of the incident (≙ left dorsal).
 *  - hand-palm-right.jpg — real right palm; must PASS.
 * Drop more real palm photos in as hand-palm-*.jpg — the harness picks them
 * up and asserts they PASS the still confirmation.
 */

const fakeAuthState = JSON.stringify({
  state: {
    user: {
      id: 'test-user-1',
      name: 'Test User',
      email: 'test@example.com',
      credits: 20,
      role: 'USER',
      profileComplete: true,
    },
    accessToken: 'fake-token',
    refreshToken: 'fake-refresh',
    isAuthenticated: true,
  },
  version: 0,
});

/** Run the REAL IMAGE-mode landmarker on a fixture inside the browser. */
async function detectFixture(page: import('@playwright/test').Page, fixture: string) {
  const b64 = fs.readFileSync(path.join(__dirname, 'fixtures', fixture)).toString('base64');
  return page.evaluate(async (b64) => {
    const vision = await import(/* webpackIgnore: true */ '/models/mediapipe/vision_bundle.mjs' as string);
    const fileset = await vision.FilesetResolver.forVisionTasks('/models/mediapipe');
    const lm = await vision.HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/models/mediapipe/hand_landmarker.task', delegate: 'CPU' },
      runningMode: 'IMAGE',
      numHands: 1,
    });
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = `data:image/jpeg;base64,${b64}`;
    });
    const out = lm.detect(img);
    lm.close();
    const marks = out.landmarks?.[0];
    const hd = out.handednesses?.[0]?.[0];
    if (!marks || marks.length !== 21 || !hd) return null;
    return {
      landmarks: marks.map((p: { x: number; y: number; z: number }) => ({ x: p.x, y: p.y, z: p.z })),
      handedness: (hd.categoryName === 'Left' ? 'Left' : 'Right') as 'Left' | 'Right',
      score: hd.score ?? 0,
    };
  }, b64);
}

test.describe('Real MediaPipe over real photos (capture-confirmation contract)', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page, {
      'GET /payments/pricing': async (route) => route.fulfill(json({})),
    });
    await page.goto('/palmistry');
  });

  test('the incident capture is rejected by the post-capture confirmation', async ({ page }) => {
    test.setTimeout(120_000);
    // The exact photo that sailed through the live gates: IMAGE-mode
    // detection finds no hand in it, so evaluateCapturedStill rejects and the
    // camera auto-retakes instead of shipping it to a doomed paid analysis.
    // If a future model update starts detecting this photo, this assertion
    // fails — re-measure and re-derive the gate semantics before relaxing it.
    const det = await detectFixture(page, 'hand-dorsal-incident.jpg');
    const verdict = evaluateCapturedStill(det, 'Right');
    expect(verdict.ok, 'the incident dorsal capture must never pass confirmation').toBe(false);
  });

  test('a natural right-dorsal photo is rejected even though the HAND matches', async ({ page }) => {
    test.setTimeout(120_000);
    // Back of the right hand for a user whose expected hand IS Right — the
    // incident scenario. Measured: anatomical label 'Right' + dorsal winding
    // → the palm-facing check rejects the SIDE, not the hand.
    const det = await detectFixture(page, 'hand-dorsal-right.jpg');
    expect(det, 'natural right-dorsal fixture should be detectable').not.toBeNull();
    expect(det!.handedness).toBe('Right');
    expect(evaluateCapturedStill(det, 'Right')).toEqual({ ok: false, reason: 'wrong_hand' });
  });

  test('a left-dorsal photo is rejected for a male (Right-palm) user', async ({ page }) => {
    test.setTimeout(120_000);
    const det = await detectFixture(page, 'hand-dorsal-left-mirrored.jpg');
    // Mirror of the incident photo ≙ back of a LEFT hand: anatomical label
    // 'Left' — wrong hand AND wrong side for a Right-palm expectation.
    expect(det, 'mirrored dorsal fixture should be detectable').not.toBeNull();
    expect(det!.handedness).toBe('Left');
    expect(evaluateCapturedStill(det, 'Right')).toEqual({ ok: false, reason: 'wrong_hand' });
  });

  test('any real palm fixtures present must PASS the still confirmation', async ({ page }) => {
    test.setTimeout(120_000);
    const palms = fs
      .readdirSync(path.join(__dirname, 'fixtures'))
      .filter((f) => /^hand-palm-.*\.(jpe?g|png)$/i.test(f));
    test.skip(palms.length === 0, 'no hand-palm-* fixtures committed yet');
    for (const fixture of palms) {
      const det = await detectFixture(page, fixture);
      expect(det, `${fixture}: a real palm photo must be detectable`).not.toBeNull();
      // Hand-agnostic identity check: the photo passes for the hand the
      // model reports (fixture filenames don't encode which hand it is).
      expect(evaluateCapturedStill(det, det!.handedness).ok, fixture).toBe(true);
    }
  });
});

test.describe('Dorsal rejection — page-level flow (mocked 422 verdict)', () => {
  test('the specific back-of-hand error is shown, not the generic advice', async ({ page }) => {
    await installApiMocks(page, {
      'GET /payments/pricing': async (route) => route.fulfill(json({})),
      'POST /palmistry/analyze': async (route) =>
        route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            message:
              'That looks like the BACK of your hand — turn your palm (the side with the lines) toward the camera and try again. You have not been charged.',
            code: 'back_of_hand',
            statusCode: 422,
          }),
        }),
    });
    await page.addInitScript((authJson) => {
      localStorage.setItem('myastro360-auth', authJson);
    }, fakeAuthState);

    await page.goto('/palmistry');
    await page.getByRole('radio', { name: /Male — Right Palm/ }).click();
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(path.join(__dirname, 'fixtures', 'hand-dorsal-incident.jpg'));
    await page.getByText(/Analyze Palm/).click();

    // The SPECIFIC, actionable verdict — the incident's generic "clearer,
    // well-lit photo" advice pointed the user in the wrong direction.
    await expect(page.getByText(/BACK of your hand/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/not been charged/i)).toBeVisible();
  });
});
