import { generateDailySupervisorDigest, getDailySupervisorDigest, prisma } from '@sinal/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { errorResponse, NotFoundError, ValidationError } from '@/lib/http/errors';

const DailyDigestRequestSchema = z.object({
  date: z.string().date().optional(),
});

function resolveForDate(dateInput: string | undefined | null): Date {
  const isoDate = dateInput ?? new Date().toISOString().slice(0, 10);
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/**
 * WF-15: n8n's daily trigger calls this to generate the digest, then reads
 * `digestId` back — the digest content itself (KPIs/approvals/failures,
 * never PII) is fetched from the backend rather than carried in the n8n
 * payload, per the workflow's implementation rule.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET is not configured');
    await requireAuth(request, secret);

    const body = await request.json().catch(() => ({}));
    const parsed = DailyDigestRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    const forDate = resolveForDate(parsed.data.date);
    const windowEnd = new Date(forDate.getTime() + 24 * 60 * 60 * 1000);
    const { digest, content } = await generateDailySupervisorDigest(prisma, {
      forDate,
      windowStart: forDate,
      windowEnd,
    });

    return NextResponse.json({ digestId: digest.id, content }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET is not configured');
    await requireAuth(request, secret);

    const url = new URL(request.url);
    const forDate = resolveForDate(url.searchParams.get('date'));
    const digest = await getDailySupervisorDigest(prisma, forDate);
    if (!digest) throw new NotFoundError(`No digest generated for ${forDate.toISOString().slice(0, 10)}`);

    return NextResponse.json({ digestId: digest.id, content: digest.content, generatedAt: digest.generatedAt });
  } catch (error) {
    return errorResponse(error);
  }
}
