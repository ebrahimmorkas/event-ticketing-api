import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { vi } from 'vitest';
import { AuthProvider } from '@/features/auth/auth-context';

/** Renders routes inside the same providers the app uses, starting at `path`. */
export function renderRoutes(routes: RouteObject[], path = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}

export const renderPage = (element: ReactElement, path = '/') =>
  renderRoutes([{ path: '*', element }], path);

type Handler = (url: URL, init: RequestInit) => { status?: number; body?: unknown } | undefined;

/** Stubs `fetch` with a tiny router; unmatched requests fail the test loudly. */
export function mockFetch(handler: Handler) {
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const match = handler(url, init);
    if (!match) throw new Error(`Unexpected request: ${init.method ?? 'GET'} ${url.pathname}`);
    return new Response(match.body === undefined ? null : JSON.stringify(match.body), {
      status: match.status ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
