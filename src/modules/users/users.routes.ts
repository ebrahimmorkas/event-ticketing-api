import { Router } from 'express';
import { z } from 'zod';
import { NotFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { toPublicUser } from '../auth/auth.service.js';

export const usersRouter = Router();

usersRouter.use(authenticate, authorize('ADMIN'));

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['CUSTOMER', 'ORGANIZER', 'ADMIN']).optional(),
});

usersRouter.get('/', validate({ query: listQuery }), async (req, res) => {
  const { page, limit, role } = req.query as unknown as z.infer<typeof listQuery>;
  const where = role ? { role } : {};
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  res.json({
    data: users.map(toPublicUser),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

usersRouter.patch(
  '/:id/role',
  validate({
    params: z.object({ id: z.uuid() }),
    body: z.object({ role: z.enum(['CUSTOMER', 'ORGANIZER', 'ADMIN']) }),
  }),
  async (req, res) => {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw NotFound('User');
    const updated = await prisma.user.update({ where: { id }, data: { role: req.body.role } });
    res.json({ user: toPublicUser(updated) });
  },
);
