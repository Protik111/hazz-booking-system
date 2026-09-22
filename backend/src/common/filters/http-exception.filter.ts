import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isDev = process.env.NODE_ENV === 'development';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = HttpStatus[HttpStatus.INTERNAL_SERVER_ERROR] ?? 'INTERNAL_SERVER_ERROR';
    let message: string | string[] = 'Something went wrong. Please try again later.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        code = HttpStatus[status] || 'ERROR';
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const resp = exceptionResponse as {
          message?: string | string[];
          code?: string;
          error?: string;
        };
        message = resp.message || exception.message;
        code = resp.code || resp.error || HttpStatus[status] || 'ERROR';
      }
    } else if (exception instanceof Error) {
      // Non-HTTP errors (DB failures, third-party libs, programming bugs):
      // never expose the raw driver/library message to clients. Log it
      // server-side for debugging, return a generic message to the UI.
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
      code = 'INTERNAL_SERVER_ERROR';
      message = 'Something went wrong. Please try again later.';
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        // In dev, include the underlying message but NOT the stack — the
        // stack is logged server-side instead.
        ...(isDev && !(exception instanceof HttpException) && {
          devMessage:
            exception instanceof Error ? exception.message : String(exception),
        }),
      },
    });
  }
}
