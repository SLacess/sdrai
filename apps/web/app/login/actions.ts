'use server';

import { prisma, recordLogin, verifyUserCredentials } from '@sinal/db';
import { redirect } from 'next/navigation';
import { setSessionCookie } from '@/lib/auth/session-cookie';
import { signSession } from '@/lib/auth/session';

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not configured');

  if (!email || !password) {
    redirect('/login?error=missing_fields');
  }

  const user = await verifyUserCredentials(prisma, email, password);
  if (!user) {
    redirect('/login?error=invalid_credentials');
  }

  await recordLogin(prisma, user.id);
  const token = await signSession({ id: user.id, email: user.email, role: user.role }, secret);
  await setSessionCookie(token);

  redirect('/');
}
