import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifyWebhookSignatureParams {
  /** Raw request body string — verify against the exact bytes received, never a re-serialized copy. */
  payload: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  toleranceSeconds?: number;
}

export type WebhookVerificationResult =
  | { valid: true }
  | { valid: false; reason: 'MISSING_HEADERS' | 'STALE_TIMESTAMP' | 'INVALID_SIGNATURE' };

const DEFAULT_TOLERANCE_SECONDS = 300;

/**
 * HMAC-SHA256 over `${timestamp}.${payload}`, matching openapi.yaml's
 * X-SalesOS-Signature header (paired with an X-SalesOS-Timestamp header for
 * replay-window enforcement). Timing-safe comparison; a stale timestamp is
 * rejected even with a valid signature, since that's how replay protection
 * bounds the window an attacker can reuse a captured request in.
 */
export function verifyWebhookSignature(params: VerifyWebhookSignatureParams): WebhookVerificationResult {
  if (!params.signature || !params.timestamp) return { valid: false, reason: 'MISSING_HEADERS' };

  const timestampSeconds = Number(params.timestamp);
  if (!Number.isFinite(timestampSeconds)) return { valid: false, reason: 'STALE_TIMESTAMP' };

  const toleranceSeconds = params.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > toleranceSeconds) return { valid: false, reason: 'STALE_TIMESTAMP' };

  const expected = createHmac('sha256', params.secret).update(`${params.timestamp}.${params.payload}`).digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  let providedBuffer: Buffer;
  try {
    providedBuffer = Buffer.from(params.signature, 'hex');
  } catch {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }
  return { valid: true };
}
