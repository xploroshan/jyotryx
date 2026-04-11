import type { Page, Route } from '@playwright/test';

/**
 * Installs a catch-all route handler for `**\/api/**` requests. The page
 * under test never reaches a real backend — every XHR is served by the
 * deterministic handlers registered here.
 *
 * Rationale: E2E tests should fail loudly for unexpected network calls
 * but still let the app's happy paths run without a backend running.
 * Anything not explicitly mocked returns a 500 with a diagnostic body so
 * the failing test points directly at the missing handler.
 */
export type ApiMock = (
  route: Route,
  req: ReturnType<Route['request']>,
) => void | Promise<void>;

export interface ApiMockMap {
  [method_and_path: string]: ApiMock;
}

export async function installApiMocks(page: Page, mocks: ApiMockMap = {}) {
  // Stub external font CDN. In the sandbox it returns 407/403 via the
  // proxy which can block the `load` event and trigger spurious JS
  // errors when dev-mode scripts try to process the failed font
  // response. Serve empty 200s instead of aborting — same visual effect
  // (no custom font) but a clean network path.
  await page.route('**/fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
  );
  await page.route('**/fonts.gstatic.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'font/woff2', body: '' }),
  );

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    // Pathname always starts with /api; normalise to the post-/api segment
    // so handlers can be keyed as `POST /auth/otp/send` regardless of whether
    // the app is talking to localhost:4000 or the mocked 127.0.0.1:9.
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const key = `${req.method()} ${path}`;

    const handler = mocks[key];
    if (handler) {
      await handler(route, req);
      return;
    }

    // Unexpected call — fail loudly so the test reports which endpoint is missing.
    // eslint-disable-next-line no-console
    console.error(`[mock-api] Unhandled ${key}`);
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: `Unhandled mock: ${key}` }),
    });
  });
}

export const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

/**
 * Navigate to a route and wait for React hydration to fully complete.
 *
 * In dev mode, Next.js compiles routes on first request. By the time
 * `page.goto` returns with the `load` event, the HTML is rendered and
 * the JS chunks have downloaded, but React may not have attached its
 * synthetic event listeners yet — a click fired in that window is
 * silently dropped.
 *
 * React 18 writes a `__reactProps$...` prop onto every DOM node it
 * owns as soon as it attaches event handlers. We walk the DOM looking
 * for ANY element with that key, which is a reliable "events bound"
 * signal — the body's `__reactContainer$` appears earlier, before
 * children are rendered, so it's not a safe gate on its own.
 */
export async function gotoAndHydrate(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(
    () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
      let node = walker.currentNode as Element | null;
      while (node) {
        if (Object.keys(node).some((k) => k.startsWith('__reactProps$'))) {
          return true;
        }
        node = walker.nextNode() as Element | null;
      }
      return false;
    },
    undefined,
    { timeout: 30_000 },
  );
}
