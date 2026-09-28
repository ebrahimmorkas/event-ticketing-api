import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  bookingIdParams,
  createBookingSchema,
  idempotencyKeySchema,
  listBookingsQuery,
  payBookingSchema,
  type ListBookingsQuery,
} from './bookings.schemas.js';
import * as bookings from './bookings.service.js';

export const bookingsRouter = Router();

bookingsRouter.use(authenticate);

/**
 * Supports the `Idempotency-Key` header: retrying a request with the same key
 * returns the original booking instead of reserving tickets twice.
 */
bookingsRouter.post('/', validate({ body: createBookingSchema }), async (req, res) => {
  const idempotencyKey = idempotencyKeySchema.parse(req.header('Idempotency-Key'));
  const { booking, replayed } = await bookings.createBooking(req.user!, req.body, idempotencyKey);
  if (replayed) res.setHeader('Idempotent-Replayed', 'true');
  res.status(replayed ? 200 : 201).json({ booking });
});

bookingsRouter.get('/', validate({ query: listBookingsQuery }), async (req, res) => {
  res.json(await bookings.listMyBookings(req.user!, req.query as unknown as ListBookingsQuery));
});

bookingsRouter.get('/:id', validate({ params: bookingIdParams }), async (req, res) => {
  res.json({ booking: await bookings.getBooking(req.user!, req.params.id as string) });
});

bookingsRouter.post(
  '/:id/pay',
  validate({ params: bookingIdParams, body: payBookingSchema }),
  async (req, res) => {
    const booking = await bookings.payBooking(
      req.user!,
      req.params.id as string,
      req.body.paymentMethod,
    );
    res.json({ booking });
  },
);

bookingsRouter.post('/:id/cancel', validate({ params: bookingIdParams }), async (req, res) => {
  res.json({ booking: await bookings.cancelBooking(req.user!, req.params.id as string) });
});

bookingsRouter.get('/:id/tickets', validate({ params: bookingIdParams }), async (req, res) => {
  res.json({ tickets: await bookings.getTickets(req.user!, req.params.id as string) });
});
