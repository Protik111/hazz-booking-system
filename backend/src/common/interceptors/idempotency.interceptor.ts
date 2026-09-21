import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';

interface CachedEntry {
  status: 'IN_FLIGHT' | 'RESOLVED';
  statusCode?: number;
  body?: unknown;
  timestamp: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  // Store responses for 5 minutes (300,000 ms)
  private readonly ttlMs = 5 * 60 * 1000;
  private readonly store = new Map<string, CachedEntry>();

  constructor() {
    // Periodically clean up expired entries every 2 minutes
    setInterval(() => this.cleanup(), 2 * 60 * 1000).unref();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { userId?: string } }>();
    const res = http.getResponse<Response>();

    const idempotencyKey =
      (req.headers['idempotency-key'] as string | undefined) ||
      (req.headers['x-idempotency-key'] as string | undefined);

    // If client did not provide an Idempotency-Key, pass through normally
    if (!idempotencyKey) {
      return next.handle();
    }

    const userId = req.user?.userId || req.ip || 'anonymous';
    const cacheKey = `${userId}:${req.method}:${req.baseUrl || ''}${req.path}:${idempotencyKey.trim()}`;
    const now = Date.now();

    const existing = this.store.get(cacheKey);
    if (existing) {
      // In-flight check
      if (existing.status === 'IN_FLIGHT') {
        // If it has been stuck for more than 30 seconds, consider it timed out
        if (now - existing.timestamp < 30 * 1000) {
          throw new ConflictException({
            code: 'DUPLICATE_IN_FLIGHT_REQUEST',
            message:
              'A request with this Idempotency-Key is currently being processed. Please wait.',
          });
        }
      }

      // Resolved check
      if (existing.status === 'RESOLVED') {
        res.setHeader('X-Cache', 'HIT-IDEMPOTENT');
        if (existing.statusCode) {
          res.status(existing.statusCode);
        }
        return of(existing.body);
      }
    }

    // Mark as in-flight
    this.store.set(cacheKey, {
      status: 'IN_FLIGHT',
      timestamp: now,
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.store.set(cacheKey, {
            status: 'RESOLVED',
            statusCode: res.statusCode || 200,
            body: data,
            timestamp: Date.now(),
          });
        },
        error: () => {
          // If request failed, clear in-flight status to allow retry
          this.store.delete(cacheKey);
        },
      }),
    );
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.store.delete(key);
      }
    }
  }
}
