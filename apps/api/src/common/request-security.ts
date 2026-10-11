import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export type RequestWithId = Request & { requestId?: string };

export function requestContext(request: RequestWithId, response: Response, next: NextFunction): void {
  request.requestId = randomUUID();
  response.setHeader('x-request-id', request.requestId);
  next();
}

export function sessionOriginGuard(expectedOrigin: string) {
  const trustedOrigin = new URL(expectedOrigin).origin;
  return (request: RequestWithId, response: Response, next: NextFunction): void => {
    if (isTrustedSessionMutation(request.method, request.headers.origin, Boolean((request.cookies as Record<string, string> | undefined)?.vazano_session), trustedOrigin)) {
      next();
      return;
    }
    response.status(403).json({ error: { code: 'CSRF_ORIGIN_REJECTED', message: 'مبدأ درخواست معتبر نیست.', requestId: request.requestId ?? null } });
  };
}

export function isTrustedSessionMutation(method: string, origin: string | undefined, hasSessionCookie: boolean, expectedOrigin: string): boolean {
  if (!hasSessionCookie || ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return true;
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(expectedOrigin).origin; }
  catch { return false; }
}
