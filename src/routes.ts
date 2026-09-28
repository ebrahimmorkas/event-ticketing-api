import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { bookingsRouter } from './modules/bookings/bookings.routes.js';
import { eventsRouter } from './modules/events/events.routes.js';
import { organizerRouter } from './modules/organizer/organizer.routes.js';
import { usersRouter } from './modules/users/users.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/events', eventsRouter);
apiRouter.use('/bookings', bookingsRouter);
apiRouter.use('/organizer', organizerRouter);
