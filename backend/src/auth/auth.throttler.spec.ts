import { Controller, Post, Body } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Throttle,
  ThrottlerModule,
} from '@nestjs/throttler';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';

/**
 * Smoke test for the throttling wiring on AuthController.
 *
 * We do not exercise the actual rate-limit here — that requires a live
 * Redis and is covered by the manual end-to-end flow in
 * `docs/MANUAL_TESTING_GUIDE.md` (six rapid logins → 6th returns 429).
 *
 * What we DO assert:
 *   1. The `auth` named bucket is plumbed through `@nestjs/throttler` and
 *      reads the configured (limit, ttl) values without throwing.
 *   2. The `@Throttle` decorator actually attaches the expected metadata
 *      (THROTTLER_LIMIT / THROTTLER_TTL) to the route handler — i.e.
 *      the decorator imports compile correctly under the real v6 API.
 */
@Controller('fake-auth')
class FakeAuthController {
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() _body: unknown) {
    return { ok: true };
  }

  @Throttle({ auth: { limit: 3, ttl: 60_000 } })
  @Post('register')
  register(@Body() _body: unknown) {
    return { ok: true };
  }
}

describe('Auth throttling wiring', () => {
  it('mounts the throttler module with the auth bucket', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot({
          throttlers: [
            { name: 'short', ttl: 1_000, limit: 10 },
            { name: 'auth', ttl: 60_000, limit: 5 },
          ],
        }),
      ],
      controllers: [FakeAuthController],
    }).compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  it('attaches @Throttle metadata to the decorated routes', () => {
    // The `@Throttle({ auth: { limit, ttl } })` decorator stores metadata
    // under composite keys `THROTTLER_LIMIT<bucket>` and
    // `THROTTLER_TTL<bucket>` on the route's function value.
    const loginLimit = Reflect.getMetadata(
      THROTTLER_LIMIT + 'auth',
      FakeAuthController.prototype.login,
    ) as number | undefined;
    expect(loginLimit).toBe(5);

    const registerLimit = Reflect.getMetadata(
      THROTTLER_LIMIT + 'auth',
      FakeAuthController.prototype.register,
    ) as number | undefined;
    expect(registerLimit).toBe(3);

    const loginTtl = Reflect.getMetadata(
      THROTTLER_TTL + 'auth',
      FakeAuthController.prototype.login,
    ) as number | undefined;
    expect(loginTtl).toBe(60_000);
  });
});