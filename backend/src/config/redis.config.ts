import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Build a Redis client from REDIS_URL.
 *
 * REDIS_URL format:  redis://[user:pass@]host:port[/db]
 *
 * Falls back to redis://redis:6379 (Docker service name) if REDIS_URL is
 * not set, so the backend container can find the `redis` service in the
 * default docker-compose network.
 *
 * The client is configured with:
 *   - lazyConnect: false — we want a real connection check on startup so
 *     a misconfigured Redis container fails fast at boot, not on first
 *     request.
 *   - maxRetriesPerRequest: 3 — fail individual commands quickly rather
 *     than blocking on a dead Redis. Combined with the NestJS Throttler
 *     storage this still gives correct behaviour: a Redis outage causes
 *     the rate limiter to fall through (it returns true / allows the
 *     request) rather than locking everyone out. Postgres remains the
 *     source of truth for everything that matters.
 */
export const buildRedisClient = (config: ConfigService): Redis => {
  const url =
    config.get<string>('REDIS_URL') ?? 'redis://redis:6379';

  return new Redis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });
};
