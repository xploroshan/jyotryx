import { useAuthStore } from "./store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// Default request timeout. Auth endpoints often hit a cold backend on free
// hosting tiers, so we allow up to 30s before giving up. Individual callers
// can override via `timeoutMs`.
const DEFAULT_TIMEOUT_MS = 30_000;

interface ApiOptions extends RequestInit {
  token?: string;
  /** Abort the request after this many ms. Defaults to 30s. */
  timeoutMs?: number;
  /** Skip the auto-refresh-on-401 flow. Pass `true` for endpoints
   *  where a 401 carries domain meaning rather than "access token
   *  expired" — e.g. /auth/change-password returns 401 when the
   *  user typed their current password wrong, and treating that as
   *  a stale-token signal would log the user out instead of
   *  surfacing the error. */
  skipAuthRefreshOn401?: boolean;
}

/**
 * Error thrown by the api client. Exposes the HTTP status code when one is
 * available so callers can distinguish between credential errors (401),
 * server errors (5xx), and network failures (no status).
 */
export class ApiError extends Error {
  status: number | null;
  isTimeout: boolean;
  isNetwork: boolean;
  /**
   * The parsed JSON error body, when the server returned one. Lets callers
   * read structured hints beyond `message` — e.g. a 402 carries
   * `{ subscribe, feature }` so the paywall UI can pick Subscribe vs top-up.
   */
  body: Record<string, unknown> | null;

  constructor(
    message: string,
    opts: { status?: number | null; isTimeout?: boolean; isNetwork?: boolean; body?: Record<string, unknown> | null } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status ?? null;
    this.isTimeout = opts.isTimeout ?? false;
    this.isNetwork = opts.isNetwork ?? false;
    this.body = opts.body ?? null;
  }
}

function getAuthHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Use explicit token or fall back to stored token
  const authToken = token || useAuthStore.getState().accessToken;
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * Wrap fetch in an AbortController so requests can't hang forever. Returns
 * the Response on success, throws an ApiError tagged as timeout/network.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new ApiError(
        "The server is taking too long to respond. Please check your connection and try again.",
        { isTimeout: true },
      );
    }
    throw new ApiError(
      "Unable to connect to the server. Please check your internet connection and try again.",
      { isNetwork: true },
    );
  } finally {
    clearTimeout(timer);
  }
}

async function tryRefreshToken(): Promise<string | null> {
  const { refreshToken, setAuth, logout } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const response = await fetchWithTimeout(
      `${API_BASE_URL}/auth/refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      },
      DEFAULT_TIMEOUT_MS,
    );

    if (!response.ok) {
      logout();
      return null;
    }

    const data = await response.json();
    const { user } = useAuthStore.getState();
    if (user) {
      setAuth(user, data.accessToken, data.refreshToken);
    }
    return data.accessToken;
  } catch {
    logout();
    return null;
  }
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { token, timeoutMs = DEFAULT_TIMEOUT_MS, skipAuthRefreshOn401, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    ...getAuthHeaders(token),
    ...(options.headers as Record<string, string>),
  };

  let response = await fetchWithTimeout(
    `${API_BASE_URL}${endpoint}`,
    { ...fetchOptions, headers },
    timeoutMs,
  );

  // Auto-refresh on 401 (expired access token) — skipped for
  // endpoints that 401 on credential mismatch rather than stale token.
  if (response.status === 401 && !skipAuthRefreshOn401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`;
      response = await fetchWithTimeout(
        `${API_BASE_URL}${endpoint}`,
        { ...fetchOptions, headers },
        timeoutMs,
      );
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new ApiError(error.message || `API Error: ${response.status}`, {
      status: response.status,
      body: error,
    });
  }

  return response.json();
}

/**
 * Fire a best-effort GET /health against the API. Used by the auth page on
 * mount to warm up free-tier hosts (Render, Fly, etc.) so the first real
 * request doesn't eat the cold-start penalty. Never throws — resolves to
 * `true` when the server answered, `false` otherwise.
 */
export async function wakeUpBackend(timeoutMs = 25_000): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/health`,
      { method: "GET", headers: { "Content-Type": "application/json" } },
      timeoutMs,
    );
    return res.ok;
  } catch {
    return false;
  }
}

export const api = {
  get: <T>(endpoint: string, options?: ApiOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body: unknown, options?: ApiOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "POST", body: JSON.stringify(body) }),

  put: <T>(endpoint: string, body: unknown, options?: ApiOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "PUT", body: JSON.stringify(body) }),

  delete: <T>(endpoint: string, options?: ApiOptions) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),

  upload: async <T>(endpoint: string, formData: FormData, token?: string): Promise<T> => {
    const authToken = token || useAuthStore.getState().accessToken;
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

    // Uploads get a longer timeout since they transfer image data.
    const UPLOAD_TIMEOUT_MS = 60_000;

    let response = await fetchWithTimeout(
      `${API_BASE_URL}${endpoint}`,
      { method: "POST", headers, body: formData },
      UPLOAD_TIMEOUT_MS,
    );

    // Auto-refresh on 401 (expired access token)
    if (response.status === 401) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        response = await fetchWithTimeout(
          `${API_BASE_URL}${endpoint}`,
          { method: "POST", headers, body: formData },
          UPLOAD_TIMEOUT_MS,
        );
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Upload failed" }));
      throw new ApiError(error.message || `API Error: ${response.status}`, {
        status: response.status,
        body: error,
      });
    }

    return response.json();
  },
};
