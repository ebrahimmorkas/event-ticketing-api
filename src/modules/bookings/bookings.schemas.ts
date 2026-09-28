import { z } from 'zod';

export const MAX_TICKETS_PER_TIER = 10;

export const createBookingSchema = z.object({
  eventId: z.uuid(),
  items: z
    .array(
      z.object({
        tierId: z.uuid(),
        quantity: z.number().int().min(1).max(MAX_TICKETS_PER_TIER),
      }),
    )
    .min(1)
    .max(20),
});

export const payBookingSchema = z.object({
  paymentMethod: z.string().min(1).max(100),
});

export const idempotencyKeySchema = z.string().trim().min(8).max(100).optional();

export const bookingIdParams = z.object({ id: z.uuid() });

export const listBookingsQuery = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuery>;
