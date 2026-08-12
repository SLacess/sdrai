import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { signSession, verifySession, type SessionUser } from './session';

const SECRET = 'test-secret-at-least-32-bytes-long!!';
const OTHER_SECRET = 'a-completely-different-secret-value';

const USER: SessionUser = { id: 'user-1', email: 'closer@sinal.ai', role: 'CLOSER' };

describe('signSession / verifySession', () => {
  it('round-trips a session user through sign and verify', async () => {
    const token = await signSession(USER, SECRET);
    const verified = await verifySession(token, SECRET);
    expect(verified).toEqual(USER);
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession(USER, SECRET);
    await expect(verifySession(token, OTHER_SECRET)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await signSession(USER, SECRET, -1);
    await expect(verifySession(token, SECRET)).rejects.toThrow();
  });

  it('rejects a token missing required claims', async () => {
    const encoder = new TextEncoder();
    const malformed = await new SignJWT({ email: USER.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER.id)
      .sign(encoder.encode(SECRET));
    await expect(verifySession(malformed, SECRET)).rejects.toThrow('required claims');
  });

  it('rejects a token with an unrecognized role', async () => {
    const encoder = new TextEncoder();
    const malformed = await new SignJWT({ email: USER.email, role: 'SUPERUSER' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER.id)
      .sign(encoder.encode(SECRET));
    await expect(verifySession(malformed, SECRET)).rejects.toThrow('required claims');
  });
});
