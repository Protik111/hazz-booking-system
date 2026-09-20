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
          const res = result as unknown as { data: T; meta: unknown };
          return {
            success: true,
            data: res.data,
            meta: res.meta,
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
