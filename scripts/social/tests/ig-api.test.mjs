/**
 * Tests for the Instagram Graph API client (scripts/social/lib/ig-api.mjs)
 * against a local node:http mock Graph server on an ephemeral port.
 * No real network traffic. Run: npm run social:test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { makeClient } from '../lib/ig-api.mjs';

const TOKEN = 'TEST_TOKEN';
const IG_USER = '17841400000000000';

/**
 * Start a mock Graph server. `route(req)` receives
 * { method, path, query, form, count } (count = per-path call number,
 * 1-based) and returns { status?, body? }.
 */
async function startMock(t, route) {
  const requests = [];
  const perPathCounts = new Map();
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const url = new URL(req.url, 'http://mock');
    const key = `${req.method} ${url.pathname}`;
    const count = (perPathCounts.get(key) ?? 0) + 1;
    perPathCounts.set(key, count);
    const record = {
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      form: raw ? Object.fromEntries(new URLSearchParams(raw)) : {},
      count,
    };
    requests.push(record);
    const out = route(record) ?? { status: 404, body: { error: { message: `no route for ${key}` } } };
    res.statusCode = out.status ?? 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(out.body ?? {}));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const apiBase = `http://127.0.0.1:${server.address().port}`;
  return { apiBase, requests };
}

function client(apiBase) {
  return makeClient({
    accessToken: TOKEN,
    igUserId: IG_USER,
    apiBase,
    retries: 2,
    retryDelayMs: 10,
    pollIntervalMs: 10,
    pollTimeoutMs: 2000,
  });
}

test('publishImage: container -> IN_PROGRESS -> FINISHED -> publish -> permalink', async (t) => {
  const { apiBase, requests } = await startMock(t, (req) => {
    if (req.method === 'POST' && req.path === `/${IG_USER}/media`) {
      return { body: { id: 'container-1' } };
    }
    if (req.method === 'GET' && req.path === '/container-1') {
      return { body: { status_code: req.count === 1 ? 'IN_PROGRESS' : 'FINISHED' } };
    }
    if (req.method === 'POST' && req.path === `/${IG_USER}/media_publish`) {
      return { body: { id: 'media-1' } };
    }
    if (req.method === 'GET' && req.path === '/media-1') {
      return { body: { permalink: 'https://www.instagram.com/p/abc123/' } };
    }
    return undefined;
  });

  const result = await client(apiBase).publishImage({
    imageUrl: 'https://cdn.example.com/social/slide-01.png',
    caption: 'Hello & welcome — link in bio',
  });
  assert.deepEqual(result, { mediaId: 'media-1', permalink: 'https://www.instagram.com/p/abc123/' });

  // The container-creation POST carried the right form params.
  const create = requests.find((r) => r.method === 'POST' && r.path === `/${IG_USER}/media`);
  assert.deepEqual(create.form, {
    image_url: 'https://cdn.example.com/social/slide-01.png',
    caption: 'Hello & welcome — link in bio',
    access_token: TOKEN,
  });

  // Status was polled at least twice (IN_PROGRESS then FINISHED).
  const polls = requests.filter((r) => r.method === 'GET' && r.path === '/container-1');
  assert.equal(polls.length, 2);
  assert.equal(polls[0].query.fields, 'status_code');

  // Publish referenced the finished container.
  const publish = requests.find((r) => r.path === `/${IG_USER}/media_publish`);
  assert.equal(publish.form.creation_id, 'container-1');

  // Permalink fetch happened after publish.
  const permalink = requests.find((r) => r.path === '/media-1');
  assert.equal(permalink.query.fields, 'permalink');
});

