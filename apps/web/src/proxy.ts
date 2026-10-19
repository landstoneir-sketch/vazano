import { NextRequest, NextResponse } from 'next/server';
import { canAccessRoute, type RouteIdentity } from '@/lib/route-access';

type AuthEnvelope = { data: RouteIdentity };

function loginRedirect(request: NextRequest): NextResponse {
  const target = new URL('/login', request.url);
  target.searchParams.set('returnTo', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(target);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
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
  ],
};
