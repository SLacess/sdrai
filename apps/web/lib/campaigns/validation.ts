import { z } from 'zod';

export const CreateCampaignRequestSchema = z.object({
  name: z.string().min(1),
  icp: z.record(z.unknown()),
  offer: z.record(z.unknown()),
  channels: z.array(z.enum(['EMAIL', 'LINKEDIN', 'PHONE', 'WHATSAPP'])).min(1),
  guardrails: z.record(z.unknown()),
  frequencyCaps: z.record(z.unknown()),
  language: z.enum(['pt-BR', 'es', 'en']).optional(),
});

export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;
