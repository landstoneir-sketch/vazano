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

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function apiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL ?? 'http://localhost:3001/v1').replace(/\/$/, '');
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

async function forward(request: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const target = new URL(`${apiBaseUrl()}/${path.map(encodeURIComponent).join('/')}`);
  target.search = request.nextUrl.search;

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
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const OPTIONS = forward;
