import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createUser, resetDb } from './helpers/db.js';
import { eventPayload } from './helpers/fixtures.js';

const app = createApp();
describe('events', () => {
  beforeEach(resetDb);

  it('lets organizers create, publish and list events', async () => {
    const organizer = await createUser('ORGANIZER');

    const created = await request(app)
      .post('/api/v1/events')
      .set(organizer.auth)
      .send(eventPayload());
    expect(created.status).toBe(201);
    expect(created.body.event.status).toBe('DRAFT');
    expect(created.body.event.tiers).toHaveLength(2);
    expect(created.body.event.tiers[0]).toMatchObject({ name: 'General', available: 100 });

    // Drafts are hidden from the public listing and detail endpoint.
    const listBefore = await request(app).get('/api/v1/events');
    expect(listBefore.body.meta.total).toBe(0);
    const hidden = await request(app).get(`/api/v1/events/${created.body.event.id}`);
    expect(hidden.status).toBe(404);

    const published = await request(app)
      .post(`/api/v1/events/${created.body.event.id}/publish`)
      .set(organizer.auth);
    expect(published.status).toBe(200);
    expect(published.body.event.status).toBe('PUBLISHED');

    const listAfter = await request(app).get('/api/v1/events?city=mumbai&q=conf');
    expect(listAfter.status).toBe(200);
    expect(listAfter.body.meta.total).toBe(1);
  });

  it('forbids customers from creating events', async () => {
    const customer = await createUser('CUSTOMER');
    const res = await request(app).post('/api/v1/events').set(customer.auth).send(eventPayload());
    expect(res.status).toBe(403);
  });

  it('validates event dates and unique tier names', async () => {
    const organizer = await createUser('ORGANIZER');
    const badDates = await request(app)
      .post('/api/v1/events')
      .set(organizer.auth)
      .send(eventPayload({ endsAt: new Date(Date.now()).toISOString() }));
    expect(badDates.status).toBe(400);

    const dupTiers = await request(app)
      .post('/api/v1/events')
      .set(organizer.auth)
      .send(
        eventPayload({
          tiers: [
            { name: 'A', priceCents: 1, capacity: 1 },
            { name: 'a', priceCents: 1, capacity: 1 },
          ],
        }),
      );
    expect(dupTiers.status).toBe(400);
  });

  it('prevents other organizers from editing an event', async () => {
    const owner = await createUser('ORGANIZER');
    const other = await createUser('ORGANIZER');
    const created = await request(app).post('/api/v1/events').set(owner.auth).send(eventPayload());

    const res = await request(app)
      .patch(`/api/v1/events/${created.body.event.id}`)
      .set(other.auth)
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(403);
  });

  it('refuses to publish an event without tiers', async () => {
    const organizer = await createUser('ORGANIZER');
    const created = await request(app)
      .post('/api/v1/events')
      .set(organizer.auth)
      .send(eventPayload({ tiers: [] }));
    const res = await request(app)
      .post(`/api/v1/events/${created.body.event.id}/publish`)
      .set(organizer.auth);
    expect(res.status).toBe(400);
  });

  it('manages tiers and reflects updates in the cached listing', async () => {
    const organizer = await createUser('ORGANIZER');
    const created = await request(app)
      .post('/api/v1/events')
      .set(organizer.auth)
      .send(eventPayload());
    const id = created.body.event.id;
    await request(app).post(`/api/v1/events/${id}/publish`).set(organizer.auth);

    // Prime the cache.
    await request(app).get('/api/v1/events');

    const tier = await request(app)
      .post(`/api/v1/events/${id}/tiers`)
      .set(organizer.auth)
      .send({ name: 'Student', priceCents: 500, capacity: 20 });
    expect(tier.status).toBe(201);

    const list = await request(app).get('/api/v1/events');
    expect(list.body.data[0].tiers).toHaveLength(3);

    const updated = await request(app)
      .patch(`/api/v1/events/${id}/tiers/${tier.body.tier.id}`)
      .set(organizer.auth)
      .send({ capacity: 25 });
    expect(updated.status).toBe(200);
    expect(updated.body.tier.capacity).toBe(25);
  });

  it('cancels an event', async () => {
    const organizer = await createUser('ORGANIZER');
    const created = await request(app)
      .post('/api/v1/events')
      .set(organizer.auth)
      .send(eventPayload());
    const id = created.body.event.id;

    const res = await request(app).post(`/api/v1/events/${id}/cancel`).set(organizer.auth);
    expect(res.status).toBe(200);
    expect(res.body.event.status).toBe('CANCELLED');

    const edit = await request(app)
      .patch(`/api/v1/events/${id}`)
      .set(organizer.auth)
      .send({ title: 'Too late' });
    expect(edit.status).toBe(409);
  });
});
