import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { TransformInterceptor } from './transform.interceptor';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  const mockContext = {} as ExecutionContext;

  it('should wrap standard result in { success: true, data: ... }', (done) => {
    const next: CallHandler = {
      handle: () => of({ user: { id: '123' } }),
    };

    interceptor.intercept(mockContext, next).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: { user: { id: '123' } },
      });
      done();
    });
  });

  it('should preserve already formatted { success: true, data: ... }', (done) => {
    const existing = { success: true, data: { foo: 'bar' } };
    const next: CallHandler = {
      handle: () => of(existing),
    };

    interceptor.intercept(mockContext, next).subscribe((result) => {
      expect(result).toEqual(existing);
      done();
    });
  });

  it('should preserve paginated structure with meta', (done) => {
    const paginated = {
      data: [{ id: '1' }],
      meta: { page: 1, limit: 10, total: 1 },
    };
    const next: CallHandler = {
      handle: () => of(paginated),
    };

    interceptor.intercept(mockContext, next).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: [{ id: '1' }],
        meta: { page: 1, limit: 10, total: 1 },
      });
      done();
    });
  });

  it('should preserve sibling fields like `summary` when re-wrapping', (done) => {
    const reports = {
      summary: { totalBookings: 5 },
      data: [{ id: '1' }],
      meta: { page: 1, limit: 10, total: 1 },
    };
    const next: CallHandler = {
      handle: () => of(reports),
    };

    interceptor.intercept(mockContext, next).subscribe((result) => {
      expect(result).toEqual({
        success: true,
        data: [{ id: '1' }],
        meta: { page: 1, limit: 10, total: 1 },
        summary: { totalBookings: 5 },
      });
      done();
    });
  });
});
