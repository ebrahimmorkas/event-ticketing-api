import { randomBytes } from 'node:crypto';
import { PrismaClient, Role, type EventStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function upsertUser(email: string, name: string, role: Role) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, passwordHash },
  });
}

/** `days` from now at a fixed local hour, so seeded dates look realistic. */
function startTime(days: number, hour: number) {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
}

interface SeedEvent {
  title: string;
  description: string;
  venue: string;
  city: string;
  inDays: number;
  /** Local start hour; evening events by default. */
  startHour?: number;
  hours: number;
  status?: EventStatus;
  tiers: { name: string; priceCents: number; capacity: number }[];
}

const EVENTS: SeedEvent[] = [
  {
    title: 'Node.js Conf 2026',
    description:
      'A full-day conference on modern Node.js backends: performance, observability, TypeScript at scale and running Node in production.\n\nIncludes lunch and an evening networking session.',
    venue: 'Expo Centre, Hall 3',
    city: 'Mumbai',
    inDays: 30,
    startHour: 9,
    hours: 9,
    tiers: [
      { name: 'General', priceCents: 4999, capacity: 300 },
      { name: 'VIP', priceCents: 14999, capacity: 50 },
    ],
  },
  {
    title: 'Indie Music Night',
    description: 'Live performances from five local indie bands. Doors open at 6:30pm.',
    venue: 'The Blue Frog',
    city: 'Pune',
    inDays: 14,
    hours: 4,
    tiers: [{ name: 'Standing', priceCents: 1500, capacity: 150 }],
  },
  {
    title: 'React Summit India',
    description:
      'Two tracks of talks on React 19, Server Components, design systems and frontend testing, plus hands-on workshops.',
    venue: 'Bangalore International Exhibition Centre',
    city: 'Bengaluru',
    inDays: 45,
    startHour: 9,
    hours: 10,
    tiers: [
      { name: 'Early bird', priceCents: 2999, capacity: 100 },
      { name: 'Regular', priceCents: 5999, capacity: 400 },
      { name: 'Workshop pass', priceCents: 12999, capacity: 40 },
    ],
  },
  {
    title: 'Stand-up Comedy Special',
    description: 'An evening of brand-new material from three touring comedians. 18+ only.',
    venue: 'Canvas Laugh Club',
    city: 'Mumbai',
    inDays: 6,
    hours: 2,
    tiers: [
      { name: 'Silver', priceCents: 999, capacity: 120 },
      { name: 'Gold (front rows)', priceCents: 1999, capacity: 8 },
    ],
  },
  {
    title: 'Startup Pitch Night',
    description:
      'Ten early-stage founders pitch to a panel of investors. Free to attend — registration required.',
    venue: 'WeWork Galaxy',
    city: 'Bengaluru',
    inDays: 10,
    hours: 3,
    tiers: [{ name: 'Free entry', priceCents: 0, capacity: 80 }],
  },
  {
    title: 'Jazz by the Lake',
    description: 'An open-air jazz evening with food stalls and a sunset set by the lake.',
    venue: 'Lakeside Amphitheatre',
    city: 'Udaipur',
    inDays: 21,
    hours: 5,
    tiers: [
      { name: 'Lawn', priceCents: 1200, capacity: 500 },
      { name: 'Reserved seating', priceCents: 3500, capacity: 100 },
    ],
  },
  {
    title: 'Data Engineering Meetup',
    description: 'Talks on streaming pipelines, PostgreSQL internals and lakehouse architectures.',
    venue: 'Thoughtworks Office',
    city: 'Pune',
    inDays: 3,
    hours: 3,
    tiers: [{ name: 'Attendee', priceCents: 0, capacity: 60 }],
  },
  {
    title: 'Marathon Expo 2026',
    description: 'Collect your race kit, meet sponsors and attend nutrition and training clinics.',
    venue: 'Jawaharlal Nehru Stadium',
    city: 'Delhi',
    inDays: 60,
    startHour: 9,
    hours: 8,
    tiers: [{ name: 'Visitor', priceCents: 500, capacity: 2000 }],
  },
  {
    title: 'Photography Walk: Old City',
    description: 'A guided three-hour photo walk through heritage lanes. Bring any camera.',
    venue: 'Meet at Charminar gate',
    city: 'Hyderabad',
    inDays: 9,
    startHour: 7,
    hours: 3,
    tiers: [{ name: 'Walker', priceCents: 1800, capacity: 25 }],
  },
  {
    title: 'Winter Food Festival (draft)',
    description: 'Still planning the vendor list — not visible to the public until published.',
    venue: 'Phoenix Marketcity',
    city: 'Chennai',
    inDays: 75,
    startHour: 11,
    hours: 6,
    status: 'DRAFT',
    tiers: [{ name: 'Entry', priceCents: 300, capacity: 1000 }],
  },
];

