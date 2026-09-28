import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryCache } from '../src/lib/cache.js';

describe('MemoryCache', () => {
  afterEach(() => vi.useRealTimers());

  it('stores and expires values', async () => {
    vi.useFakeTimers();
    const cache = new MemoryCache();
    await cache.set('a', { n: 1 }, 10);
    expect(await cache.get('a')).toEqual({ n: 1 });

    vi.advanceTimersByTime(11_000);
    expect(await cache.get('a')).toBeNull();
  });

  it('invalidates a namespace by bumping its version', async () => {
    const cache = new MemoryCache();
    const before = await cache.key('events', 'list');
    await cache.set(before, [1, 2], 60);

    await cache.invalidate('events');
    const after = await cache.key('events', 'list');
    expect(after).not.toBe(before);
    expect(await cache.get(after)).toBeNull();
  });

  it('evicts the oldest entry when full', async () => {
    const cache = new MemoryCache(2);
    await cache.set('a', 1, 60);
    await cache.set('b', 2, 60);
    await cache.set('c', 3, 60);
    expect(await cache.get('a')).toBeNull();
    expect(await cache.get('c')).toBe(3);
  });
});
