import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { Forbidden, Unauthorized } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw Unauthorized('Missing bearer token');
  }
  try {
    req.user = verifyAccessToken(header.slice('Bearer '.length));
  } catch {
    throw Unauthorized('Invalid or expired token');
  }
  next();
};

export const authorize =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw Unauthorized();
    if (!roles.includes(req.user.role)) {
      throw Forbidden('You do not have permission to perform this action');
    }
    next();
  };
