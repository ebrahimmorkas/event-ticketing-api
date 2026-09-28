import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';
import { prisma } from '../../src/lib/prisma.js';
import { signAccessToken } from '../../src/lib/tokens.js';

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "tickets", "booking_items", "bookings", "ticket_tiers", "events", "refresh_tokens", "users" CASCADE',
  );
}

export async function createUser(role: Role = 'CUSTOMER', password = 'Password123') {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${randomUUID()}@test.dev`,
      name: `Test ${role}`,
      role,
      passwordHash: await bcrypt.hash(password, 4),
    },
  });
  const token = signAccessToken({ id: user.id, email: user.email, role: user.role });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}
