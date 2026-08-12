import { decideApproval, prisma, type Prisma } from '@sinal/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { errorResponse, ValidationError } from '@/lib/http/errors';

const ApprovalDecisionRequestSchema = z.object({
  decision: z.enum(['APPROVE', 'EDIT', 'REJECT']),
  editedPayload: z.record(z.unknown()).optional(),
  reason: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET is not configured');
    const user = await requireAuth(request, secret);

    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = ApprovalDecisionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    const outcome = await decideApproval(prisma, {
      approvalId: id,
      reviewerUserId: user.id,
      decision: parsed.data.decision,
      ...(parsed.data.editedPayload !== undefined
        ? { editedPayload: parsed.data.editedPayload as Prisma.InputJsonValue }
        : {}),
      ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
    });

    if (outcome.kind === 'NOT_FOUND') {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: `Approval ${id} not found` } }, { status: 404 });
    }
    if (outcome.kind === 'CONFLICT') {
      return NextResponse.json(
        {
          error: {
            code: 'ALREADY_DECIDED',
            message: `Approval is already ${outcome.currentStatus.toLowerCase()} and cannot be decided again`,
          },
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ id: outcome.approval.id, status: outcome.approval.status });
  } catch (error) {
    return errorResponse(error);
  }
}
