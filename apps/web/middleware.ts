import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/session';
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie';

// API routes keep their own Bearer-token auth (openapi.yaml bearerAuth) and
// are intentionally excluded here — this middleware only gates browser pages.
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
};

export async function middleware(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!secret || !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await verifySession(token, secret);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
