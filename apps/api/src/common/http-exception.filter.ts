import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const message = typeof payload === 'string' ? payload : this.extractMessage(payload, status);
    response.status(status).json({
      error: {
        code: this.codeFor(status),
        message,
        requestId: request.headers['x-request-id'] ?? null,
      },
    });
  }

  private extractMessage(payload: object | null, status: number): string {
    if (payload && 'message' in payload) {
      const value = payload.message;
      return Array.isArray(value) ? value.join('، ') : String(value);
    }
    return status >= 500 ? 'خطای داخلی سامانه رخ داد.' : 'درخواست معتبر نیست.';
  }

  private codeFor(status: number): string {
    const codes: Record<number, string> = { 400: 'VALIDATION_ERROR', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 429: 'RATE_LIMITED' };
    return codes[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  }
}
