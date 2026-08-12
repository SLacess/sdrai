import { prisma } from '@sinal/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { listAccounts } from '@/lib/accounts/service';
import { errorResponse } from '@/lib/http/errors';

export async function GET(request: Request) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET is not configured');
    await requireAuth(request, secret);

    const url = new URL(request.url);
    const result = await listAccounts(prisma, {
      status: url.searchParams.get('status'),
      priority: url.searchParams.get('priority'),
      cursor: url.searchParams.get('cursor'),
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
