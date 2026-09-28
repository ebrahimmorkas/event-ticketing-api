import { Router } from 'express';
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export const authRouter = Router();

authRouter.post('/register', validate({ body: registerSchema }), async (req, res) => {
  res.status(201).json(await authService.register(req.body));
});

authRouter.post('/login', validate({ body: loginSchema }), async (req, res) => {
  res.json(await authService.login(req.body));
});

authRouter.post('/refresh', validate({ body: refreshSchema }), async (req, res) => {
  res.json(await authService.refresh(req.body.refreshToken));
});

authRouter.post('/logout', validate({ body: refreshSchema }), async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(204).end();
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) throw NotFound('User');
  res.json({ user: authService.toPublicUser(user) });
});
