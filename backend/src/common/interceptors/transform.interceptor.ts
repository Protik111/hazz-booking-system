import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: unknown;
  summary?: unknown;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | T
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T> | T> {
    return next.handle().pipe(
      map((result: T): ApiResponse<T> | T => {
        if (
          result !== null &&
          typeof result === 'object' &&
          'success' in result
        ) {
          return result;
        }

        if (
          result !== null &&
          typeof result === 'object' &&
          'data' in result &&
          'meta' in result
        ) {
          // Reports and similar endpoints return `{ data, meta, summary }` —
          // `summary` carries aggregate counts (totals, byStatus, etc.). The
          // earlier version of this interceptor silently dropped it; preserve
          // any sibling keys so callers can read them off the envelope.
          const res = result as Record<string, unknown>;
          const { data, meta, ...rest } = res;
          return {
            success: true as const,
            data: data as T,
            meta,
            ...rest,
          };
        }

        return {
          success: true,
          data: result,
        };
      }),
    );
  }
}