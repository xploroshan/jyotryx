import crypto from "node:crypto";

/**
 * Vercel → GitHub bridge for IndexNow.
 *
 * Register a Vercel Webhook (Project → Settings → Webhooks) for the
 * `deployment.succeeded` event pointing at
 *   https://www.myastro360.com/api/vercel-deploy-hook
 * When a PRODUCTION deploy goes live, this route fires GitHub's
 * `repository_dispatch` (event type `deploy-succeeded`), which the IndexNow
 * workflow (.github/workflows/indexnow.yml) listens for and submits the fresh
 * sitemap to Bing/Yandex/etc. within minutes. (Google ignores IndexNow — it's
 * covered by the Search Console sitemap; the daily cron remains the fallback.)
 *
 * Firing AFTER the deploy is live matters: the submitted sitemap then contains
 * any newly-added URLs. Env required:
 *   VERCEL_WEBHOOK_SECRET  — the webhook's signing secret (verify authenticity)
 *   GITHUB_DISPATCH_TOKEN  — fine-grained PAT, repo Contents: read/write
 *   GITHUB_DISPATCH_REPO   — optional, defaults to "xploroshan/jyotryx"
 */

export const runtime = "nodejs";
// Never cache/prerender a webhook receiver.
export const dynamic = "force-dynamic";

function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_DISPATCH_REPO || "xploroshan/jyotryx";

  if (!secret || !token) {
    // Misconfiguration — don't 500 (that would make Vercel retry forever).
    return Response.json({ ok: false, reason: "not-configured" }, { status: 200 });
  }

  // Signature verification needs the RAW body (Vercel signs the exact bytes).
  const raw = await req.text();
  const sig = req.headers.get("x-vercel-signature") ?? "";
  const expected = crypto.createHmac("sha1", secret).update(raw).digest("hex");
  if (!sig || !timingSafeEqualHex(sig, expected)) {
    return Response.json({ ok: false, reason: "bad-signature" }, { status: 401 });
  }

  let body: { type?: string; payload?: { target?: string | null } } = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  // Only production deploys are worth an IndexNow ping (previews aren't public).
  const isProdSuccess =
    body.type === "deployment.succeeded" &&
    (body.payload?.target === "production" || body.payload?.target == null);
  if (!isProdSuccess) {
    return Response.json({ ok: true, skipped: body.type ?? "unknown" }, { status: 200 });
  }

  const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "myastro360-deploy-hook",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event_type: "deploy-succeeded" }),
  });

  // GitHub returns 204 No Content on success.
  if (!res.ok) {
    return Response.json(
      { ok: false, reason: "dispatch-failed", status: res.status },
      { status: 502 },
    );
  }
  return Response.json({ ok: true, dispatched: true }, { status: 200 });
}
