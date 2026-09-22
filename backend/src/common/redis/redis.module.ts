import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { buildRedisClient } from '../../config/redis.config';

/**
 * Global Redis client provider.
 *
 * Exposes the `REDIS_CLIENT` injection token. Any module can do:
 *
 *   constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}
 *
 * and get the shared, already-connected client.
 *
 * The client is created once at boot and reused — never call `new Redis()`
 * outside this module.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => buildRedisClient(config),
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
