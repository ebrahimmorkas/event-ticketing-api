import { createApp } from './app.js';
import { env } from './config/env.js';
import { startJobs, stopJobs } from './jobs/index.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { closeRedis } from './lib/redis.js';

const app = createApp();

await startJobs();

const server = app.listen(env.PORT, () => {
  logger.info(`server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down gracefully');
  server.close(async () => {
    await stopJobs();
    await prisma.$disconnect();
    await closeRedis();
    logger.info('shutdown complete');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled rejection'));
