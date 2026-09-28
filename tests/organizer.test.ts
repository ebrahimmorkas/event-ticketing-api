import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createUser, resetDb } from './helpers/db.js';
import { eventPayload } from './helpers/fixtures.js';

const app = createApp();

async function setupPurchasedTickets() {
  const organizer = await createUser('ORGANIZER');
  const customer = await createUser('CUSTOMER');
  const created = await request(app)
    .post('/api/v1/events')
    .set(organizer.auth)
    .send(eventPayload());
  const event = created.body.event;
  await request(app).post(`/api/v1/events/${event.id}/publish`).set(organizer.auth);

  const booking = await request(app)
    .post('/api/v1/bookings')
    .set(customer.auth)
    .send({ eventId: event.id, items: [{ tierId: event.tiers[0].id, quantity: 2 }] });
  await request(app)
    .post(`/api/v1/bookings/${booking.body.booking.id}/pay`)
    .set(customer.auth)
    .send({ paymentMethod: 'pm_card_visa' });
  const tickets = await request(app)
    .get(`/api/v1/bookings/${booking.body.booking.id}/tickets`)
    .set(customer.auth);

  return {
    organizer,
    customer,
    event,
    codes: tickets.body.tickets.map((t: { code: string }) => t.code),
  };
}

describe('organizer tools', () => {
  beforeEach(resetDb);

  it('checks a ticket in exactly once', async () => {
    const { organizer, codes } = await setupPurchasedTickets();

    const first = await request(app)
      .post('/api/v1/organizer/check-in')
      .set(organizer.auth)
      .send({ code: codes[0] });
    expect(first.status).toBe(200);
    expect(first.body.checkIn.tierName).toBe('General');

    const second = await request(app)
      .post('/api/v1/organizer/check-in')
      .set(organizer.auth)
      .send({ code: codes[0] });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_CHECKED_IN');
  });

  it('handles simultaneous scans of the same ticket', async () => {
    const { organizer, codes } = await setupPurchasedTickets();
    const scans = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/v1/organizer/check-in')
          .set(organizer.auth)
          .send({ code: codes[0] }),
      ),
    );
    expect(scans.filter((s) => s.status === 200)).toHaveLength(1);
  });

  it("rejects check-ins for another organizer's event", async () => {
    const { codes } = await setupPurchasedTickets();
    const stranger = await createUser('ORGANIZER');
    const res = await request(app)
      .post('/api/v1/organizer/check-in')
      .set(stranger.auth)
      .send({ code: codes[0] });
    expect(res.status).toBe(403);
  });

  it('reports sales and attendance stats', async () => {
    const { organizer, event, codes } = await setupPurchasedTickets();
    await request(app)
      .post('/api/v1/organizer/check-in')
      .set(organizer.auth)
      .send({ code: codes[0] });

    const res = await request(app)
      .get(`/api/v1/organizer/events/${event.id}/stats`)
      .set(organizer.auth);
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({
      capacity: 110,
      sold: 2,
      checkedIn: 1,
      revenueCents: 2000,
    });
    expect(res.body.bookings).toEqual({ CONFIRMED: 1 });
    expect(res.body.tiers[0]).toMatchObject({ name: 'General', sold: 2, available: 98 });
  });
});
