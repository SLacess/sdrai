'use server';

import { decideApproval, prisma } from '@sinal/db';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session-cookie';

const VALID_DECISIONS = new Set(['APPROVE', 'EDIT', 'REJECT']);

export async function decideApprovalAction(formData: FormData): Promise<void> {
  const reviewer = await getSessionUser();
  if (!reviewer) throw new Error('Not authenticated');

  const approvalId = String(formData.get('approvalId') ?? '');
  const decisionRaw = String(formData.get('decision') ?? '');
  if (!approvalId || !VALID_DECISIONS.has(decisionRaw)) {
    throw new Error('Invalid approval decision submission');
  }
  const decision = decisionRaw as 'APPROVE' | 'EDIT' | 'REJECT';

  const reason = String(formData.get('reason') ?? '').trim();
  const editedBody = String(formData.get('editedBody') ?? '').trim();

  await decideApproval(prisma, {
    approvalId,
    reviewerUserId: reviewer.id,
    decision,
    ...(reason ? { reason } : {}),
    ...(decision === 'EDIT' && editedBody ? { editedPayload: { body: editedBody } } : {}),
  });

  revalidatePath('/approvals');
}
