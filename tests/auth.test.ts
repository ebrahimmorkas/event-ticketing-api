import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createUser, resetDb } from './helpers/db.js';

const app = createApp();
const credentials = { email: 'jane@example.com', name: 'Jane Doe', password: 'Secret123' };

describe('auth', () => {
  beforeEach(resetDb);

  it('registers a user and returns tokens without the password hash', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(credentials);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: credentials.email, role: 'CUSTOMER' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTypeOf('string');
    expect(res.body.refreshToken).toBeTypeOf('string');
  });

  it('rejects duplicate emails and weak passwords', async () => {
    await request(app).post('/api/v1/auth/register').send(credentials);
    const dup = await request(app).post('/api/v1/auth/register').send(credentials);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');

    const weak = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...credentials, email: 'x@example.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in and accesses /me', async () => {
    await request(app).post('/api/v1/auth/register').send(credentials);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    expect(login.status).toBe(200);

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(credentials.email);
  });

  it('rejects invalid credentials and missing tokens', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever1' });
    expect(login.status).toBe(401);

    const me = await request(app).get('/api/v1/auth/me');
    expect(me.status).toBe(401);
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(credentials);
    const first = reg.body.refreshToken;

    const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(first);

    // Reusing the old token revokes the whole token family.
    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(reuse.status).toBe(401);

    const afterReuse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it('revokes the refresh token on logout', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send(credentials);
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: reg.body.refreshToken });
    expect(logout.status).toBe(204);

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: reg.body.refreshToken });
    expect(refresh.status).toBe(401);
  });
});

describe('users (admin)', () => {
  beforeEach(resetDb);

  it('allows only admins to list users and change roles', async () => {
    const admin = await createUser('ADMIN');
    const customer = await createUser('CUSTOMER');

    const forbidden = await request(app).get('/api/v1/users').set(customer.auth);
    expect(forbidden.status).toBe(403);

    const list = await request(app).get('/api/v1/users?limit=10').set(admin.auth);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(2);

    const promote = await request(app)
      .patch(`/api/v1/users/${customer.user.id}/role`)
      .set(admin.auth)
      .send({ role: 'ORGANIZER' });
    expect(promote.status).toBe(200);
    expect(promote.body.user.role).toBe('ORGANIZER');
  });
});
