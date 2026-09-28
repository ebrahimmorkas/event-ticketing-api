import type { Event, Prisma, TicketTier } from '@prisma/client';
import { cached, getCache } from '../../lib/cache.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../../types/express.js';
import type {
  CreateEventInput,
  ListEventsQuery,
  TierInput,
  UpdateEventInput,
} from './events.schemas.js';

export const EVENTS_CACHE_NS = 'events';
const LIST_TTL_SECONDS = 60;

const tiersInclude = { tiers: { orderBy: { priceCents: 'asc' } } } satisfies Prisma.EventInclude;

type EventWithTiers = Event & { tiers: TicketTier[] };

export function serializeTier(tier: TicketTier) {
  return {
    id: tier.id,
    name: tier.name,
    priceCents: tier.priceCents,
    capacity: tier.capacity,
    available: tier.capacity - tier.reserved,
  };
}

export function serializeEvent(event: EventWithTiers) {
  const { tiers, ...rest } = event;
  return { ...rest, tiers: tiers.map(serializeTier) };
}

const invalidateEvents = () => getCache().invalidate(EVENTS_CACHE_NS);

async function findEventOrThrow(id: string): Promise<EventWithTiers> {
  const event = await prisma.event.findUnique({ where: { id }, include: tiersInclude });
  if (!event) throw NotFound('Event');
  return event;
}

function assertCanManage(event: Event, user: AuthUser) {
  if (user.role !== 'ADMIN' && event.organizerId !== user.id) {
    throw Forbidden('Only the event organizer can manage this event');
  }
}

function assertNotCancelled(event: Event) {
  if (event.status === 'CANCELLED') throw Conflict('Event is cancelled', 'EVENT_CANCELLED');
}

export async function listPublishedEvents(query: ListEventsQuery) {
  return cached(EVENTS_CACHE_NS, `list:${JSON.stringify(query)}`, LIST_TTL_SECONDS, async () => {
    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      startsAt: { gte: query.from ?? new Date(), ...(query.to && { lte: query.to }) },
      ...(query.city && { city: { equals: query.city, mode: 'insensitive' } }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const direction = query.sort.startsWith('-') ? 'desc' : 'asc';
    const field = query.sort.replace('-', '') as 'startsAt' | 'createdAt';

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: tiersInclude,
        orderBy: { [field]: direction },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.event.count({ where }),
    ]);

    return {
      data: events.map(serializeEvent),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  });
}

export async function listOrganizerEvents(user: AuthUser) {
  const events = await prisma.event.findMany({
    where: { organizerId: user.id },
    include: tiersInclude,
    orderBy: { startsAt: 'asc' },
  });
  return events.map(serializeEvent);
}

export async function getEvent(id: string, user?: AuthUser) {
  const event = await findEventOrThrow(id);
  const isManager = user && (user.role === 'ADMIN' || user.id === event.organizerId);
  // Drafts are invisible to the public; respond 404 rather than leaking their existence.
  if (event.status === 'DRAFT' && !isManager) throw NotFound('Event');
  return serializeEvent(event);
}

export async function createEvent(input: CreateEventInput, user: AuthUser) {
  const { tiers, ...data } = input;
  const event = await prisma.event.create({
    data: { ...data, organizerId: user.id, tiers: { create: tiers } },
    include: tiersInclude,
  });
  return serializeEvent(event);
}

export async function updateEvent(id: string, input: UpdateEventInput, user: AuthUser) {
  const event = await findEventOrThrow(id);
  assertCanManage(event, user);
  assertNotCancelled(event);

  const startsAt = input.startsAt ?? event.startsAt;
  const endsAt = input.endsAt ?? event.endsAt;
  if (endsAt <= startsAt) throw BadRequest('endsAt must be after startsAt');

  const updated = await prisma.event.update({
    where: { id },
    data: input,
    include: tiersInclude,
  });
  await invalidateEvents();
  return serializeEvent(updated);
}

export async function publishEvent(id: string, user: AuthUser) {
  const event = await findEventOrThrow(id);
  assertCanManage(event, user);
  if (event.status !== 'DRAFT') throw Conflict('Only draft events can be published');
  if (event.tiers.length === 0) throw BadRequest('Add at least one ticket tier before publishing');
  if (event.startsAt <= new Date()) throw BadRequest('Cannot publish an event in the past');

  const updated = await prisma.event.update({
    where: { id },
    data: { status: 'PUBLISHED' },
    include: tiersInclude,
  });
  await invalidateEvents();
  return serializeEvent(updated);
}

/** Cancels the event and every active booking for it in a single transaction. */
export async function cancelEvent(id: string, user: AuthUser) {
  const event = await findEventOrThrow(id);
  assertCanManage(event, user);
  assertNotCancelled(event);

  const [updated, bookings] = await prisma.$transaction([
    prisma.event.update({ where: { id }, data: { status: 'CANCELLED' }, include: tiersInclude }),
    prisma.booking.updateMany({
      where: { eventId: id, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    }),
    prisma.ticketTier.updateMany({ where: { eventId: id }, data: { reserved: 0, sold: 0 } }),
  ]);
  await invalidateEvents();
  return { event: serializeEvent(updated), cancelledBookings: bookings.count };
}

export async function addTier(eventId: string, input: TierInput, user: AuthUser) {
  const event = await findEventOrThrow(eventId);
  assertCanManage(event, user);
  assertNotCancelled(event);
  if (event.tiers.some((t) => t.name.toLowerCase() === input.name.toLowerCase())) {
    throw Conflict('A tier with this name already exists');
  }

  const tier = await prisma.ticketTier.create({ data: { ...input, eventId } });
  await invalidateEvents();
  return serializeTier(tier);
}

export async function updateTier(
  eventId: string,
  tierId: string,
  input: Partial<TierInput>,
  user: AuthUser,
) {
  const event = await findEventOrThrow(eventId);
  assertCanManage(event, user);
  assertNotCancelled(event);

  const tier = event.tiers.find((t) => t.id === tierId);
  if (!tier) throw NotFound('Ticket tier');
  if (input.capacity !== undefined && input.capacity < tier.reserved) {
    throw Conflict(
      `Capacity cannot be lower than the ${tier.reserved} tickets already reserved`,
      'CAPACITY_BELOW_RESERVED',
    );
  }

  const updated = await prisma.ticketTier.update({ where: { id: tierId }, data: input });
  await invalidateEvents();
  return serializeTier(updated);
}
