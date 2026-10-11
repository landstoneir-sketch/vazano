import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RequestWithId } from './request-security';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request & RequestWithId>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const message = typeof payload === 'string' ? payload : this.extractMessage(payload, status);
    const requestId = request.requestId ?? null;
    if (status >= 500) {
      this.logger.error(JSON.stringify({ event: 'http.request.failed', requestId, method: request.method, path: request.path, status }), exception instanceof Error ? exception.stack : undefined);
    }
    response.status(status).json({
      error: {
        code: this.codeFor(status),
        message,
        requestId,
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
