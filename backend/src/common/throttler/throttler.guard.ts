import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';

/**
 * Throttler guard that only fires on routes that opt in.
 *
 * Background
 * ----------
 * `@nestjs/throttler`'s stock `ThrottlerGuard` runs on every request and
 * defaults to the **configured limit + ttl of every named bucket** for
 * any handler that has no matching `THROTTLER_LIMIT_<bucket>` metadata.
 *
 * Our throttler module configures two buckets:
 *   - `short`: 10 req / 1 s  (general)
 *   - `auth`:   5 req / 60 s (auth endpoints, when decorated)
 *
 * Without this override, every unprotected route in the API — including
 * the booking list, package browse, admin reports — gets capped by
 * `short` (10 req/s per IP) because no `THROTTLER_LIMIT_short` metadata
 * is set on its handler. The README promises the opposite: only
 * `/auth/*` is rate-limited, everything else is not.
 *
 * What this guard does
 * --------------------
 * We use the documented `shouldSkip(context)` extension point. We skip
 * the entire guard for a request when NONE of the configured buckets
 * have an explicit `@Throttle(...)` override on the handler. Routes
 * that opt in (the auth endpoints) get bucketed by the named bucket
 * they declare; everything else is bypassed.
 *
 * Net effect
 * ----------
 * - `POST /auth/login`, `/auth/register`, `/auth/refresh` — limited by
 *   the `auth` bucket (5 / 3 / 10 req per minute, per the README).
 * - `GET /bookings`, `GET /packages`, `GET /admin/reports`, every other
 *   endpoint — never throttled.
 *
 * Why not just drop the global guard? Because `ThrottlerGuard` is what
 * reads the `@Throttle()` metadata and increments the counter. Dropping
 * it would silently disable the auth rate limits. Keeping the global
 * guard and narrowing its scope here is the only way to get the
 * documented behaviour.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  /**
   * Return `true` to bypass the throttler entirely for this request.
   *
   * We bypass iff the handler (and its controller) declare no
   * `@Throttle({ <bucket>: { limit, ttl } })` override for ANY of the
   * buckets currently configured. The parent `canActivate()` reads
   * `THROTTLER_LIMIT<bucket>` per bucket, so checking against the
   * known bucket names is the right hook.
   */
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const classRef = context.getClass();

    // `this.throttlers` is populated in the parent's `onModuleInit()`.
    // If for some reason we run before init, fall through to the parent
    // (which will then no-op anyway because the throttlers array is
    // empty).
    const buckets = (this as unknown as { throttlers?: Array<{ name: string }> })
      .throttlers;

    if (!buckets || buckets.length === 0) {
      return false;
    }

    const hasAnyOverride = buckets.some((t) => {
      const limit = this.reflector.getAllAndOverride<unknown>(
        THROTTLER_LIMIT + t.name,
        [handler, classRef],
      );
      const ttl = this.reflector.getAllAndOverride<unknown>(
        THROTTLER_TTL + t.name,
        [handler, classRef],
      );
      return limit !== undefined || ttl !== undefined;
    });

    // No `@Throttle()` on this route — do not rate-limit it.
    return !hasAnyOverride;
  }
}
