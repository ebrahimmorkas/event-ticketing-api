import { createHash, randomBytes } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';
import type { AuthUser } from '../types/express.js';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export function signAccessToken(user: AuthUser): string {
  const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
  return { id: payload.sub, email: payload.email, role: payload.role };
}

/** Opaque, high-entropy refresh token. Only its SHA-256 hash is persisted. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
