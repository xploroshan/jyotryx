import crypto from "node:crypto";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "../route";

/**
 * Unit tests for the Vercel → GitHub IndexNow bridge.
 *
 * The contract under test:
 *  - unconfigured deployments answer 200 (never make Vercel retry forever);
 *  - the HMAC-sha1 signature of the RAW body gates everything else;
 *  - ONLY production `deployment.succeeded` events fire repository_dispatch —
 *    Vercel sends payload.target: null for previews, which must be skipped;
 *  - GitHub dispatch failures surface as 502 so Vercel retries later.
 */

const SECRET = "test-webhook-secret";

function sign(raw: string, secret = SECRET): string {
  return crypto.createHmac("sha1", secret).update(raw).digest("hex");
}

function request(raw: string, sig?: string): Request {
  return new Request("https://www.myastro360.com/api/vercel-deploy-hook", {
    method: "POST",
    headers: sig ? { "x-vercel-signature": sig } : {},
    body: raw,
  });
}

const prodDeploy = JSON.stringify({
  type: "deployment.succeeded",
  payload: { target: "production" },
});

describe("POST /api/vercel-deploy-hook", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("VERCEL_WEBHOOK_SECRET", SECRET);
    vi.stubEnv("GITHUB_DISPATCH_TOKEN", "gh-test-token");
    vi.stubEnv("GITHUB_DISPATCH_REPO", "acme/site");
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("answers 200 not-configured when env is missing (no Vercel retry storm)", async () => {
    vi.stubEnv("VERCEL_WEBHOOK_SECRET", "");
    const res = await POST(request(prodDeploy, sign(prodDeploy)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong signature with 401 and never dispatches", async () => {
    for (const bad of [undefined, "deadbeef", sign(prodDeploy, "other-secret")]) {
      const res = await POST(request(prodDeploy, bad));
      expect(res.status).toBe(401);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unparsable (but correctly signed) bodies with 400", async () => {
    const raw = "not json {";
    const res = await POST(request(raw, sign(raw)));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches deploy-succeeded to GitHub for a production deploy", async () => {
    const res = await POST(request(prodDeploy, sign(prodDeploy)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, dispatched: true });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme/site/dispatches");
    expect(init.headers.Authorization).toBe("Bearer gh-test-token");
    expect(JSON.parse(init.body)).toEqual({ event_type: "deploy-succeeded" });
  });

  it("SKIPS preview deploys (Vercel sends target: null for previews)", async () => {
    const preview = JSON.stringify({
      type: "deployment.succeeded",
      payload: { target: null },
    });
    const res = await POST(request(preview, sign(preview)));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe("deployment.succeeded");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips non-deployment events", async () => {
    const other = JSON.stringify({ type: "deployment.created", payload: { target: "production" } });
    const res = await POST(request(other, sign(other)));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe("deployment.created");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces GitHub dispatch failure as 502 (Vercel will retry)", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const res = await POST(request(prodDeploy, sign(prodDeploy)));
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ ok: false, reason: "dispatch-failed", status: 500 });
  });
});