test('publishCarousel: 3 children + parent with children param + publish', async (t) => {
  let childSeq = 0;
  const { apiBase, requests } = await startMock(t, (req) => {
    if (req.method === 'POST' && req.path === `/${IG_USER}/media`) {
      if (req.form.is_carousel_item === 'true') {
        childSeq += 1;
        return { body: { id: `child-${childSeq}` } };
      }
      return { body: { id: 'parent-1' } };
    }
    if (req.method === 'GET' && /^\/(child-\d+|parent-1)$/.test(req.path)) {
      return { body: { status_code: 'FINISHED' } };
    }
    if (req.method === 'POST' && req.path === `/${IG_USER}/media_publish`) {
      return { body: { id: 'media-9' } };
    }
    if (req.method === 'GET' && req.path === '/media-9') {
      return { body: { permalink: 'https://www.instagram.com/p/car0/' } };
    }
    return undefined;
  });

  const imageUrls = [
    'https://cdn.example.com/s/slide-01.png',
    'https://cdn.example.com/s/slide-02.png',
    'https://cdn.example.com/s/slide-03.png',
  ];
  const result = await client(apiBase).publishCarousel({ imageUrls, caption: 'Swipe →' });
  assert.deepEqual(result, { mediaId: 'media-9', permalink: 'https://www.instagram.com/p/car0/' });

  const creations = requests.filter((r) => r.method === 'POST' && r.path === `/${IG_USER}/media`);
  assert.equal(creations.length, 4, '3 children + 1 parent');

  const children = creations.filter((r) => r.form.is_carousel_item === 'true');
  assert.equal(children.length, 3);
  assert.deepEqual(children.map((r) => r.form.image_url), imageUrls);
  for (const child of children) {
    assert.equal(child.form.access_token, TOKEN);
    assert.equal(child.form.caption, undefined, 'children carry no caption');
  }

  const parent = creations.find((r) => r.form.media_type === 'CAROUSEL');
  assert.ok(parent, 'parent creation present');
  assert.equal(parent.form.children, 'child-1,child-2,child-3');
  assert.equal(parent.form.caption, 'Swipe →');

  const publish = requests.find((r) => r.path === `/${IG_USER}/media_publish`);
  assert.equal(publish.form.creation_id, 'parent-1');
});

test('publishCarousel: 1 or 11 images throws before any network call', async (t) => {
  const { apiBase, requests } = await startMock(t, () => ({ body: {} }));
  const ig = client(apiBase);

  await assert.rejects(
    ig.publishCarousel({ imageUrls: ['https://cdn.example.com/only.png'], caption: 'x' }),
    /2-10 images \(got 1\)/,
  );
  await assert.rejects(
    ig.publishCarousel({
      imageUrls: Array.from({ length: 11 }, (_, i) => `https://cdn.example.com/${i}.png`),
      caption: 'x',
    }),
    /2-10 images \(got 11\)/,
  );
  await assert.rejects(ig.publishCarousel({ imageUrls: undefined, caption: 'x' }), /2-10 images/);

  assert.equal(requests.length, 0, 'validation must reject before touching the network');
});

test('publishImage: container ERROR status throws with a useful message', async (t) => {
  const { apiBase } = await startMock(t, (req) => {
    if (req.method === 'POST' && req.path === `/${IG_USER}/media`) return { body: { id: 'bad-1' } };
    if (req.method === 'GET' && req.path === '/bad-1') return { body: { status_code: 'ERROR' } };
    return undefined;
  });

  await assert.rejects(
    client(apiBase).publishImage({ imageUrl: 'https://cdn.example.com/x.png', caption: '' }),
    /Media container bad-1 ended with status ERROR/,
  );
});

test('request retry: 500 then 200 succeeds on the retry', async (t) => {
  const { apiBase, requests } = await startMock(t, (req) => {
    if (req.method === 'POST' && req.path === `/${IG_USER}/media`) {
      if (req.count === 1) return { status: 500, body: { error: { message: 'transient', code: 2 } } };
      return { body: { id: 'container-r' } };
    }
    if (req.method === 'GET' && req.path === '/container-r') return { body: { status_code: 'FINISHED' } };
    if (req.method === 'POST' && req.path === `/${IG_USER}/media_publish`) return { body: { id: 'media-r' } };
    if (req.method === 'GET' && req.path === '/media-r') return { body: { permalink: null } };
    return undefined;
  });

  const result = await client(apiBase).publishImage({
    imageUrl: 'https://cdn.example.com/x.png',
    caption: 'retry me',
  });
  assert.equal(result.mediaId, 'media-r');

  const creations = requests.filter((r) => r.method === 'POST' && r.path === `/${IG_USER}/media`);
  assert.equal(creations.length, 2, 'one failure + one successful retry');
});

