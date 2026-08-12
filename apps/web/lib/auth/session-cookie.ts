import { cookies } from 'next/headers';
import { verifySession, type SessionUser } from './session';

/**
 * Cookie-based session for browser pages — distinct from the Bearer-token
 * auth used by the JSON API (openapi.yaml's bearerAuth), which stays
 * unchanged for programmatic/API clients.
 */
export const SESSION_COOKIE_NAME = 'sinal_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export async function getSessionUser(): Promise<SessionUser | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await verifySession(token, secret);
  } catch {
    return null;
  }
}

/** Only callable from a Server Action or Route Handler (mutable cookie context). */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
