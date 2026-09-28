import { getScheduler } from '../lib/jobs.js';
import { logger } from '../lib/logger.js';
import {
  EXPIRE_BOOKING_JOB,
  expireBooking,
  sweepExpiredBookings,
} from '../modules/bookings/bookings.service.js';

const SWEEP_INTERVAL_MS = 30_000;
let sweeper: NodeJS.Timeout | undefined;

export async function startJobs() {
  const scheduler = getScheduler();

  scheduler.register(EXPIRE_BOOKING_JOB, async ({ bookingId }) => {
    if (bookingId) await expireBooking(bookingId);
  });
  await scheduler.start();

  sweeper = setInterval(() => {
    sweepExpiredBookings().catch((err) => logger.error({ err }, 'booking sweep failed'));
  }, SWEEP_INTERVAL_MS);
  sweeper.unref();

  // Catch up on anything that expired while the service was down.
  await sweepExpiredBookings();
}

export async function stopJobs() {
  clearInterval(sweeper);
  await getScheduler().close();
}
