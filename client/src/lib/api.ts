import type { AuthResponse } from './types';

/** Empty in development: requests go to the Vite dev server, which proxies `/api`. */
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const REFRESH_KEY = 'gatepass.refreshToken';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type SessionListener = (session: AuthResponse | null) => void;

/**
 * Keeps the short-lived access token in memory only; the refresh token is
 * persisted so a reload does not log the user out.
 */
export const tokens = {
  access: null as string | null,
  listeners: new Set<SessionListener>(),

  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(session: AuthResponse) {
    this.access = session.accessToken;
    localStorage.setItem(REFRESH_KEY, session.refreshToken);
    this.listeners.forEach((l) => l(session));
  },
  clear() {
    this.access = null;
    localStorage.removeItem(REFRESH_KEY);
    this.listeners.forEach((l) => l(null));
  },
  subscribe(listener: SessionListener) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  },
};

let refreshInFlight: Promise<AuthResponse | null> | null = null;

/**
 * Rotates the refresh token. The API treats a reused refresh token as theft and
 * revokes every session, so refreshes must never run concurrently: requests in
 * this tab share one in-flight promise, and a Web Lock serialises other tabs.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshInFlight ??= withLock(async () => {
    // Read inside the lock: another tab may have rotated the token meanwhile.
    const refreshToken = tokens.refresh;
    if (!refreshToken) return null;
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      if (tokens.refresh === refreshToken) tokens.clear();
      return null;
    }
    const session = (await res.json()) as AuthResponse;
    tokens.set(session);
    return session;
  }).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('gatepass-refresh', fn);
  }
  return fn();
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = { ...options.headers };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
    return fetch(`${API_URL}/api/v1${path}${toQueryString(options.query)}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  };

  let res = await send();
  if (res.status === 401 && tokens.refresh) {
    const session = await refreshSession();
    if (session) res = await send();
  }
  return parse<T>(res);
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const error = body?.error ?? {};
    throw new ApiError(
      res.status,
      error.message ?? `Request failed with status ${res.status}`,
      error.code,
      error.details,
    );
  }
  return body as T;
}

function toQueryString(query: RequestOptions['query']) {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Human-readable message for any error thrown by a query or mutation. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
      const first = error.details[0] as { path?: string; message?: string } | undefined;
      if (first?.message) return first.path ? `${first.path}: ${first.message}` : first.message;
    }
    return error.message;
  }
  if (error instanceof TypeError) return 'Cannot reach the server. Is the API running?';
  return error instanceof Error ? error.message : 'Something went wrong';
}
