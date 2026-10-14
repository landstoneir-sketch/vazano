import { ConfigService } from '@nestjs/config';
import type { NextFunction, Response } from 'express';
import { apiRateLimitGuard, isTrustedSessionMutation, type RequestWithId } from './request-security';

describe('session origin policy', () => {
  it('allows safe methods and bearer-style requests without a session cookie', () => {
    expect(isTrustedSessionMutation('GET', undefined, true, 'https://vazano.ir')).toBe(true);
    expect(isTrustedSessionMutation('POST', undefined, false, 'https://vazano.ir')).toBe(true);
  });

  it('allows a cookie-authenticated mutation only from the configured web origin', () => {
    expect(isTrustedSessionMutation('POST', 'https://vazano.ir', true, 'https://vazano.ir')).toBe(true);
    expect(isTrustedSessionMutation('POST', 'https://attacker.example', true, 'https://vazano.ir')).toBe(false);
    expect(isTrustedSessionMutation('DELETE', undefined, true, 'https://vazano.ir')).toBe(false);
  });
});

describe('API rate-limit policy', () => {
  it('blocks an exhausted request with a stable error contract', async () => {
    const runtime = { consume: jest.fn().mockResolvedValue({ allowed: false, limit: 300, remaining: 0, retryAfterSeconds: 30 }) };
    const request = { method: 'GET', path: '/v1/rfqs', ip: '127.0.0.1', socket: {}, requestId: 'request-id' } as unknown as RequestWithId;
    const status = jest.fn();
    const json = jest.fn();
    const response = { setHeader: jest.fn(), status, json } as unknown as Response;
    status.mockReturnValue(response);
    const next = jest.fn() as NextFunction;

    await apiRateLimitGuard(runtime, new ConfigService())(request, response, next);

    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'RATE_LIMITED',
        message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
        requestId: 'request-id',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('keeps health checks outside the limiter', async () => {
    const runtime = { consume: jest.fn() };
    const request = { method: 'GET', path: '/v1/health/ready', socket: {} } as unknown as RequestWithId;
    const response = {} as Response;
    const next = jest.fn() as NextFunction;

    await apiRateLimitGuard(runtime, new ConfigService())(request, response, next);

    expect(runtime.consume).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
