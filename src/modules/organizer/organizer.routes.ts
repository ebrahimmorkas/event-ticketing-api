import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { checkInTicket, getEventStats } from './organizer.service.js';

export const organizerRouter = Router();

organizerRouter.use(authenticate, authorize('ORGANIZER', 'ADMIN'));

organizerRouter.post(
  '/check-in',
  validate({ body: z.object({ code: z.string().trim().toUpperCase().min(4).max(40) }) }),
  async (req, res) => {
    res.json({ checkIn: await checkInTicket(req.body.code, req.user!) });
  },
);

organizerRouter.get(
  '/events/:id/stats',
  validate({ params: z.object({ id: z.uuid() }) }),
  async (req, res) => {
    res.json(await getEventStats(req.params.id as string, req.user!));
  },
);