test('request retry: 400 fails immediately without retry', async (t) => {
  const { apiBase, requests } = await startMock(t, (req) => {
    if (req.method === 'POST' && req.path === `/${IG_USER}/media`) {
      return {
        status: 400,
        body: { error: { message: 'Invalid parameter', code: 100, error_subcode: 2207052 } },
      };
    }
    return undefined;
  });

  await assert.rejects(
    client(apiBase).publishImage({ imageUrl: 'https://cdn.example.com/x.png', caption: '' }),
    /HTTP 400: Invalid parameter \(code 100, subcode 2207052\)/,
  );
  assert.equal(requests.length, 1, 'a 4xx (non-429) must not be retried');
});

test('getInsights: happy path maps metric values', async (t) => {
  const { apiBase, requests } = await startMock(t, (req) => {
    if (req.method === 'GET' && req.path === '/media-1/insights') {
      return {
        body: {
          data: [
            { name: 'reach', values: [{ value: 1200 }] },
            { name: 'saved', values: [{ value: 34 }] },
            { name: 'shares', total_value: { value: 8 } },
            { name: 'likes', values: [{ value: 210 }] },
            { name: 'comments', values: [{ value: 12 }] },
          ],
        },
      };
    }
    return undefined;
  });

  const out = await client(apiBase).getInsights('media-1');
  assert.deepEqual(out, { reach: 1200, saved: 34, shares: 8, likes: 210, comments: 12 });
  assert.equal(out.warning, undefined);

  const call = requests.find((r) => r.path === '/media-1/insights');
  assert.equal(call.query.metric, 'reach,saved,shares,likes,comments');
});

test('getInsights: total failure returns {} with warning, never throws', async (t) => {
  const { apiBase } = await startMock(t, () => ({
    status: 400,
    body: { error: { message: 'nothing works today', code: 100 } },
  }));

  const out = await client(apiBase).getInsights('media-1');
  assert.ok(typeof out.warning === 'string' && out.warning.length > 0, 'warning is set');
  assert.deepEqual(Object.keys(out), ['warning'], 'no metric values on total failure');
});

// ---------------------------------------------------------------------------
// C34 — getInsights degradation paths
// ---------------------------------------------------------------------------

test('getInsights: unsupported metric is dropped and the call retried', async (t) => {
  const { apiBase, requests } = await startMock(t, (req) => {
    if (req.method === 'GET' && req.path === '/media-1/insights') {
      if (req.count === 1) {
        // First attempt 400s naming exactly one unsupported metric ("shares").
        return {
          status: 400,
          body: { error: { message: 'metric shares is not supported for this media', code: 100 } },
        };
      }
      // Retry (without "shares") succeeds.
      return {
        body: {
          data: [
            { name: 'reach', values: [{ value: 800 }] },
            { name: 'saved', values: [{ value: 20 }] },
            { name: 'likes', values: [{ value: 130 }] },
            { name: 'comments', values: [{ value: 9 }] },
          ],
        },
      };
    }
    return undefined;
  });

  const out = await client(apiBase).getInsights('media-1');
  assert.equal(out.reach, 800);
  assert.equal(out.saved, 20);
  assert.equal(out.likes, 130);
  assert.equal(out.comments, 9);
  assert.equal(out.shares, undefined, 'the unsupported metric is absent');
  assert.match(out.warning, /unsupported metrics dropped: shares/);

  const calls = requests.filter((r) => r.path === '/media-1/insights');
  assert.equal(calls.length, 2, 'one 400 + one successful retry');
  assert.equal(calls[0].query.metric, 'reach,saved,shares,likes,comments');
  assert.equal(calls[1].query.metric, 'reach,saved,likes,comments', 'shares dropped from the retry');
});

test('getInsights: insights fails entirely, falls back to like_count/comments_count', async (t) => {
  const { apiBase, requests } = await startMock(t, (req) => {
    if (req.method === 'GET' && req.path === '/media-1/insights') {
      // A generic 400 that names no droppable metric -> no retry, fall through.
      return { status: 400, body: { error: { message: 'application does not have permission', code: 10 } } };
    }
    if (req.method === 'GET' && req.path === '/media-1') {
      return { body: { like_count: 210, comments_count: 12 } };
    }
    return undefined;
  });

  const out = await client(apiBase).getInsights('media-1');
  assert.equal(out.likes, 210);
  assert.equal(out.comments, 12);
  assert.ok(typeof out.warning === 'string' && out.warning.length > 0, 'a warning explains the fallback');

  const fallback = requests.find((r) => r.path === '/media-1');
  assert.equal(fallback.query.fields, 'like_count,comments_count');
});

