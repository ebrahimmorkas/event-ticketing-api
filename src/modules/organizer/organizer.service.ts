import { Conflict, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../../types/express.js';

function assertOrganizerOf(organizerId: string, user: AuthUser) {
  if (user.role !== 'ADMIN' && organizerId !== user.id) {
    throw Forbidden('This ticket is not for one of your events');
  }
}

/**
 * Validates a ticket at the venue door. The conditional update makes a ticket
 * scannable exactly once, even if two gates scan it at the same moment.
 */
export async function checkInTicket(code: string, user: AuthUser) {
  const ticket = await prisma.ticket.findUnique({
    where: { code },
    include: {
      tier: { select: { name: true } },
      booking: {
        select: {
          status: true,
          user: { select: { name: true, email: true } },
          event: { select: { id: true, title: true, organizerId: true, status: true } },
        },
      },
    },
  });
  if (!ticket) throw NotFound('Ticket');

  const { booking } = ticket;
  assertOrganizerOf(booking.event.organizerId, user);
  if (booking.event.status === 'CANCELLED') throw Conflict('Event is cancelled', 'EVENT_CANCELLED');
  if (booking.status !== 'CONFIRMED') throw Conflict('Ticket is not valid', 'TICKET_INVALID');

  const checkedInAt = new Date();
  const { count } = await prisma.ticket.updateMany({
    where: { id: ticket.id, checkedInAt: null },
    data: { checkedInAt },
  });
  if (count === 0) {
    const current = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    throw Conflict(
      `Ticket already checked in at ${current.checkedInAt?.toISOString()}`,
      'ALREADY_CHECKED_IN',
    );
  }

  return {
    code: ticket.code,
    tierName: ticket.tier.name,
    attendee: booking.user,
    event: { id: booking.event.id, title: booking.event.title },
    checkedInAt,
  };
}

export async function getEventStats(eventId: string, user: AuthUser) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { tiers: { orderBy: { priceCents: 'asc' } } },
  });
  if (!event) throw NotFound('Event');
  assertOrganizerOf(event.organizerId, user);

  const [bookingsByStatus, revenue, checkIns] = await Promise.all([
    prisma.booking.groupBy({ by: ['status'], where: { eventId }, _count: { _all: true } }),
    prisma.booking.aggregate({
      where: { eventId, status: 'CONFIRMED' },
      _sum: { totalCents: true },
    }),
    prisma.ticket.groupBy({
      by: ['tierId'],
      where: { tier: { eventId }, checkedInAt: { not: null }, booking: { status: 'CONFIRMED' } },
      _count: { _all: true },
    }),
  ]);

  const checkInsByTier = new Map(checkIns.map((c) => [c.tierId, c._count._all]));
  const tiers = event.tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    priceCents: tier.priceCents,
    capacity: tier.capacity,
    held: tier.reserved - tier.sold,
    sold: tier.sold,
    available: tier.capacity - tier.reserved,
    checkedIn: checkInsByTier.get(tier.id) ?? 0,
    revenueCents: tier.sold * tier.priceCents,
  }));

  const totalCapacity = tiers.reduce((sum, t) => sum + t.capacity, 0);
  const totalSold = tiers.reduce((sum, t) => sum + t.sold, 0);

  return {
    event: { id: event.id, title: event.title, status: event.status, startsAt: event.startsAt },
    totals: {
      capacity: totalCapacity,
      sold: totalSold,
      checkedIn: tiers.reduce((sum, t) => sum + t.checkedIn, 0),
      sellThroughRate: totalCapacity === 0 ? 0 : Number((totalSold / totalCapacity).toFixed(4)),
      revenueCents: revenue._sum.totalCents ?? 0,
    },
    bookings: Object.fromEntries(bookingsByStatus.map((b) => [b.status, b._count._all])),
    tiers,
  };
}
