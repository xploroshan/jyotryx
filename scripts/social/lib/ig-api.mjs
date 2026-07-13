/**
 * Instagram Graph API content-publishing client.
 *
 * Node 20+ ESM, no dependencies (uses global fetch).
 *
 * Usage:
 *   import { makeClient } from './ig-api.mjs';
 *   const ig = makeClient({ accessToken, igUserId });
 *   const { mediaId, permalink } = await ig.publishImage({ imageUrl, caption });
 */

const TERMINAL_ERROR_STATUSES = new Set(['ERROR', 'EXPIRED']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an Instagram Graph API client.
 *
 * @param {object} opts
 * @param {string} opts.accessToken - Page/user access token (never logged).
 * @param {string} opts.igUserId - Instagram Business/Creator account id.
 * @param {string} [opts.apiBase] - Graph API base URL.
 * @param {typeof fetch} [opts.fetchImpl] - fetch implementation (for testing).
 * @param {number} [opts.retries] - retry attempts for transient failures.
 * @param {number} [opts.retryDelayMs] - base backoff delay (doubles each attempt).
 * @param {number} [opts.pollIntervalMs] - container status poll interval.
 * @param {number} [opts.pollTimeoutMs] - max time to wait for a container.
 */
export function makeClient({
  accessToken,
  igUserId,
  apiBase = process.env.GRAPH_API_BASE || 'https://graph.facebook.com/v23.0',
  fetchImpl = fetch,
  retries = 3,
  retryDelayMs = 2000,
  pollIntervalMs = 3000,
  pollTimeoutMs = 180000,
} = {}) {
  if (!accessToken) throw new Error('makeClient: accessToken is required');
  if (!igUserId) throw new Error('makeClient: igUserId is required');

  const base = apiBase.replace(/\/+$/, '');

  /** Strip the token from any string that might end up in an error message. */
  function redact(text) {
    if (typeof text !== 'string') return text;
    return text.split(accessToken).join('<redacted>');
  }

  /**
   * Single choke point for all network calls.
   * Retries with exponential backoff (retryDelayMs * 2^attempt) on network
   * errors, 5xx and 429. Never retries other 4xx.
   *
   * @param {string} path - path (starting with '/') or absolute URL.
   * @param {object} [options]
   * @param {'GET'|'POST'} [options.method]
   * @param {Record<string, string>} [options.params] - query string params (GET) .
   * @param {Record<string, string>} [options.form] - form body params (POST).
   * @returns {Promise<any>} parsed JSON body.
   */
  async function request(path, { method = 'GET', params, form } = {}) {
    const url = new URL(path.startsWith('http') ? path : `${base}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }

    let body;
    const headers = {};
    if (form) {
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries(form)) {
        if (v !== undefined && v !== null) search.set(k, String(v));
      }
      body = search.toString();
      headers['content-type'] = 'application/x-www-form-urlencoded';
    }

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        await sleep(retryDelayMs * 2 ** (attempt - 1));
      }

      let res;
      try {
        res = await fetchImpl(url.toString(), { method, headers, body });
      } catch (err) {
        // Network-level failure: retry.
        lastError = new Error(
          `Graph API ${method} ${url.pathname} failed: ${redact(err?.message || String(err))}`,
        );
        continue;
      }

      let json = null;
      let rawText = '';
      try {
        rawText = await res.text();
        json = rawText ? JSON.parse(rawText) : null;
      } catch {
        // Non-JSON body; keep rawText for the error message.
      }

      if (res.ok) return json;

      const graphErr = json?.error;
      const detail = graphErr
        ? `${graphErr.message || 'unknown Graph error'} (code ${graphErr.code ?? '?'}` +
          (graphErr.error_subcode ? `, subcode ${graphErr.error_subcode}` : '') +
          ')'
        : redact(rawText.slice(0, 300)) || res.statusText;
      const error = new Error(
        `Graph API ${method} ${url.pathname} returned HTTP ${res.status}: ${redact(detail)}`,
      );
      error.status = res.status;
      error.graphError = graphErr || null;

      const retryable = res.status >= 500 || res.status === 429;
      if (!retryable) throw error;
      lastError = error;
    }
    throw lastError;
  }

  /**
   * Poll a media container until FINISHED. Throws on ERROR/EXPIRED or timeout.
   */
  async function waitForContainer(containerId) {
    const deadline = Date.now() + pollTimeoutMs;
    for (;;) {
      const data = await request(`/${containerId}`, {
        params: { fields: 'status_code', access_token: accessToken },
      });
      const status = data?.status_code;
      if (status === 'FINISHED') return;
      if (TERMINAL_ERROR_STATUSES.has(status)) {
        throw new Error(`Media container ${containerId} ended with status ${status}`);
      }
      if (Date.now() + pollIntervalMs > deadline) {
        throw new Error(
          `Timed out after ${pollTimeoutMs}ms waiting for media container ${containerId} ` +
          `(last status: ${status ?? 'unknown'})`,
        );
      }
      await sleep(pollIntervalMs);
    }
  }

  /** Publish a finished container and return its media id. */
  async function publishContainer(creationId) {
    const published = await request(`/${igUserId}/media_publish`, {
      method: 'POST',
      form: { creation_id: creationId, access_token: accessToken },
    });
    const mediaId = published?.id;
    if (!mediaId) throw new Error('media_publish returned no media id');
    return mediaId;
  }

  /** Fetch the permalink for a published media id (best effort). */
  async function getPermalink(mediaId) {
    try {
      const data = await request(`/${mediaId}`, {
        params: { fields: 'permalink', access_token: accessToken },
      });
      return data?.permalink ?? null;
    } catch {
      return null;
    }
  }

  return {
    /**
     * Publish a single image post.
     * @returns {Promise<{ mediaId: string, permalink: string|null }>}
     */
    async publishImage({ imageUrl, caption }) {
      if (!imageUrl) throw new Error('publishImage: imageUrl is required');

      const container = await request(`/${igUserId}/media`, {
        method: 'POST',
        form: {
          image_url: imageUrl,
          caption: caption ?? '',
          access_token: accessToken,
        },
      });
      const creationId = container?.id;
      if (!creationId) throw new Error('media creation returned no container id');

      await waitForContainer(creationId);
      const mediaId = await publishContainer(creationId);
      const permalink = await getPermalink(mediaId);
      return { mediaId, permalink };
    },

    /**
     * Publish a carousel of 2-10 images.
     * @returns {Promise<{ mediaId: string, permalink: string|null }>}
     */
    async publishCarousel({ imageUrls, caption }) {
      if (!Array.isArray(imageUrls) || imageUrls.length < 2 || imageUrls.length > 10) {
        throw new Error(
          `publishCarousel: imageUrls must contain 2-10 images (got ${imageUrls?.length ?? 0})`,
        );
      }

      const childIds = [];
      for (const imageUrl of imageUrls) {
        const child = await request(`/${igUserId}/media`, {
          method: 'POST',
          form: {
            image_url: imageUrl,
            is_carousel_item: 'true',
            access_token: accessToken,
          },
        });
        const childId = child?.id;
        if (!childId) throw new Error('carousel child creation returned no container id');
        childIds.push(childId);
      }
      for (const childId of childIds) {
        await waitForContainer(childId);
      }

      const parent = await request(`/${igUserId}/media`, {
        method: 'POST',
        form: {
          media_type: 'CAROUSEL',
          children: childIds.join(','),
          caption: caption ?? '',
          access_token: accessToken,
        },
      });
      const parentId = parent?.id;
      if (!parentId) throw new Error('carousel parent creation returned no container id');

      await waitForContainer(parentId);
      const mediaId = await publishContainer(parentId);
      const permalink = await getPermalink(mediaId);
      return { mediaId, permalink };
    },

    /**
     * Fetch insights for a media object. Never throws: on total failure
     * returns {} with a `warning` field. Unsupported metrics are dropped
     * and retried without them.
     * @returns {Promise<Record<string, number> & { warning?: string }>}
     */
    async getInsights(mediaId, metrics = ['reach', 'saved', 'shares', 'likes', 'comments']) {
      let remaining = [...metrics];
      const warnings = [];

      while (remaining.length > 0) {
        try {
          const data = await request(`/${mediaId}/insights`, {
            params: { metric: remaining.join(','), access_token: accessToken },
          });
          const out = {};
          for (const item of data?.data ?? []) {
            const value = item?.values?.[0]?.value ?? item?.total_value?.value;
            if (item?.name !== undefined && value !== undefined) out[item.name] = value;
          }
          if (warnings.length > 0) out.warning = warnings.join('; ');
          return out;
        } catch (err) {
          // The API 400s naming the unsupported metric; drop it and retry.
          const message = err?.graphError?.message || err?.message || '';
          const bad = remaining.filter((m) => new RegExp(`\\b${m}\\b`, 'i').test(message));
          if (err?.status === 400 && bad.length > 0 && bad.length < remaining.length) {
            warnings.push(`unsupported metrics dropped: ${bad.join(', ')}`);
            remaining = remaining.filter((m) => !bad.includes(m));
            continue;
          }
          warnings.push(`insights failed: ${message}`);
          break;
        }
      }

      // Fallback: basic engagement counts from the media node itself.
      try {
        const data = await request(`/${mediaId}`, {
          params: { fields: 'like_count,comments_count', access_token: accessToken },
        });
        const out = {};
        if (data?.like_count !== undefined) out.likes = data.like_count;
        if (data?.comments_count !== undefined) out.comments = data.comments_count;
        out.warning = warnings.join('; ') || 'insights unavailable; returned basic counts';
        return out;
      } catch (err) {
        return { warning: warnings.concat(err?.message || 'fallback failed').join('; ') };
      }
    },

    /**
     * Check token validity. Never throws.
     * @returns {Promise<{ ok: boolean, expiresAt?: string, error?: string }>}
     */
    async checkToken() {
      const appId = process.env.FB_APP_ID;
      const appSecret = process.env.FB_APP_SECRET;
      try {
        if (appId && appSecret) {
          const data = await request('/debug_token', {
            params: {
              input_token: accessToken,
              access_token: `${appId}|${appSecret}`,
            },
          });
          const info = data?.data;
          if (info && info.is_valid === false) {
            return { ok: false, error: redact(info.error?.message || 'token invalid') };
          }
          const result = { ok: true };
          if (info?.expires_at) {
            // expires_at === 0 means never expires.
            result.expiresAt = new Date(info.expires_at * 1000).toISOString();
          }
          return result;
        }
        await request('/me', { params: { access_token: accessToken } });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: redact(err?.message || String(err)) };
      }
    },

    /**
     * Exchange the current token for a long-lived one.
     * Requires FB_APP_ID and FB_APP_SECRET in the environment; otherwise null.
     * @returns {Promise<{ accessToken: string, expiresIn: number|null } | null>}
     */
    async refreshToken() {
      const appId = process.env.FB_APP_ID;
      const appSecret = process.env.FB_APP_SECRET;
      if (!appId || !appSecret) return null;

      const data = await request('/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: accessToken,
        },
      });
      if (!data?.access_token) return null;
      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in ?? null,
      };
    },
  };
}
