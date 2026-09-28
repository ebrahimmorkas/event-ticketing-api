import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export type JobHandler = (data: Record<string, string>) => Promise<void>;

/**
 * Minimal delayed-job API used by the app. Two interchangeable backends:
 * - BullMQ (durable, multi-instance safe) when Redis is enabled
 * - In-process timers when Redis is disabled (single instance / development)
 */
export interface JobScheduler {
  readonly backend: 'bullmq' | 'in-process';
  register(name: string, handler: JobHandler): void;
  schedule(name: string, data: Record<string, string>, runAt: Date, jobId?: string): Promise<void>;
  start(): Promise<void>;
  close(): Promise<void>;
}

class InProcessScheduler implements JobScheduler {
  readonly backend = 'in-process' as const;
  private handlers = new Map<string, JobHandler>();
  private timers = new Map<string, NodeJS.Timeout>();

  register(name: string, handler: JobHandler) {
    this.handlers.set(name, handler);
  }

  async schedule(name: string, data: Record<string, string>, runAt: Date, jobId?: string) {
    const id = jobId ?? `${name}:${Date.now()}:${Math.random()}`;
    if (this.timers.has(id)) return;
    const delay = Math.max(0, runAt.getTime() - Date.now());
    const timer = setTimeout(() => {
      this.timers.delete(id);
      const handler = this.handlers.get(name);
      handler?.(data).catch((err) => logger.error({ err, name, data }, 'job failed'));
    }, delay);
    timer.unref();
    this.timers.set(id, timer);
  }

  async start() {}

  async close() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }
}

class BullMqScheduler implements JobScheduler {
  readonly backend = 'bullmq' as const;
  private static readonly QUEUE = 'ticketing-jobs';
  private handlers = new Map<string, JobHandler>();
  private queue: Queue;
  private worker?: Worker;

  constructor() {
    this.queue = new Queue(BullMqScheduler.QUEUE, {
      connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }

  register(name: string, handler: JobHandler) {
    this.handlers.set(name, handler);
  }

  async schedule(name: string, data: Record<string, string>, runAt: Date, jobId?: string) {
    await this.queue.add(name, data, {
      delay: Math.max(0, runAt.getTime() - Date.now()),
      // BullMQ ignores duplicate job ids, which makes scheduling idempotent.
      ...(jobId && { jobId: jobId.replaceAll(':', '-') }),
    });
  }

  async start() {
    this.worker = new Worker(
      BullMqScheduler.QUEUE,
      async (job) => {
        const handler = this.handlers.get(job.name);
        if (!handler) throw new Error(`No handler registered for job "${job.name}"`);
        await handler(job.data);
      },
      {
        connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }),
        concurrency: 5,
      },
    );
    this.worker.on('failed', (job, err) => logger.error({ err, jobId: job?.id }, 'job failed'));
  }

  async close() {
    await this.worker?.close();
    await this.queue.close();
  }
}

let scheduler: JobScheduler | undefined;

export function getScheduler(): JobScheduler {
  if (!scheduler) {
    scheduler = env.REDIS_ENABLED ? new BullMqScheduler() : new InProcessScheduler();
    logger.info(`job scheduler backend: ${scheduler.backend}`);
  }
  return scheduler;
}
