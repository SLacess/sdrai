import { enrollContact, prisma } from '@sinal/db';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { EnrollmentRequestSchema } from '@/lib/enrollments/validation';
import { errorResponse, ValidationError } from '@/lib/http/errors';

export async function POST(request: Request) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) throw new Error('AUTH_SECRET is not configured');
    await requireAuth(request, secret);

    const body = await request.json().catch(() => null);
    const parsed = EnrollmentRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues.map((issue) => issue.message).join('; '));
    }

    const outcome = await enrollContact(prisma, parsed.data);
    if (outcome.kind === 'CONFLICT') {
      return NextResponse.json(
        {
          error: {
            code: 'ACTIVE_ENROLLMENT_CONFLICT',
            message: 'Contact already has an active enrollment',
            activeEnrollmentId: outcome.activeEnrollmentId,
          },
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ id: outcome.enrollment.id, state: outcome.enrollment.state }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
