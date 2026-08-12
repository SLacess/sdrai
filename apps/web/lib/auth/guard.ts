import { verifySession, type SessionUser, type UserRole } from './session';

export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    public code: 'UNAUTHENTICATED' | 'FORBIDDEN',
    message: string,
  ) {
    super(message);
  }
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verifies the bearer token on the request and returns the session user.
 * Never returns null — callers get a 401 AuthError instead, so route
 * handlers cannot accidentally treat "missing session" as "public access".
 */
export async function requireAuth(request: Request, secret: string): Promise<SessionUser> {
  const token = extractBearerToken(request);
  if (!token) throw new AuthError(401, 'UNAUTHENTICATED', 'Missing or malformed Authorization bearer token');
  try {
    return await verifySession(token, secret);
  } catch {
    throw new AuthError(401, 'UNAUTHENTICATED', 'Session token is invalid or expired');
  }
}

export function requireRole(user: SessionUser, allowed: readonly UserRole[]): SessionUser {
  if (!allowed.includes(user.role)) {
    throw new AuthError(403, 'FORBIDDEN', `Role ${user.role} is not permitted to perform this action`);
  }
  return user;
}

export async function requireAuthWithRole(
  request: Request,
  secret: string,
  allowed: readonly UserRole[],
): Promise<SessionUser> {
  const user = await requireAuth(request, secret);
  return requireRole(user, allowed);
}
