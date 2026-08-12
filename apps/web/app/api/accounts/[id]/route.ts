import { prisma } from '@sinal/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAccountById } from '@/lib/accounts/service';
import { errorResponse } from '@/lib/http/errors';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET is not configured');
    await requireAuth(request, secret);

    const { id } = await params;
    const account = await getAccountById(prisma, id);
    return NextResponse.json(account);
  } catch (error) {
    return errorResponse(error);
  }
}
