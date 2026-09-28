const DAY = 24 * 60 * 60 * 1000;

export const eventPayload = (overrides: Record<string, unknown> = {}) => ({
  title: 'Test Conference',
  description: 'All about testing',
  venue: 'Main Hall',
  city: 'Mumbai',
  startsAt: new Date(Date.now() + 10 * DAY).toISOString(),
  endsAt: new Date(Date.now() + 10 * DAY + 3_600_000).toISOString(),
  tiers: [
    { name: 'General', priceCents: 1000, capacity: 100 },
    { name: 'VIP', priceCents: 5000, capacity: 10 },
  ],
  ...overrides,
});
