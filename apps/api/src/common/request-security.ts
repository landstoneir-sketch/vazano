import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from 'redis';

export type RequestWithId = Request & { requestId?: string };
type RateLimitResult = { allowed: boolean; limit: number; remaining: number; retryAfterSeconds: number };
type RateLimitConsumer = { consume(key: string, limit: number, windowMilliseconds: number): Promise<RateLimitResult> };

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

@Injectable()
export class RedisRuntime implements OnApplicationBootstrap, OnApplicationShutdown, RateLimitConsumer {
  private readonly logger = new Logger(RedisRuntime.name);
  private readonly client;
  private lastErrorLogAt = 0;

  constructor(config: ConfigService) {
    this.client = createClient({
      url: config.getOrThrow<string>('REDIS_URL'),
      disableOfflineQueue: true,
      socket: { connectTimeout: 5_000, reconnectStrategy: (retries) => Math.min(250 * 2 ** retries, 5_000) },
    });
    this.client.on('error', () => this.logConnectionFailure());
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.client.isOpen) await this.client.connect();
    await this.ping();
  }

  async onApplicationShutdown(): Promise<void> {
    if (!this.client.isOpen) return;
    try { await this.client.quit(); }
    catch { this.client.destroy(); }
  }

  async ping(): Promise<void> {
    const response = await this.client.ping();
    if (response !== 'PONG') throw new Error('Redis health check failed.');
  }

  async consume(key: string, limit: number, windowMilliseconds: number): Promise<RateLimitResult> {
    const result = await this.client.sendCommand(['EVAL', RATE_LIMIT_SCRIPT, '1', key, String(windowMilliseconds)]);
    if (!Array.isArray(result) || result.length < 2) throw new Error('Unexpected Redis rate-limit response.');
    const current = Number(result[0]);
    const ttlMilliseconds = Math.max(1, Number(result[1]));
    return {
      allowed: current <= limit,
      limit,
      remaining: Math.max(0, limit - current),
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMilliseconds / 1_000)),
    };
  }

  private logConnectionFailure(): void {
    const now = Date.now();
    if (now - this.lastErrorLogAt < 60_000) return;
    this.lastErrorLogAt = now;
    this.logger.error('Redis connection is unavailable.');
  }
}

export function requestContext(request: RequestWithId, response: Response, next: NextFunction): void {
  request.requestId = randomUUID();
  response.setHeader('x-request-id', request.requestId);
  next();
}

export function apiRateLimitGuard(runtime: RateLimitConsumer, config: ConfigService) {
  const requestLimit = readPositiveInteger(config, 'API_RATE_LIMIT_REQUESTS_PER_MINUTE', 300);
  const mutationLimit = readPositiveInteger(config, 'API_MUTATION_RATE_LIMIT_REQUESTS_PER_MINUTE', 120);
  const callbackLimit = readPositiveInteger(config, 'PAYMENT_CALLBACK_RATE_LIMIT_REQUESTS_PER_MINUTE', 600);

  return async (request: RequestWithId, response: Response, next: NextFunction): Promise<void> => {
    if (request.method === 'OPTIONS' || request.path.startsWith('/v1/health')) {
      next();
      return;
    }

    const isPaymentCallback = request.path.endsWith('/zarinpal/callback');
    const isMutation = !['GET', 'HEAD'].includes(request.method.toUpperCase());
    const scope = isPaymentCallback ? 'payment-callback' : isMutation ? 'mutation' : 'request';
    const limit = isPaymentCallback ? callbackLimit : isMutation ? mutationLimit : requestLimit;
    const source = request.ip || request.socket.remoteAddress || 'unknown';
    const sourceHash = createHash('sha256').update(source).digest('hex');

    try {
      const result = await runtime.consume(`vazano:rate-limit:v1:${scope}:${sourceHash}`, limit, 60_000);
      response.setHeader('RateLimit-Limit', result.limit);
      response.setHeader('RateLimit-Remaining', result.remaining);
      response.setHeader('RateLimit-Reset', result.retryAfterSeconds);
      if (result.allowed) {
        next();
        return;
      }
      response.setHeader('Retry-After', result.retryAfterSeconds);
      response.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
          requestId: request.requestId ?? null,
        },
      });
    } catch {
      // Readiness fails during a Redis interruption so production can remove this
      // instance from traffic while a brief fail-open window preserves availability.
      next();
    }
  };
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

function readPositiveInteger(config: ConfigService, key: string, fallback: number): number {
  const value = Number(config.get<string>(key, String(fallback)));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
