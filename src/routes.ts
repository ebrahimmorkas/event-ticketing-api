import { Router } from 'express';
import { env } from './config/env.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { bookingsRouter } from './modules/bookings/bookings.routes.js';
import { eventsRouter } from './modules/events/events.routes.js';
import { organizerRouter } from './modules/organizer/organizer.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

export function createApiRouter() {
  const router = Router();

  router.use(
    createRateLimiter({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      prefix: 'api',
    }),
  );

  // Stricter limit on credential endpoints to slow down brute-force attempts.
  const authLimiter = createRateLimiter({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    prefix: 'auth',
  });

  router.use('/auth', authLimiter, authRouter);
  router.use('/users', usersRouter);
  router.use('/events', eventsRouter);
  router.use('/bookings', bookingsRouter);
  router.use('/organizer', organizerRouter);

  return router;
}
