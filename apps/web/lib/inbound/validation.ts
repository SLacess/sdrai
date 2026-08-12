import { z } from 'zod';

export const InboundWebhookSchema = z.object({
  provider: z.string().min(1),
  eventId: z.string().min(1),
  channel: z.enum(['EMAIL', 'LINKEDIN', 'PHONE', 'WHATSAPP', 'CALENDAR', 'INTERNAL', 'WEB']),
  address: z.string().min(1),
  receivedAt: z.string().datetime(),
  rawContent: z.string(),
  providerThreadId: z.string().optional(),
});

export type InboundWebhookInput = z.infer<typeof InboundWebhookSchema>;
