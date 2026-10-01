import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tokens } from '@/lib/api';
import { mockFetch, renderRoutes } from '@/test/utils';
import { LoginPage } from './LoginPage';

const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/events', element: <p>Events page</p> },
];

afterEach(() => {
  tokens.access = null;
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('validates the form before calling the API', async () => {
    const fetch = mockFetch(() => undefined);
    renderRoutes(routes, '/login');

    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the server error for bad credentials', async () => {
    mockFetch(() => ({
      status: 401,
      body: { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } },
    }));
    renderRoutes(routes, '/login');

    await userEvent.type(screen.getByLabelText('Email'), 'nobody@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('logs in with a demo account and redirects', async () => {
    mockFetch((url, init) => {
      expect(url.pathname).toBe('/api/v1/auth/login');
      expect(JSON.parse(String(init.body))).toMatchObject({ email: 'organizer@example.com' });
      return {
        body: {
          user: { id: '1', email: 'organizer@example.com', name: 'Olivia', role: 'ORGANIZER' },
          accessToken: 'a',
          refreshToken: 'r',
        },
      };
    });
    renderRoutes(routes, '/login');

    await userEvent.click(screen.getByRole('button', { name: /organizer/i }));

    expect(await screen.findByText('Events page')).toBeInTheDocument();
    expect(tokens.refresh).toBe('r');
  });
});