// ---------------------------------------------------------------------------
// C23 — checkToken / refreshToken (FB app-credential branches)
// ---------------------------------------------------------------------------

/** Temporarily set/clear env vars for the duration of a test. */
function withEnv(t, vars) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  t.after(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

test('checkToken: /debug_token is_valid:false returns { ok:false }', async (t) => {
  withEnv(t, { FB_APP_ID: 'app123', FB_APP_SECRET: 'secretsecret' });
  const { apiBase, requests } = await startMock(t, (req) => {
    if (req.method === 'GET' && req.path === '/debug_token') {
      return { body: { data: { is_valid: false, error: { message: 'token has expired' } } } };
    }
    return undefined;
  });

  const out = await client(apiBase).checkToken();
  assert.equal(out.ok, false);
  assert.match(out.error, /token has expired/);

  const call = requests.find((r) => r.path === '/debug_token');
  assert.equal(call.query.input_token, TOKEN);
  assert.equal(call.query.access_token, 'app123|secretsecret');
});

test('checkToken: /debug_token expires_at -> ISO expiresAt', async (t) => {
  withEnv(t, { FB_APP_ID: 'app123', FB_APP_SECRET: 'secretsecret' });
  const ts = 1893456000; // a real unix timestamp (seconds)
  const { apiBase } = await startMock(t, (req) => {
    if (req.method === 'GET' && req.path === '/debug_token') {
      return { body: { data: { is_valid: true, expires_at: ts } } };
    }
    return undefined;
  });

  const out = await client(apiBase).checkToken();
  assert.equal(out.ok, true);
  assert.equal(out.expiresAt, new Date(ts * 1000).toISOString());
});

test('checkToken: /debug_token expires_at:0 (never expires) -> no expiresAt', async (t) => {
  withEnv(t, { FB_APP_ID: 'app123', FB_APP_SECRET: 'secretsecret' });
  const { apiBase } = await startMock(t, (req) => {
    if (req.method === 'GET' && req.path === '/debug_token') {
      return { body: { data: { is_valid: true, expires_at: 0 } } };
    }
    return undefined;
  });

  const out = await client(apiBase).checkToken();
  assert.deepEqual(out, { ok: true }, 'expires_at:0 means never expires -> no expiresAt field');
});

test('checkToken: without app creds falls back to /me', async (t) => {
  withEnv(t, { FB_APP_ID: undefined, FB_APP_SECRET: undefined });
  const { apiBase, requests } = await startMock(t, (req) => {
    if (req.method === 'GET' && req.path === '/me') return { body: { id: 'me-1' } };
    return undefined;
  });

  const out = await client(apiBase).checkToken();
  assert.deepEqual(out, { ok: true });
  assert.ok(requests.some((r) => r.path === '/me'), '/me was probed');
  assert.ok(!requests.some((r) => r.path === '/debug_token'), '/debug_token was NOT used');
});

test('refreshToken: maps access_token + expires_in', async (t) => {
  withEnv(t, { FB_APP_ID: 'app123', FB_APP_SECRET: 'secretsecret' });
  const { apiBase, requests } = await startMock(t, (req) => {
    if (req.method === 'GET' && req.path === '/oauth/access_token') {
      return { body: { access_token: 'LONG_LIVED_TOKEN', expires_in: 5183944 } };
    }
    return undefined;
  });

  const out = await client(apiBase).refreshToken();
  assert.deepEqual(out, { accessToken: 'LONG_LIVED_TOKEN', expiresIn: 5183944 });

  const call = requests.find((r) => r.path === '/oauth/access_token');
  assert.equal(call.query.grant_type, 'fb_exchange_token');
  assert.equal(call.query.client_id, 'app123');
  assert.equal(call.query.fb_exchange_token, TOKEN);
});

test('refreshToken: returns null without app creds and makes no network call', async (t) => {
  withEnv(t, { FB_APP_ID: undefined, FB_APP_SECRET: undefined });
  const { apiBase, requests } = await startMock(t, () => ({ body: {} }));

  const out = await client(apiBase).refreshToken();
  assert.equal(out, null);
  assert.equal(requests.length, 0, 'no token exchange is attempted without FB_APP_ID/SECRET');
});
