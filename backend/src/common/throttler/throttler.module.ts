import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import {
  ThrottlerModule as NestThrottlerModule,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Throttler wired to Redis.
 *
 * Two named "buckets":
 *   - short:  10 requests / 1 second per IP  — general API surface
 *   - auth:    5 requests / 1 minute per IP  — POST /auth/login,
 *                                            POST /auth/register,
 *                                            POST /auth/refresh
 *
 * The auth bucket is intentionally tight: legitimate users do not log in
 * every 12 seconds, but a credential-stuffing bot absolutely does. The
 * per-IP keying means a single noisy client cannot lock out the rest of
 * the world.
 *
 * Why Redis here:
 *   - The limiter must be shared across all NestJS replicas. Without Redis,
 *     each replica would maintain its own per-IP counter and the effective
 *     limit would be N × limit on an N-replica deployment.
 *   - INCR + EXPIRE in one round-trip is sub-millisecond and atomic.
 *
 * If Redis is unreachable, ThrottlerStorageRedisService throws and the
 * ThrottlerGuard returns 500. We accept that here because the auth endpoints
 * are not on the hot path of the booking flow; if Redis is down something
 * else is also broken and a loud failure is preferable to silent bypass.
 */
@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis): ThrottlerModuleOptions => ({
        throttlers: [
          { name: 'short', ttl: 1_000, limit: 10 },
          { name: 'auth', ttl: 60_000, limit: 5 },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
  ],
  exports: [NestThrottlerModule],
})
export class ThrottlerModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => {
      /* ignore — connection may already be closed */
    });
  }
}
