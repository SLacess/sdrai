'use server';

import { POLICY_CONFIG_KEYS, prisma, updatePolicyConfig, type PolicyConfigKey, type Prisma } from '@sinal/db';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/auth/session-cookie';

const VALID_KEYS = new Set<string>(Object.values(POLICY_CONFIG_KEYS));

export async function updatePolicyConfigAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('Not authenticated');

  const key = String(formData.get('key') ?? '');
  if (!VALID_KEYS.has(key)) throw new Error('Unknown policy key');

  const expectedVersion = Number(formData.get('expectedVersion') ?? '0');
  const rawValue = String(formData.get('value') ?? '');

  let value: unknown;
  try {
    value = JSON.parse(rawValue);
  } catch {
    throw new Error('Policy value must be valid JSON');
  }

  const outcome = await updatePolicyConfig(prisma, {
    key: key as PolicyConfigKey,
    value: value as Prisma.InputJsonValue,
    expectedVersion,
    updatedByUserId: user.id,
  });

  if (outcome.kind === 'CONFLICT') {
    throw new Error(`Policy was changed concurrently (now at version ${outcome.currentVersion}) — reload and retry`);
  }

  revalidatePath('/policies');
}
