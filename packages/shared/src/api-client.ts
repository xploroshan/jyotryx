/**
 * Framework-agnostic API client.
 *
 * This is the portable core of `apps/web/src/lib/api.ts`. The web version
 * imported `useAuthStore` directly; here that coupling is inverted into an
 * injected {@link ApiClientAdapter} so the exact same 401-refresh + timeout
 * behaviour runs on both web (localStorage/Zustand) and mobile
 * (expo-secure-store). Nothing here imports React, Zustand, Next, or Expo.
 *
 * Behaviour preserved from web:
 *  - 30s default timeout via AbortController; 60s for uploads.
 *  - Auto-refresh on 401, retry once with the new token.
 *  - `skipAuthRefreshOn401` for endpoints where 401 is a domain signal
 *    (e.g. /auth/change-password wrong current password) rather than a
 *    stale-token signal.
 *  - `ApiError` carries `status` / `isTimeout` / `isNetwork`.
 *
 * Added for mobile (safe on web): a single-flight refresh, so a burst of
 * parallel queries that all 401 triggers exactly one /auth/refresh, not N.
 */

export interface AuthTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiClientAdapter {
  /** e.g. https://api.myastro360.com/api */
  baseUrl: string;
  /** Read the current tokens (sync or async — mobile SecureStore is async). */
  getTokens: () => AuthTokens | Promise<AuthTokens>;
  /** Persist rotated tokens after a successful refresh. */
  onTokensRefreshed: (tokens: RefreshedTokens) => void | Promise<void>;
  /** Session is unrecoverable (no/expired refresh token) — clear + redirect. */
  onAuthCleared: () => void | Promise<void>;
  /** Platform fetch. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Override the 30s default request timeout. */
  defaultTimeoutMs?: number;
}

export interface ApiOptions extends RequestInit {
  /** Explicit bearer token; falls back to the adapter's stored token. */
  token?: string;
  /** Abort the request after this many ms. Defaults to 30s. */
  timeoutMs?: number;
  /** Skip the auto-refresh-on-401 flow (401 = domain error, not stale token). */
  skipAuthRefreshOn401?: boolean;
}

/**
 * Error thrown by the api client. Exposes the HTTP status code when one is
 * available so callers can distinguish credential errors (401), server
 * errors (5xx), and network failures (no status).
 */
export class ApiError extends Error {
  status: number | null;
  isTimeout: boolean;
  isNetwork: boolean;

  constructor(
    message: string,
    opts: { status?: number | null; isTimeout?: boolean; isNetwork?: boolean } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status ?? null;
    this.isTimeout = opts.isTimeout ?? false;
    this.isNetwork = opts.isNetwork ?? false;
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 60_000;

export interface ApiClient {
  get: <T>(endpoint: string, options?: ApiOptions) => Promise<T>;
  post: <T>(endpoint: string, body: unknown, options?: ApiOptions) => Promise<T>;
  put: <T>(endpoint: string, body: unknown, options?: ApiOptions) => Promise<T>;
  delete: <T>(endpoint: string, options?: ApiOptions) => Promise<T>;
  upload: <T>(endpoint: string, formData: FormData, token?: string) => Promise<T>;
  /** Best-effort GET /health to warm a cold backend. Never throws. */
  wakeUpBackend: (timeoutMs?: number) => Promise<boolean>;
}

export function createApiClient(adapter: ApiClientAdapter): ApiClient {
  const doFetch = adapter.fetch ?? fetch;
  const baseTimeout = adapter.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Single-flight refresh: concurrent 401s share one refresh round-trip.
  let refreshInFlight: Promise<string | null> | null = null;

  async function fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await doFetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new ApiError(
          'The server is taking too long to respond. Please check your connection and try again.',
          { isTimeout: true },
        );
      }
      throw new ApiError(
        'Unable to connect to the server. Please check your internet connection and try again.',
        { isNetwork: true },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshOnce(): Promise<string | null> {
    const { refreshToken } = await adapter.getTokens();
    if (!refreshToken) {
      await adapter.onAuthCleared();
      return null;
    }
    try {
      const response = await fetchWithTimeout(
        `${adapter.baseUrl}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        },
        baseTimeout,
      );
      if (!response.ok) {
        await adapter.onAuthCleared();
        return null;
      }
      const data = (await response.json()) as RefreshedTokens;
      await adapter.onTokensRefreshed(data);
      return data.accessToken;
    } catch {
      await adapter.onAuthCleared();
      return null;
    }
  }

  function tryRefreshToken(): Promise<string | null> {
    if (!refreshInFlight) {
      refreshInFlight = refreshOnce().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  }

  async function authHeaders(explicitToken?: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = explicitToken ?? (await adapter.getTokens()).accessToken;
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const { token, timeoutMs = baseTimeout, skipAuthRefreshOn401, headers: extraHeaders, ...fetchOptions } =
      options;

    const headers: Record<string, string> = {
      ...(await authHeaders(token)),
      ...(extraHeaders as Record<string, string> | undefined),
    };

    let response = await fetchWithTimeout(
      `${adapter.baseUrl}${endpoint}`,
      { ...fetchOptions, headers },
      timeoutMs,
    );

    if (response.status === 401 && !skipAuthRefreshOn401) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetchWithTimeout(
          `${adapter.baseUrl}${endpoint}`,
          { ...fetchOptions, headers },
          timeoutMs,
        );
      }
    }

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ message: 'Request failed' }))) as {
        message?: string;
      };
      throw new ApiError(error.message || `API Error: ${response.status}`, {
        status: response.status,
      });
    }

    return response.json() as Promise<T>;
  }

  async function upload<T>(endpoint: string, formData: FormData, token?: string): Promise<T> {
    const buildHeaders = async (): Promise<Record<string, string>> => {
      const authToken = token ?? (await adapter.getTokens()).accessToken;
      // Deliberately no Content-Type: the platform sets the multipart boundary.
      return authToken ? { Authorization: `Bearer ${authToken}` } : {};
    };

    let response = await fetchWithTimeout(
      `${adapter.baseUrl}${endpoint}`,
      { method: 'POST', headers: await buildHeaders(), body: formData },
      UPLOAD_TIMEOUT_MS,
    );

    if (response.status === 401) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        response = await fetchWithTimeout(
          `${adapter.baseUrl}${endpoint}`,
          { method: 'POST', headers: { Authorization: `Bearer ${newToken}` }, body: formData },
          UPLOAD_TIMEOUT_MS,
        );
      }
    }

    if (!response.ok) {
      const error = (await response.json().catch(() => ({ message: 'Upload failed' }))) as {
        message?: string;
      };
      throw new ApiError(error.message || `API Error: ${response.status}`, {
        status: response.status,
      });
    }

    return response.json() as Promise<T>;
  }

  async function wakeUpBackend(timeoutMs = 25_000): Promise<boolean> {
    try {
      const res = await fetchWithTimeout(
        `${adapter.baseUrl}/health`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        timeoutMs,
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  return {
    get: (endpoint, options) => apiRequest(endpoint, { ...options, method: 'GET' }),
    post: (endpoint, body, options) =>
      apiRequest(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
    put: (endpoint, body, options) =>
      apiRequest(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    delete: (endpoint, options) => apiRequest(endpoint, { ...options, method: 'DELETE' }),
    upload,
    wakeUpBackend,
  };
}
