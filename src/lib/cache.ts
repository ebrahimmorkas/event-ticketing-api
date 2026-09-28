import type { Redis } from 'ioredis';
import { logger } from './logger.js';
import { getRedis } from './redis.js';

export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Invalidates every key in a namespace by bumping its version. */
  invalidate(namespace: string): Promise<void>;
  /** Builds a versioned key so that `invalidate(namespace)` makes old entries unreachable. */
  key(namespace: string, id: string): Promise<string>;
}

export class MemoryCache implements Cache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  private versions = new Map<string, number>();

  constructor(private readonly maxEntries = 1000) {}

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (this.store.size >= this.maxEntries) {
      // Map preserves insertion order, so the first key is the oldest.
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async invalidate(namespace: string): Promise<void> {
    this.versions.set(namespace, (this.versions.get(namespace) ?? 0) + 1);
  }

  async key(namespace: string, id: string): Promise<string> {
    return `${namespace}:v${this.versions.get(namespace) ?? 0}:${id}`;
  }
}

export class RedisCache implements Cache {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'ticketing:cache',
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(`${this.prefix}:${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
      logger.warn({ err }, 'cache get failed; treating as miss');
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(`${this.prefix}:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      logger.warn({ err }, 'cache set failed');
    }
  }

  async invalidate(namespace: string): Promise<void> {
    await this.redis.incr(`${this.prefix}:version:${namespace}`).catch(() => undefined);
  }

  async key(namespace: string, id: string): Promise<string> {
    const version = await this.redis.get(`${this.prefix}:version:${namespace}`).catch(() => null);
    return `${namespace}:v${version ?? 0}:${id}`;
  }
}

let instance: Cache | undefined;

export function getCache(): Cache {
  if (!instance) {
    const redis = getRedis();
    instance = redis ? new RedisCache(redis) : new MemoryCache();
    logger.info(`cache backend: ${redis ? 'redis' : 'memory'}`);
  }
  return instance;
}

/** Read-through helper: returns the cached value or computes and stores it. */
export async function cached<T>(
  namespace: string,
  id: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const cache = getCache();
  const key = await cache.key(namespace, id);
  const hit = await cache.get<T>(key);
  if (hit !== null) return hit;
  const value = await compute();
  await cache.set(key, value, ttlSeconds);
  return value;
}
