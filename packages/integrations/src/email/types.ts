export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailResult {
  providerMessageId: string;
}

export interface EmailProvider {
  readonly name: string;
  send(params: SendEmailParams): Promise<SendEmailResult>;
}
