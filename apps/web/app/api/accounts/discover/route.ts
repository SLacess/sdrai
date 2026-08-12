import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { enqueueAccountDiscovery } from '@/lib/accounts/discovery-service';
import { errorResponse, ValidationError } from '@/lib/http/errors';
import { accountDiscoveryQueue } from '@/lib/queues/account-discovery';

const DiscoverAccountsRequestSchema = z.object({
  campaignId: z.string().uuid(),
  limit: z.number().int().min(1).max(5000),
  sourceKeys: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET is not configured');
    await requireAuth(request, secret);

    const body = await request.json().catch(() => null);
    const parsed = DiscoverAccountsRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    const result = await enqueueAccountDiscovery(accountDiscoveryQueue, parsed.data);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
