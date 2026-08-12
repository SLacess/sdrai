import { createCampaign, prisma, type Prisma } from '@sinal/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { CreateCampaignRequestSchema } from '@/lib/campaigns/validation';
import { errorResponse, ValidationError } from '@/lib/http/errors';

export async function POST(request: Request) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET is not configured');
    await requireAuth(request, secret);

    const body = await request.json().catch(() => null);
    const parsed = CreateCampaignRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    const { name, icp, offer, channels, guardrails, frequencyCaps, language } = parsed.data;
    const campaign = await createCampaign(prisma, {
      name,
      icp: icp as Prisma.InputJsonValue,
      offer: offer as Prisma.InputJsonValue,
      channels,
      guardrails: guardrails as Prisma.InputJsonValue,
      frequencyCaps: frequencyCaps as Prisma.InputJsonValue,
      ...(language !== undefined ? { language } : {}),
    });
    return NextResponse.json({ id: campaign.id, name: campaign.name }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
