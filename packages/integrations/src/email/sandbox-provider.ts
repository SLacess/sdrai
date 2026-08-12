import { randomUUID } from 'node:crypto';
import type { EmailProvider, SendEmailParams, SendEmailResult } from './types';

export interface SandboxSentEmail extends SendEmailParams {
  providerMessageId: string;
  sentAt: Date;
}

/**
 * Matches EMAIL_PROVIDER=stub in .env.example: never calls a real API,
 * records every send in memory so tests/dev can assert on what "went out".
 */
export class SandboxEmailProvider implements EmailProvider {
  readonly name = 'sandbox';
  private readonly sent: SandboxSentEmail[] = [];

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    const providerMessageId = randomUUID();
    this.sent.push({ ...params, providerMessageId, sentAt: new Date() });
    return { providerMessageId };
  }

  getSentEmails(): readonly SandboxSentEmail[] {
    return this.sent;
  }
}
