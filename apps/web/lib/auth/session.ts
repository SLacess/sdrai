import { jwtVerify, SignJWT } from 'jose';

export const USER_ROLES = ['ADMIN', 'SUPERVISOR', 'CLOSER'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
}

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(
  user: SessionUser,
  secret: string,
  expiresInSeconds = 60 * 60 * 8,
): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
    .sign(getSecretKey(secret));
}

export async function verifySession(token: string, secret: string): Promise<SessionUser> {
  const { payload } = await jwtVerify(token, getSecretKey(secret));
  const { sub, email, role } = payload;
  if (typeof sub !== 'string' || typeof email !== 'string' || !isUserRole(role)) {
    throw new Error('Session token payload is missing required claims');
  }
  return { id: sub, email, role };
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}
