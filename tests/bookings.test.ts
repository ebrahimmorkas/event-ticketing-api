import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { sweepExpiredBookings } from '../src/modules/bookings/bookings.service.js';
import { createUser, resetDb } from './helpers/db.js';
import { eventPayload } from './helpers/fixtures.js';

const app = createApp();

async function publishedEvent(tiers = [{ name: 'General', priceCents: 1000, capacity: 5 }]) {
  const organizer = await createUser('ORGANIZER');
  const created = await request(app)
    .post('/api/v1/events')
    .set(organizer.auth)
    .send(eventPayload({ tiers }));
  await request(app).post(`/api/v1/events/${created.body.event.id}/publish`).set(organizer.auth);
  const event = created.body.event;
  return { organizer, event, tierId: event.tiers[0].id as string };
}

async function tierState(tierId: string) {
  return prisma.ticketTier.findUniqueOrThrow({ where: { id: tierId } });
}

describe('bookings', () => {
  beforeEach(resetDb);

  it('reserves tickets, pays and issues QR tickets', async () => {
    const { event, tierId } = await publishedEvent();
    const customer = await createUser('CUSTOMER');

    const created = await request(app)
      .post('/api/v1/bookings')
      .set(customer.auth)
      .send({ eventId: event.id, items: [{ tierId, quantity: 2 }] });
    expect(created.status).toBe(201);
    expect(created.body.booking).toMatchObject({ status: 'PENDING', totalCents: 2000 });
    expect((await tierState(tierId)).reserved).toBe(2);

    const paid = await request(app)
      .post(`/api/v1/bookings/${created.body.booking.id}/pay`)
      .set(customer.auth)
      .send({ paymentMethod: 'pm_card_visa' });
    expect(paid.status).toBe(200);
    expect(paid.body.booking.status).toBe('CONFIRMED');
    expect((await tierState(tierId)).sold).toBe(2);

    const tickets = await request(app)
      .get(`/api/v1/bookings/${created.body.booking.id}/tickets`)
      .set(customer.auth);
    expect(tickets.status).toBe(200);
    expect(tickets.body.tickets).toHaveLength(2);
    expect(tickets.body.tickets[0].code).toMatch(/^TKT-[0-9A-F]{16}$/);
    expect(tickets.body.tickets[0].qrCode).toMatch(/^data:image\/png;base64,/);

    const again = await request(app)
      .post(`/api/v1/bookings/${created.body.booking.id}/pay`)
      .set(customer.auth)
      .send({ paymentMethod: 'pm_card_visa' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_PAID');
  });

  it('never oversells under concurrent load', async () => {
    const { event, tierId } = await publishedEvent();
    const buyers = await Promise.all(Array.from({ length: 20 }, () => createUser('CUSTOMER')));

    const results = await Promise.all(
      buyers.map((buyer) =>
        request(app)
          .post('/api/v1/bookings')
          .set(buyer.auth)
          .send({ eventId: event.id, items: [{ tierId, quantity: 1 }] }),
      ),
    );

    const succeeded = results.filter((r) => r.status === 201);
    const soldOut = results.filter((r) => r.status === 409);
    expect(succeeded).toHaveLength(5);
    expect(soldOut).toHaveLength(15);
    expect(soldOut.every((r) => r.body.error.code === 'SOLD_OUT')).toBe(true);
    expect((await tierState(tierId)).reserved).toBe(5);
  });

  it('replays the original booking for a repeated Idempotency-Key', async () => {
    const { event, tierId } = await publishedEvent();
    const customer = await createUser('CUSTOMER');
    const send = () =>
      request(app)
        .post('/api/v1/bookings')
        .set(customer.auth)
        .set('Idempotency-Key', 'checkout-attempt-42')
        .send({ eventId: event.id, items: [{ tierId, quantity: 1 }] });

    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.booking.id).toBe(first.body.booking.id);
    expect((await tierState(tierId)).reserved).toBe(1);
  });

  it('keeps the booking pending when payment is declined', async () => {
    const { event, tierId } = await publishedEvent();
    const customer = await createUser('CUSTOMER');
    const created = await request(app)
      .post('/api/v1/bookings')
      .set(customer.auth)
      .send({ eventId: event.id, items: [{ tierId, quantity: 1 }] });

    const declined = await request(app)
      .post(`/api/v1/bookings/${created.body.booking.id}/pay`)
      .set(customer.auth)
      .send({ paymentMethod: 'pm_card_declined' });
    expect(declined.status).toBe(402);
    expect(declined.body.error.code).toBe('PAYMENT_FAILED');

    const booking = await request(app)
      .get(`/api/v1/bookings/${created.body.booking.id}`)
      .set(customer.auth);
    expect(booking.body.booking.status).toBe('PENDING');
  });

  it('expires unpaid holds and releases their seats', async () => {
    const { event, tierId } = await publishedEvent();
    const customer = await createUser('CUSTOMER');
    const created = await request(app)
      .post('/api/v1/bookings')
      .set(customer.auth)
      .send({ eventId: event.id, items: [{ tierId, quantity: 3 }] });

    await prisma.booking.update({
      where: { id: created.body.booking.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await sweepExpiredBookings()).toBe(1);
    expect((await tierState(tierId)).reserved).toBe(0);

    const pay = await request(app)
      .post(`/api/v1/bookings/${created.body.booking.id}/pay`)
      .set(customer.auth)
      .send({ paymentMethod: 'pm_card_visa' });
    expect(pay.status).toBe(409);
  });

  it('cancels a confirmed booking and returns seats to inventory', async () => {
    const { event, tierId } = await publishedEvent();
    const customer = await createUser('CUSTOMER');
    const created = await request(app)
      .post('/api/v1/bookings')
      .set(customer.auth)
      .send({ eventId: event.id, items: [{ tierId, quantity: 2 }] });
    await request(app)
      .post(`/api/v1/bookings/${created.body.booking.id}/pay`)
      .set(customer.auth)
      .send({ paymentMethod: 'pm_card_visa' });

    const cancelled = await request(app)
      .post(`/api/v1/bookings/${created.body.booking.id}/cancel`)
      .set(customer.auth);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.booking.status).toBe('CANCELLED');

    const tier = await tierState(tierId);
    expect(tier.reserved).toBe(0);
    expect(tier.sold).toBe(0);
  });

  it("hides other users' bookings and rejects foreign tiers", async () => {
    const { event, tierId } = await publishedEvent();
    const other = await publishedEvent();
    const alice = await createUser('CUSTOMER');
    const bob = await createUser('CUSTOMER');

    const created = await request(app)
      .post('/api/v1/bookings')
      .set(alice.auth)
      .send({ eventId: event.id, items: [{ tierId, quantity: 1 }] });
    const peek = await request(app)
      .get(`/api/v1/bookings/${created.body.booking.id}`)
      .set(bob.auth);
    expect(peek.status).toBe(404);

    const foreign = await request(app)
      .post('/api/v1/bookings')
      .set(alice.auth)
      .send({ eventId: event.id, items: [{ tierId: other.tierId, quantity: 1 }] });
    expect(foreign.status).toBe(400);
  });

  it('lists the current user bookings', async () => {
    const { event, tierId } = await publishedEvent();
    const customer = await createUser('CUSTOMER');
    await request(app)
      .post('/api/v1/bookings')
      .set(customer.auth)
      .send({ eventId: event.id, items: [{ tierId, quantity: 1 }] });

    const list = await request(app).get('/api/v1/bookings?status=PENDING').set(customer.auth);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
  });
});
