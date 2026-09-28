import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

async function upsertUser(email: string, name: string, role: Role) {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, passwordHash },
  });
}

async function main() {
  await upsertUser('admin@example.com', 'Admin', Role.ADMIN);
  const organizer = await upsertUser('organizer@example.com', 'Olivia Organizer', Role.ORGANIZER);
  await upsertUser('customer@example.com', 'Chris Customer', Role.CUSTOMER);

  const existing = await prisma.event.count({ where: { organizerId: organizer.id } });
  if (existing > 0) {
    console.log('Seed data already present, skipping events.');
    return;
  }

  await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Node.js Conf 2026',
      description: 'A full-day conference on modern Node.js backends.',
      venue: 'Expo Centre, Hall 3',
      city: 'Mumbai',
      startsAt: new Date(Date.now() + 30 * DAY),
      endsAt: new Date(Date.now() + 30 * DAY + 8 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      tiers: {
        create: [
          { name: 'General', priceCents: 4999, capacity: 300 },
          { name: 'VIP', priceCents: 14999, capacity: 50 },
        ],
      },
    },
  });

  await prisma.event.create({
    data: {
      organizerId: organizer.id,
      title: 'Indie Music Night',
      description: 'Live performances from local indie bands.',
      venue: 'The Blue Frog',
      city: 'Pune',
      startsAt: new Date(Date.now() + 14 * DAY),
      endsAt: new Date(Date.now() + 14 * DAY + 4 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      tiers: { create: [{ name: 'Standing', priceCents: 1500, capacity: 150 }] },
    },
  });

  console.log('Seed complete. All seeded users use password: Password123!');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
