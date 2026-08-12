import { describe, expect, it } from 'vitest';
import { AuthError, requireAuth, requireAuthWithRole, requireRole } from './guard';
import { signSession, type SessionUser } from './session';

const SECRET = 'test-secret-at-least-32-bytes-long!!';
const CLOSER: SessionUser = { id: 'user-1', email: 'closer@sinal.ai', role: 'CLOSER' };
const ADMIN: SessionUser = { id: 'user-2', email: 'admin@sinal.ai', role: 'ADMIN' };

function requestWithAuth(headerValue: string | undefined): Request {
  const headers = new Headers();
  if (headerValue !== undefined) headers.set('authorization', headerValue);
  return new Request('http://localhost/api/accounts', { headers });
}

describe('requireAuth', () => {
  it('returns the session user for a valid bearer token', async () => {
    const token = await signSession(CLOSER, SECRET);
    const user = await requireAuth(requestWithAuth(`Bearer ${token}`), SECRET);
    expect(user).toEqual(CLOSER);
  });

  it('rejects a request with no Authorization header', async () => {
    await expect(requireAuth(requestWithAuth(undefined), SECRET)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('rejects a header that is not a Bearer token', async () => {
    await expect(requireAuth(requestWithAuth('Basic abc123'), SECRET)).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects an invalid/tampered token', async () => {
    await expect(requireAuth(requestWithAuth('Bearer not-a-real-token'), SECRET)).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('requireRole', () => {
  it('returns the user when the role is allowed', () => {
    expect(requireRole(ADMIN, ['ADMIN', 'SUPERVISOR'])).toBe(ADMIN);
  });

  it('rejects a RED-tier action for a role that is not permitted', () => {
    let caught: unknown;
    try {
      requireRole(CLOSER, ['ADMIN', 'SUPERVISOR']);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AuthError);
    expect((caught as AuthError).status).toBe(403);
    expect((caught as AuthError).code).toBe('FORBIDDEN');
  });
});

describe('requireAuthWithRole', () => {
  it('combines authentication and role checks', async () => {
    const token = await signSession(ADMIN, SECRET);
    const user = await requireAuthWithRole(requestWithAuth(`Bearer ${token}`), SECRET, ['ADMIN']);
    expect(user).toEqual(ADMIN);
  });

  it('rejects when authenticated but under-privileged', async () => {
    const token = await signSession(CLOSER, SECRET);
    await expect(
      requireAuthWithRole(requestWithAuth(`Bearer ${token}`), SECRET, ['ADMIN']),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });

  it('rejects when unauthenticated before role is even checked', async () => {
    await expect(requireAuthWithRole(requestWithAuth(undefined), SECRET, ['ADMIN'])).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });
});
