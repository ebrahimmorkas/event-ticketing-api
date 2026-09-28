import bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';
import { env } from '../../config/env.js';
import { Conflict, Unauthorized } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { generateRefreshToken, hashToken, signAccessToken } from '../../lib/tokens.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const BCRYPT_ROUNDS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;

let cachedDummyHash: Promise<string> | undefined;
const dummyHash = () => (cachedDummyHash ??= bcrypt.hash('timing-safe-dummy', BCRYPT_ROUNDS));

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function issueTokens(user: User) {
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * DAY_MS),
    },
  });
  return {
    accessToken: signAccessToken({ id: user.id, email: user.email, role: user.role }),
    refreshToken,
  };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw Conflict('Email is already registered', 'EMAIL_TAKEN');

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    },
  });

  return { user: toPublicUser(user), ...(await issueTokens(user)) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Compare against a dummy hash when the user is missing to keep timing consistent.
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !valid) throw Unauthorized('Invalid email or password');

  return { user: toPublicUser(user), ...(await issueTokens(user)) };
}

/**
 * Rotates a refresh token. Each token is single-use: presenting an already
 * revoked token is treated as theft and revokes every session for that user.
 */
export async function refresh(rawToken: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    include: { user: true },
  });

  if (!stored) throw Unauthorized('Invalid refresh token');

  if (stored.revokedAt) {
    logger.warn({ userId: stored.userId }, 'refresh token reuse detected; revoking all sessions');
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw Unauthorized('Refresh token has been revoked');
  }

  if (stored.expiresAt < new Date()) throw Unauthorized('Refresh token has expired');

  // Conditional update guards against two concurrent refreshes with the same token.
  const { count } = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw Unauthorized('Refresh token has been revoked');

  return { user: toPublicUser(stored.user), ...(await issueTokens(stored.user)) };
}

export async function logout(rawToken: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
