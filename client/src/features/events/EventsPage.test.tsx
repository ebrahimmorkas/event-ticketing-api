import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Event } from '@/lib/types';
import { mockFetch, renderPage } from '@/test/utils';
import { EventsPage } from './EventsPage';

const event = (overrides: Partial<Event>): Event => ({
  id: crypto.randomUUID(),
  organizerId: 'o1',
  title: 'Event',
  description: '',
  venue: 'Hall',
  city: 'Pune',
  startsAt: '2030-01-01T18:00:00.000Z',
  endsAt: '2030-01-01T21:00:00.000Z',
  status: 'PUBLISHED',
  createdAt: '',
  updatedAt: '',
  tiers: [{ id: 't1', name: 'GA', priceCents: 1500, capacity: 100, available: 5 }],
  ...overrides,
});

const page = (data: Event[]) => ({
  body: { data, meta: { page: 1, limit: 9, total: data.length, totalPages: 1 } },
});

afterEach(() => vi.unstubAllGlobals());

describe('EventsPage', () => {
  it('lists events with price and scarcity badges', async () => {
    mockFetch(() =>
      page([event({ title: 'Jazz Night' }), event({ title: 'Free Meetup', tiers: [] })]),
    );
    renderPage(<EventsPage />, '/events');

    expect(await screen.findByRole('link', { name: 'Jazz Night' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/events\//),
    );
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.getByText('5 left')).toBeInTheDocument();
    expect(screen.getByText('No tickets yet')).toBeInTheDocument();
  });

  it('sends the search term to the API after typing stops', async () => {
    const fetch = mockFetch(() => page([]));
    renderPage(<EventsPage />, '/events');
    await screen.findByText('No events found');

    await userEvent.type(screen.getByLabelText('Search events'), 'rock');

    await vi.waitFor(() => {
      const urls = fetch.mock.calls.map(([url]) => String(url));
      expect(urls.at(-1)).toContain('q=rock');
    });
    expect(
      await screen.findByText('Try a different search or clear the filters.'),
    ).toBeInTheDocument();
  });

  it('shows an error with a retry button when the API fails', async () => {
    mockFetch(() => ({ status: 500, body: { error: { message: 'Database unavailable' } } }));
    renderPage(<EventsPage />, '/events');

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
