import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockFetch } from '@/test/utils';
import { api, ApiError, errorMessage, tokens } from './api';

const session = (n: number) => ({
  user: { id: 'u1', email: 'a@b.c', name: 'A', role: 'CUSTOMER' as const, createdAt: '' },
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
});

afterEach(() => {
  tokens.access = null;
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('sends the bearer token and serialises the query string', async () => {
    tokens.access = 'abc';
    const fetch = mockFetch(() => ({ body: { ok: true } }));

    await api('/events', { query: { q: 'jazz', city: undefined, page: 2 } });

    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe('/api/v1/events?q=jazz&page=2');
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer abc');
  });

  it('turns the API error envelope into an ApiError', async () => {
    mockFetch(() => ({ status: 409, body: { error: { code: 'SOLD_OUT', message: 'Sold out' } } }));

    const error = await api('/bookings', { method: 'POST', body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'SOLD_OUT', message: 'Sold out' });
  });

  it('refreshes once on 401 and retries, even for parallel requests', async () => {
    tokens.set(session(1));
    tokens.access = 'expired';
    let refreshes = 0;
    mockFetch((url, init) => {
      if (url.pathname.endsWith('/auth/refresh')) {
        refreshes += 1;
        expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'refresh-1' });
        return { body: session(2) };
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer access-2' ? { body: { ok: true } } : { status: 401, body: {} };
    });

    const results = await Promise.all([api('/a'), api('/b'), api('/c')]);

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshes).toBe(1);
    expect(tokens.refresh).toBe('refresh-2');
  });

  it('clears the session when the refresh token is rejected', async () => {
    tokens.set(session(1));
    const listener = vi.fn();
    tokens.subscribe(listener);
    mockFetch(() => ({
      status: 401,
      body: { error: { message: 'Refresh token has been revoked' } },
    }));

    await expect(api('/bookings')).rejects.toMatchObject({ status: 401 });
    expect(tokens.refresh).toBeNull();
    expect(listener).toHaveBeenCalledWith(null);
  });
});

describe('errorMessage', () => {
  it('surfaces the first validation issue', () => {
    const error = new ApiError(400, 'Request validation failed', 'VALIDATION_ERROR', [
      { path: 'email', message: 'Invalid email' },
    ]);
    expect(errorMessage(error)).toBe('email: Invalid email');
  });

  it('explains network failures', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/cannot reach the server/i);
  });
});
