/**
 * API Client Tests — Token Refresh & Auth Flow
 *
 * These tests cover the critical auth scenarios that caused the
 * "Invalid or expired token" bug on the My Day page and other
 * authenticated pages.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock zustand store ─────────────────────────────────────────────────────
const mockStoreState = {
  user: { id: '1', name: 'Test', email: 'test@test.com', credits: 10, role: 'user' },
  accessToken: 'valid-access-token',
  refreshToken: 'valid-refresh-token',
  isAuthenticated: true,
  setAuth: vi.fn(),
  updateCredits: vi.fn(),
  logout: vi.fn(),
};

vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    vi.fn(() => mockStoreState),
    { getState: () => mockStoreState },
  ),
}));

// ─── Mock global fetch ──────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Import api AFTER mocks are set up ──────────────────────────────────────
let api: typeof import('@/lib/api')['api'];

beforeEach(async () => {
  vi.resetModules();
  mockFetch.mockReset();
  mockStoreState.accessToken = 'valid-access-token';
  mockStoreState.refreshToken = 'valid-refresh-token';
  mockStoreState.setAuth.mockReset();
  mockStoreState.logout.mockReset();
  const mod = await import('@/lib/api');
  api = mod.api;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('API Client: Basic Requests', () => {
  it('should send GET request with Authorization header', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await api.get('/test');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/test');
    expect(opts.headers['Authorization']).toBe('Bearer valid-access-token');
  });

  it('should send POST request with body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ created: true }));

    await api.post('/test', { foo: 'bar' });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ foo: 'bar' }));
  });

  it('should use explicitly passed token over store token', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await api.get('/test', { token: 'explicit-token' });

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer explicit-token');
  });

  it('should throw on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(api.get('/test')).rejects.toThrow('Unable to connect to the server');
  });

  it('should throw with API error message on non-2xx', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404));

    await expect(api.get('/test')).rejects.toThrow('Not found');
  });
});

describe('API Client: Token Auto-Refresh on 401', () => {
  it('should refresh token and retry on 401 (no explicit token)', async () => {
    // First call: 401
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Invalid or expired token' }, 401));
    // Refresh call: success
    mockFetch.mockResolvedValueOnce(jsonResponse({ accessToken: 'new-access', refreshToken: 'new-refresh' }));
    // Retry call: success
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'success' }));

    const result = await api.get('/daily-briefing');

    expect(result).toEqual({ data: 'success' });
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify refresh was called
    const refreshCall = mockFetch.mock.calls[1];
    expect(refreshCall[0]).toContain('/auth/refresh');

    // Verify retry used new token
    const retryCall = mockFetch.mock.calls[2];
    expect(retryCall[1].headers['Authorization']).toBe('Bearer new-access');

    // Verify store was updated
    expect(mockStoreState.setAuth).toHaveBeenCalledWith(
      mockStoreState.user,
      'new-access',
      'new-refresh',
    );
  });

  it('should refresh token and retry on 401 WITH explicit token (the bug fix)', async () => {
    // This was the exact bug: passing { token: accessToken! } skipped refresh
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Invalid or expired token' }, 401));
    mockFetch.mockResolvedValueOnce(jsonResponse({ accessToken: 'new-access', refreshToken: 'new-refresh' }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: 'briefing-data' }));

    // Simulate what My Day page does: api.get("/daily-briefing", { token: accessToken! })
    const result = await api.get('/daily-briefing', { token: 'expired-token' });

    expect(result).toEqual({ data: 'briefing-data' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    // Refresh must have been attempted
    expect(mockFetch.mock.calls[1][0]).toContain('/auth/refresh');
  });

  it('should logout and throw when refresh token is also expired', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Invalid or expired token' }, 401));
    // Refresh also fails
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Refresh token expired' }, 401));

    await expect(api.get('/daily-briefing')).rejects.toThrow('Invalid or expired token');
    expect(mockStoreState.logout).toHaveBeenCalled();
  });

  it('should logout when no refresh token is available', async () => {
    mockStoreState.refreshToken = null;
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Invalid or expired token' }, 401));

    await expect(api.get('/daily-briefing')).rejects.toThrow('Invalid or expired token');
    // Should not attempt refresh (no refresh token)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not refresh on non-401 errors', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Forbidden' }, 403));

    await expect(api.get('/test')).rejects.toThrow('Forbidden');
    // Only 1 call — no refresh attempted
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('API Client: Upload with Token Refresh', () => {
  it('should refresh token on 401 during upload', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.jpg');

    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401));
    mockFetch.mockResolvedValueOnce(jsonResponse({ accessToken: 'new-access', refreshToken: 'new-refresh' }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ url: 'uploaded.jpg' }));

    const result = await api.upload('/upload', formData);

    expect(result).toEqual({ url: 'uploaded.jpg' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe('API Client: Auth Header Construction', () => {
  it('should include Content-Type: application/json', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await api.get('/test');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  it('should not include Authorization when no token available', async () => {
    mockStoreState.accessToken = null;
    mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await api.get('/test');

    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers['Authorization']).toBeUndefined();
  });
});

describe('API Client: Page-Level Auth Patterns', () => {
  it('should handle My Day page pattern: api.get(url, { token: accessToken! })', async () => {
    // Simulates the exact call pattern from my-day/page.tsx line 79
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: 'Invalid or expired token' }, 401));
    mockFetch.mockResolvedValueOnce(jsonResponse({ accessToken: 'refreshed', refreshToken: 'new-rt' }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ greeting: 'Good morning', date: '2026-04-05', dayQuality: 'good', summary: 'test' }));

    const result = await api.get('/daily-briefing', { token: 'expired-access-token' });

    expect(result).toHaveProperty('greeting');
    expect(mockFetch.mock.calls[1][0]).toContain('/auth/refresh');
  });

  it('should handle Profile page pattern: multiple api.get with token', async () => {
    // Profile page fires 3 parallel requests with explicit tokens
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ name: 'Test' }))
      .mockResolvedValueOnce(jsonResponse({ credits: 10 }))
      .mockResolvedValueOnce(jsonResponse({ hasPassword: true }));

    const [r1, r2, r3] = await Promise.all([
      api.get('/users/me', { token: 'tok' }),
      api.get('/users/me/credits', { token: 'tok' }),
      api.get('/auth/status', { token: 'tok' }),
    ]);

    expect(r1).toEqual({ name: 'Test' });
    expect(r2).toEqual({ credits: 10 });
    expect(r3).toEqual({ hasPassword: true });
  });
});
