import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

function apiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL ?? 'http://localhost:3001/v1').replace(/\/$/, '');
}

function requestedApiPath(request: NextRequest): string | null {
  const path = request.nextUrl.searchParams.get('path');
  if (!path?.startsWith('/') || path.includes('\\') || path.includes('://')) return null;

  const pathname = path.split('?', 1)[0] ?? '';
  if (pathname.split('/').some((segment) => segment === '..' || segment === '.')) return null;
  return path;
}

function apiTarget(path: string): URL | null {
  const base = new URL(apiBaseUrl());
  const target = new URL(`${apiBaseUrl()}${path}`);
  const basePath = base.pathname.replace(/\/$/, '');
  const staysInsideBase = target.pathname === basePath || target.pathname.startsWith(`${basePath}/`);

  return target.origin === base.origin && staysInsideBase ? target : null;
}

function requestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);

  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
  headers.delete('host');
  headers.set('x-forwarded-host', request.nextUrl.host);
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));

  return headers;
}

function responseHeaders(upstream: Response): Headers {
  const headers = new Headers();

  upstream.headers.forEach((value, name) => {
    if (!HOP_BY_HOP_HEADERS.has(name) && name !== 'set-cookie') headers.append(name, value);
  });

  for (const cookie of upstream.headers.getSetCookie()) headers.append('set-cookie', cookie);
  return headers;
}

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

async function forward(request: NextRequest): Promise<Response> {
  const path = requestedApiPath(request);
  if (!path) return errorResponse(400, 'INVALID_API_PATH', 'مسیر درخواست معتبر نیست.');
  const target = apiTarget(path);
  if (!target) return errorResponse(400, 'INVALID_API_PATH', 'مسیر درخواست معتبر نیست.');

  try {
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstream = await fetch(target, {
      method: request.method,
      headers: requestHeaders(request),
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
      redirect: 'manual',
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders(upstream),
    });
  } catch {
    return errorResponse(502, 'API_UNAVAILABLE', 'ارتباط با سرویس وازانو برقرار نشد.');
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
