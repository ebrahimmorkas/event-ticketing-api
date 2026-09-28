import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { env } from '../../config/env.js';
import { AppError, BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { getScheduler } from '../../lib/jobs.js';
import { logger } from '../../lib/logger.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import type { AuthUser } from '../../types/express.js';
import { paymentProvider } from '../payments/payment.provider.js';
import {
  MAX_TICKETS_PER_TIER,
  type CreateBookingInput,
  type ListBookingsQuery,
} from './bookings.schemas.js';

export const EXPIRE_BOOKING_JOB = 'expire-booking';
const CURRENCY = 'USD';

const bookingInclude = {
  items: { include: { tier: { select: { name: true } } } },
  event: { select: { id: true, title: true, venue: true, city: true, startsAt: true } },
} satisfies Prisma.BookingInclude;

type BookingWithRelations = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

function serializeBooking(booking: BookingWithRelations) {
  return {
    id: booking.id,
    status: booking.status,
    totalCents: booking.totalCents,
    currency: CURRENCY,
    expiresAt: booking.status === 'PENDING' ? booking.expiresAt : null,
    createdAt: booking.createdAt,
    confirmedAt: booking.confirmedAt,
    cancelledAt: booking.cancelledAt,
    event: booking.event,
    items: booking.items.map((item) => ({
      tierId: item.tierId,
      tierName: item.tier.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
  };
}

const generateTicketCode = () => `TKT-${randomBytes(8).toString('hex').toUpperCase()}`;

async function findBookingForUser(id: string, user: AuthUser) {
  const booking = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  // Other users' bookings are reported as missing to avoid leaking their existence.
  if (!booking || (booking.userId !== user.id && user.role !== 'ADMIN')) {
    throw NotFound('Booking');
  }
  return booking;
}

async function findByIdempotencyKey(userId: string, idempotencyKey: string) {
  return prisma.booking.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    include: bookingInclude,
  });
}

async function releaseSeats(tx: Tx, bookingId: string, wasConfirmed: boolean) {
  const items = await tx.bookingItem.findMany({ where: { bookingId } });
  for (const item of items) {
    await tx.ticketTier.update({
      where: { id: item.tierId },
      data: {
        reserved: { decrement: item.quantity },
        ...(wasConfirmed && { sold: { decrement: item.quantity } }),
      },
    });
  }
}

/**
 * Reserves tickets and creates a PENDING booking that holds them for
 * BOOKING_HOLD_MINUTES.
 *
 * Overselling is prevented by a single conditional UPDATE per tier
 * (`reserved + n <= capacity`), which Postgres executes atomically under a row
 * lock, so concurrent buyers can never push a tier past capacity. Tiers are
 * locked in a stable order to avoid deadlocks between multi-tier bookings.
 */
export async function createBooking(
  user: AuthUser,
  input: CreateBookingInput,
  idempotencyKey?: string,
) {
  if (idempotencyKey) {
    const existing = await findByIdempotencyKey(user.id, idempotencyKey);
    if (existing) return { booking: serializeBooking(existing), replayed: true };
  }

  const quantities = new Map<string, number>();
  for (const { tierId, quantity } of input.items) {
    quantities.set(tierId, (quantities.get(tierId) ?? 0) + quantity);
  }
  for (const quantity of quantities.values()) {
    if (quantity > MAX_TICKETS_PER_TIER) {
      throw BadRequest(`At most ${MAX_TICKETS_PER_TIER} tickets per tier per booking`);
    }
  }

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    include: { tiers: { select: { id: true } } },
  });
  if (!event || event.status !== 'PUBLISHED') throw NotFound('Event');
  if (event.startsAt <= new Date()) throw Conflict('Event has already started', 'EVENT_STARTED');

  const eventTierIds = new Set(event.tiers.map((t) => t.id));
  const unknownTier = [...quantities.keys()].find((id) => !eventTierIds.has(id));
  if (unknownTier) throw BadRequest(`Tier ${unknownTier} does not belong to this event`);

  const orderedItems = [...quantities.entries()].sort(([a], [b]) => a.localeCompare(b));
  const expiresAt = new Date(Date.now() + env.BOOKING_HOLD_MINUTES * 60_000);

  let booking: BookingWithRelations;
  try {
    booking = await prisma.$transaction(async (tx) => {
      const lines: { tierId: string; quantity: number; unitPriceCents: number }[] = [];

      for (const [tierId, quantity] of orderedItems) {
        const rows = await tx.$queryRaw<{ name: string; priceCents: number }[]>`
          UPDATE "ticket_tiers"
          SET "reserved" = "reserved" + ${quantity}
          WHERE "id" = ${tierId}
            AND "eventId" = ${event.id}
            AND "reserved" + ${quantity} <= "capacity"
          RETURNING "name", "priceCents"`;
        const tier = rows[0];
        if (!tier) throw Conflict('Not enough tickets available for the selected tier', 'SOLD_OUT');
        lines.push({ tierId, quantity, unitPriceCents: tier.priceCents });
      }

      return tx.booking.create({
        data: {
          userId: user.id,
          eventId: event.id,
          totalCents: lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0),
          expiresAt,
          idempotencyKey,
          items: { create: lines },
        },
        include: bookingInclude,
      });
    });
  } catch (err) {
    // Two concurrent requests with the same idempotency key: the loser returns the winner's booking.
    if (
      idempotencyKey &&
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const existing = await findByIdempotencyKey(user.id, idempotencyKey);
      if (existing) return { booking: serializeBooking(existing), replayed: true };
    }
    throw err;
  }

  try {
    await getScheduler().schedule(
      EXPIRE_BOOKING_JOB,
      { bookingId: booking.id },
      expiresAt,
      `expire:${booking.id}`,
    );
  } catch (err) {
    // Not fatal: the periodic sweeper will still expire the hold.
    logger.error({ err, bookingId: booking.id }, 'failed to schedule booking expiry');
  }

  return { booking: serializeBooking(booking), replayed: false };
}

