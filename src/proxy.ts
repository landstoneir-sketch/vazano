import { NextRequest, NextResponse } from 'next/server';
import { canAccessRoute, type RouteIdentity } from '@/lib/route-access';

type AuthEnvelope = { data: RouteIdentity };

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function internalApiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL ?? 'http://localhost:3001/v1').replace(/\/$/, '');
}

function requestedApiTarget(request: NextRequest): URL | null {
  const path = request.nextUrl.searchParams.get('path');
  if (!path?.startsWith('/') || path.includes('\\') || path.includes('://')) return null;

  const pathname = path.split('?', 1)[0] ?? '';
  if (pathname.split('/').some((segment) => segment === '..' || segment === '.')) return null;

  const base = new URL(internalApiBaseUrl());
  const target = new URL(`${internalApiBaseUrl()}${path}`);
  const basePath = base.pathname.replace(/\/$/, '');
  const staysInsideBase = target.pathname === basePath || target.pathname.startsWith(`${basePath}/`);
  return target.origin === base.origin && staysInsideBase ? target : null;
}

function apiRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
  headers.delete('host');
  headers.set('x-forwarded-host', request.nextUrl.host);
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  return headers;
}

function apiResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP_HEADERS.has(name) && name !== 'set-cookie') headers.append(name, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) headers.append('set-cookie', cookie);
  return headers;
}

function apiError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function proxyApiRequest(request: NextRequest): Promise<NextResponse> {
  const target = requestedApiTarget(request);
  if (!target) return apiError(400, 'INVALID_API_PATH', 'مسیر درخواست معتبر نیست.');

  try {
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstream = await fetch(target, {
      method: request.method,
      headers: apiRequestHeaders(request),
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
      redirect: 'manual',
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: apiResponseHeaders(upstream),
    });
  } catch {
    return apiError(502, 'API_UNAVAILABLE', 'ارتباط با سرویس وازانو برقرار نشد.');
  }
}

function loginRedirect(request: NextRequest): NextResponse {
  const target = new URL('/login', request.url);
  target.searchParams.set('returnTo', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(target);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname === '/api-proxy') return proxyApiRequest(request);

  const isPublicRfqStart = request.nextUrl.pathname === '/dashboard/rfqs/new' && !request.nextUrl.searchParams.has('edit');
  if (isPublicRfqStart) return NextResponse.next();
  if (!request.cookies.has('vazano_session')) return loginRedirect(request);

  const apiBaseUrl = process.env.API_INTERNAL_URL
    ?? process.env.NEXT_PUBLIC_API_BASE_URL
    ?? 'http://localhost:3001/v1';

  try {
    const response = await fetch(`${apiBaseUrl}/auth/me`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });

    if (response.status === 401) return loginRedirect(request);
    if (!response.ok) return NextResponse.rewrite(new URL('/service-unavailable', request.url), { status: 503 });

    const body = await response.json() as AuthEnvelope;
    if (!canAccessRoute(request.nextUrl.pathname, body.data)) {
      const target = new URL('/forbidden', request.url);
      target.searchParams.set('returnTo', request.nextUrl.pathname);
      return NextResponse.redirect(target);
    }

    return NextResponse.next();
  } catch {
    return NextResponse.rewrite(new URL('/service-unavailable', request.url), { status: 503 });
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/supplier/:path*',
    '/admin/:path*',
    '/messages/:path*',
    '/notifications/:path*',
    '/support/:path*',
    '/api-proxy',
  ],
};
