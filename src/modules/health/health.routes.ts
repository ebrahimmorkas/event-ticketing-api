import { Router } from 'express';
import { getRedis } from '../../lib/redis.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const redis = getRedis();
  let redisStatus = 'disabled';
  if (redis) {
    redisStatus = await redis
      .ping()
      .then(() => 'up')
      .catch(() => 'down');
  }

  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    services: { redis: redisStatus },
  });
});
