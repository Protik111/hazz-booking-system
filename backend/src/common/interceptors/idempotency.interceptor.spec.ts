import { ConflictException, ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    interceptor = new IdempotencyInterceptor();
  });

  const createMockContext = (
    headers: Record<string, string | undefined>,
    userId = 'user-1',
  ) => {
    const req = {
      headers,
      user: { userId },
      method: 'POST',
      baseUrl: '/api/v1',
      path: '/bookings',
      ip: '127.0.0.1',
    };
    const res = {
      statusCode: 201,
      setHeader: jest.fn(),
      status: jest.fn(),
    };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
  };

  it('should pass through when no idempotency key is provided', (done) => {
    const ctx = createMockContext({});
    const next: CallHandler = {
      handle: () => of({ success: true, bookingId: 'b-1' }),
    };

    interceptor.intercept(ctx, next).subscribe((result) => {
      expect(result).toEqual({ success: true, bookingId: 'b-1' });
      done();
    });
  });

  it('should cache and replay response on duplicate Idempotency-Key', (done) => {
    const key = 'test-key-123';
    const ctx = createMockContext({ 'idempotency-key': key });
    const mockData = { id: 'booking-1', status: 'PENDING' };
    const next: CallHandler = {
      handle: jest.fn().mockReturnValue(of(mockData)),
    };

    // First request
    interceptor.intercept(ctx, next).subscribe((firstResult) => {
      expect(firstResult).toEqual(mockData);
      expect(next.handle).toHaveBeenCalledTimes(1);

      // Second request with same key
      const ctx2 = createMockContext({ 'idempotency-key': key });
      interceptor.intercept(ctx2, next).subscribe((secondResult) => {
        expect(secondResult).toEqual(mockData);
        // Handler should NOT be called a second time
        expect(next.handle).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });

  it('should throw ConflictException if duplicate request arrives while in-flight', () => {
    const key = 'in-flight-key';
    const ctx = createMockContext({ 'idempotency-key': key });

    // Mock a handler that doesn't immediately complete
    const next: CallHandler = {
      handle: () => ({
        pipe: () => of({}),
      } as unknown as ReturnType<CallHandler['handle']>),
    };

    // First call sets in-flight
    interceptor.intercept(ctx, next);

    // Second call with same key before first completes
    const ctx2 = createMockContext({ 'idempotency-key': key });
    expect(() => interceptor.intercept(ctx2, next)).toThrow(ConflictException);
  });
});
