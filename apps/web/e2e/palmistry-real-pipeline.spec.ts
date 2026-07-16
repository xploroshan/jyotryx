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
 * green on a photo of the BACK of a hand, because (a) the live gates ran
 * only in VIDEO mode whose tracking carried a stale lock through the
 * shutter, and (b) MediaPipe's handedness label follows the 2D winding, so
 * an opposite-hand dorsal view is geometrically identical to the expected
 * palm. The synthetic-landmark unit tests could never see any of this —
 * ONLY real photos through the real model can.
 *
 * Fixtures: e2e/fixtures/hand-dorsal-left.jpg is the incident capture
 * (back of a left hand); hand-dorsal-right.jpg is its mirror (back of a
 * right hand). To extend coverage, drop real PALM photos into e2e/fixtures/
 * as hand-palm-*.jpg — the detection harness below picks them up and
 * asserts they PASS the still confirmation.
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
    // The exact class of photo that sailed through the live gates: IMAGE-mode
    // detection finds no hand in it, so evaluateCapturedStill rejects and the
    // camera auto-retakes instead of shipping it to a paid analysis. If a
    // future model update starts detecting this photo, this assertion fails —
    // re-measure and re-derive the gate semantics before relaxing it.
    const det = await detectFixture(page, 'hand-dorsal-left.jpg');
    const verdict = evaluateCapturedStill(det, 'Right');
    expect(verdict.ok, 'the incident dorsal capture must never pass confirmation').toBe(false);
  });

  test('a right-dorsal photo is rejected for a male (Right-palm) user', async ({ page }) => {
    test.setTimeout(120_000);
    const det = await detectFixture(page, 'hand-dorsal-right.jpg');
    // Measured behavior of the pinned model: the back of a right hand is
    // detected and labelled 'Left' (the label follows the palm-hypothesis
    // winding). The still confirmation therefore rejects it as wrong-hand.
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
    await input.setInputFiles(path.join(__dirname, 'fixtures', 'hand-dorsal-left.jpg'));
    await page.getByText(/Analyze Palm/).click();

    // The SPECIFIC, actionable verdict — the incident's generic "clearer,
    // well-lit photo" advice pointed the user in the wrong direction.
    await expect(page.getByText(/BACK of your hand/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/not been charged/i)).toBeVisible();
  });
});
