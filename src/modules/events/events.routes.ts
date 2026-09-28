import { Router } from 'express';
import { authenticate, authorize, optionalAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createEventSchema,
  eventIdParams,
  listEventsQuery,
  tierInputSchema,
  tierParams,
  updateEventSchema,
  updateTierSchema,
  type ListEventsQuery,
} from './events.schemas.js';
import * as events from './events.service.js';

export const eventsRouter = Router();

const organizerOnly = [authenticate, authorize('ORGANIZER', 'ADMIN')];

eventsRouter.get('/', validate({ query: listEventsQuery }), async (req, res) => {
  res.json(await events.listPublishedEvents(req.query as unknown as ListEventsQuery));
});

eventsRouter.get('/mine', ...organizerOnly, async (req, res) => {
  res.json({ data: await events.listOrganizerEvents(req.user!) });
});

eventsRouter.get('/:id', optionalAuth, validate({ params: eventIdParams }), async (req, res) => {
  res.json({ event: await events.getEvent(req.params.id as string, req.user) });
});

eventsRouter.post(
  '/',
  ...organizerOnly,
  validate({ body: createEventSchema }),
  async (req, res) => {
    res.status(201).json({ event: await events.createEvent(req.body, req.user!) });
  },
);

eventsRouter.patch(
  '/:id',
  ...organizerOnly,
  validate({ params: eventIdParams, body: updateEventSchema }),
  async (req, res) => {
    res.json({ event: await events.updateEvent(req.params.id as string, req.body, req.user!) });
  },
);

eventsRouter.post(
  '/:id/publish',
  ...organizerOnly,
  validate({ params: eventIdParams }),
  async (req, res) => {
    res.json({ event: await events.publishEvent(req.params.id as string, req.user!) });
  },
);

eventsRouter.post(
  '/:id/cancel',
  ...organizerOnly,
  validate({ params: eventIdParams }),
  async (req, res) => {
    res.json(await events.cancelEvent(req.params.id as string, req.user!));
  },
);

eventsRouter.post(
  '/:id/tiers',
  ...organizerOnly,
  validate({ params: eventIdParams, body: tierInputSchema }),
  async (req, res) => {
    res
      .status(201)
      .json({ tier: await events.addTier(req.params.id as string, req.body, req.user!) });
  },
);

eventsRouter.patch(
  '/:id/tiers/:tierId',
  ...organizerOnly,
  validate({ params: tierParams, body: updateTierSchema }),
  async (req, res) => {
    const tier = await events.updateTier(
      req.params.id as string,
      req.params.tierId as string,
      req.body,
      req.user!,
    );
    res.json({ tier });
  },
);