export async function payBooking(user: AuthUser, id: string, paymentMethod: string) {
  const booking = await findBookingForUser(id, user);
  if (booking.userId !== user.id) throw NotFound('Booking');
  if (booking.status === 'CONFIRMED') throw Conflict('Booking is already paid', 'ALREADY_PAID');
  if (booking.status !== 'PENDING') {
    throw Conflict(`Booking is ${booking.status.toLowerCase()}`, 'BOOKING_NOT_PENDING');
  }
  if (booking.expiresAt <= new Date()) {
    await expireBooking(id);
    throw Conflict('Booking hold has expired', 'BOOKING_EXPIRED');
  }

  const charge = await paymentProvider.charge({
    amountCents: booking.totalCents,
    currency: CURRENCY,
    paymentMethod,
    reference: booking.id,
  });
  if (!charge.success) throw new AppError(402, charge.reason, 'PAYMENT_FAILED');

  try {
    const confirmed = await prisma.$transaction(async (tx) => {
      // Conditional transition guards against double payment and against a
      // concurrent expiry/cancellation that happened while we were charging.
      const { count } = await tx.booking.updateMany({
        where: { id, status: 'PENDING', expiresAt: { gt: new Date() } },
        data: { status: 'CONFIRMED', confirmedAt: new Date(), paymentRef: charge.paymentRef },
      });
      if (count === 0) throw Conflict('Booking is no longer payable', 'BOOKING_NOT_PENDING');

      for (const item of booking.items) {
        await tx.ticketTier.update({
          where: { id: item.tierId },
          data: { sold: { increment: item.quantity } },
        });
      }

      await tx.ticket.createMany({
        data: booking.items.flatMap((item) =>
          Array.from({ length: item.quantity }, () => ({
            bookingId: id,
            tierId: item.tierId,
            code: generateTicketCode(),
          })),
        ),
      });

      return tx.booking.findUniqueOrThrow({ where: { id }, include: bookingInclude });
    });
    return serializeBooking(confirmed);
  } catch (err) {
    await paymentProvider.refund(charge.paymentRef);
    throw err;
  }
}

export async function cancelBooking(user: AuthUser, id: string) {
  const booking = await findBookingForUser(id, user);
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
    throw Conflict(`Booking is already ${booking.status.toLowerCase()}`, 'BOOKING_NOT_ACTIVE');
  }
  const wasConfirmed = booking.status === 'CONFIRMED';
  if (wasConfirmed && booking.event.startsAt <= new Date()) {
    throw Conflict('Bookings cannot be cancelled after the event has started', 'EVENT_STARTED');
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const { count } = await tx.booking.updateMany({
      where: { id, status: booking.status },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    if (count === 0) throw Conflict('Booking changed concurrently, please retry', 'CONFLICT');
    await releaseSeats(tx, id, wasConfirmed);
    return tx.booking.findUniqueOrThrow({ where: { id }, include: bookingInclude });
  });

  if (wasConfirmed && booking.paymentRef) await paymentProvider.refund(booking.paymentRef);
  return serializeBooking(cancelled);
}

/** Expires a PENDING booking whose hold has lapsed and releases its seats. Idempotent. */
export async function expireBooking(id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.booking.updateMany({
      where: { id, status: 'PENDING', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED' },
    });
    if (count === 0) return false;
    await releaseSeats(tx, id, false);
    return true;
  });
}

/** Safety net for holds whose scheduled job was lost (e.g. process restart without Redis). */
export async function sweepExpiredBookings(batchSize = 100): Promise<number> {
  const stale = await prisma.booking.findMany({
    where: { status: 'PENDING', expiresAt: { lte: new Date() } },
    select: { id: true },
    take: batchSize,
  });
  let expired = 0;
  for (const { id } of stale) {
    if (await expireBooking(id)) expired += 1;
  }
  if (expired > 0) logger.info({ expired }, 'expired stale booking holds');
  return expired;
}

export async function listMyBookings(user: AuthUser, query: ListBookingsQuery) {
  const where: Prisma.BookingWhereInput = {
    userId: user.id,
    ...(query.status && { status: query.status }),
  };
  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.booking.count({ where }),
  ]);
  return {
    data: bookings.map(serializeBooking),
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getBooking(user: AuthUser, id: string) {
  return serializeBooking(await findBookingForUser(id, user));
}

export async function getTickets(user: AuthUser, id: string) {
  const booking = await findBookingForUser(id, user);
  if (booking.status !== 'CONFIRMED') {
    throw Conflict('Tickets are only available for confirmed bookings', 'BOOKING_NOT_CONFIRMED');
  }
  const tickets = await prisma.ticket.findMany({
    where: { bookingId: id },
    include: { tier: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return Promise.all(
    tickets.map(async (ticket) => ({
      id: ticket.id,
      code: ticket.code,
      tierName: ticket.tier.name,
      checkedInAt: ticket.checkedInAt,
      qrCode: await QRCode.toDataURL(ticket.code),
    })),
  );
}