const ticketCode = () => `TKT-${randomBytes(8).toString('hex').toUpperCase()}`;

/** Creates a paid booking, keeping the tier counters consistent with the API's invariants. */
async function seedConfirmedBooking(
  userId: string,
  eventId: string,
  tier: { id: string; priceCents: number },
  quantity: number,
  checkedIn = 0,
) {
  await prisma.$transaction(async (tx) => {
    await tx.ticketTier.update({
      where: { id: tier.id },
      data: { reserved: { increment: quantity }, sold: { increment: quantity } },
    });
    await tx.booking.create({
      data: {
        userId,
        eventId,
        status: 'CONFIRMED',
        totalCents: tier.priceCents * quantity,
        expiresAt: new Date(),
        confirmedAt: new Date(),
        paymentRef: `seed_${randomBytes(6).toString('hex')}`,
        items: { create: [{ tierId: tier.id, quantity, unitPriceCents: tier.priceCents }] },
        tickets: {
          create: Array.from({ length: quantity }, (_, i) => ({
            tierId: tier.id,
            code: ticketCode(),
            checkedInAt: i < checkedIn ? new Date() : null,
          })),
        },
      },
    });
  });
}

async function main() {
  await upsertUser('admin@example.com', 'Admin', Role.ADMIN);
  const organizer = await upsertUser('organizer@example.com', 'Olivia Organizer', Role.ORGANIZER);
  const customer = await upsertUser('customer@example.com', 'Chris Customer', Role.CUSTOMER);
  const buyers = await Promise.all(
    ['Aisha Khan', 'Rahul Mehta', 'Priya Nair', 'Sam Fernandes'].map((name) =>
      upsertUser(`${name.split(' ')[0]!.toLowerCase()}@example.com`, name, Role.CUSTOMER),
    ),
  );

  const existing = await prisma.event.count({ where: { organizerId: organizer.id } });
  if (existing > 0) {
    console.log('Seed data already present, skipping events.');
    return;
  }

  const created = [];
  for (const event of EVENTS) {
    const startsAt = startTime(event.inDays, event.startHour ?? 19);
    created.push(
      await prisma.event.create({
        data: {
          organizerId: organizer.id,
          title: event.title,
          description: event.description,
          venue: event.venue,
          city: event.city,
          startsAt,
          endsAt: new Date(startsAt.getTime() + event.hours * HOUR),
          status: event.status ?? 'PUBLISHED',
          tiers: { create: event.tiers },
        },
        include: { tiers: { orderBy: { priceCents: 'asc' } } },
      }),
    );
  }

  // Some sales so the organizer dashboard and stats have something to show.
  const [nodeConf, indieNight, , comedy] = created;
  await seedConfirmedBooking(customer.id, nodeConf!.id, nodeConf!.tiers[0]!, 2);
  await seedConfirmedBooking(customer.id, indieNight!.id, indieNight!.tiers[0]!, 1);
  for (const [i, buyer] of buyers.entries()) {
    await seedConfirmedBooking(buyer.id, nodeConf!.id, nodeConf!.tiers[i % 2]!, i + 1, i);
    await seedConfirmedBooking(buyer.id, comedy!.id, comedy!.tiers[1]!, 1);
  }

  console.log('Seed complete. All seeded users use password: Password123!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
