import { z } from 'zod';

export const EnrollmentRequestSchema = z.object({
  campaignId: z.string().uuid(),
  contactId: z.string().uuid(),
});

export type EnrollmentRequest = z.infer<typeof EnrollmentRequestSchema>;
