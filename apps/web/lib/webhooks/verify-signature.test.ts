import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhookSignature } from './verify-signature';

const SECRET = 'test-webhook-secret';
const PAYLOAD = '{"eventId":"evt-1","provider":"n8n"}';

function sign(payload: string, timestamp: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
}

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed, fresh request', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(PAYLOAD, timestamp);
    expect(verifyWebhookSignature({ payload: PAYLOAD, signature, timestamp, secret: SECRET })).toEqual({ valid: true });
  });

  it('rejects a missing signature header', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(verifyWebhookSignature({ payload: PAYLOAD, signature: null, timestamp, secret: SECRET })).toEqual({
      valid: false,
      reason: 'MISSING_HEADERS',
    });
  });

  it('rejects a missing timestamp header', () => {
    const signature = sign(PAYLOAD, '123');
    expect(verifyWebhookSignature({ payload: PAYLOAD, signature, timestamp: null, secret: SECRET })).toEqual({
      valid: false,
      reason: 'MISSING_HEADERS',
    });
  });

  it('rejects a signature computed with the wrong secret', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(PAYLOAD, timestamp, 'wrong-secret');
    expect(verifyWebhookSignature({ payload: PAYLOAD, signature, timestamp, secret: SECRET })).toEqual({
      valid: false,
      reason: 'INVALID_SIGNATURE',
    });
  });

  it('rejects a signature computed over a different payload (tampering)', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = sign(PAYLOAD, timestamp);
    const tamperedPayload = '{"eventId":"evt-1","provider":"n8n","extra":"injected"}';
    expect(verifyWebhookSignature({ payload: tamperedPayload, signature, timestamp, secret: SECRET })).toEqual({
      valid: false,
      reason: 'INVALID_SIGNATURE',
    });
  });

  it('rejects a timestamp outside the tolerance window (replay of an old request)', () => {
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 3600);
    const signature = sign(PAYLOAD, oldTimestamp);
    expect(verifyWebhookSignature({ payload: PAYLOAD, signature, timestamp: oldTimestamp, secret: SECRET })).toEqual({
      valid: false,
      reason: 'STALE_TIMESTAMP',
    });
  });

  it('rejects a non-numeric timestamp', () => {
    const signature = sign(PAYLOAD, 'not-a-number');
    expect(
      verifyWebhookSignature({ payload: PAYLOAD, signature, timestamp: 'not-a-number', secret: SECRET }),
    ).toEqual({ valid: false, reason: 'STALE_TIMESTAMP' });
  });

  it('rejects a malformed (non-hex) signature without throwing', () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    expect(
      verifyWebhookSignature({ payload: PAYLOAD, signature: 'not-hex-!!', timestamp, secret: SECRET }),
    ).toEqual({ valid: false, reason: 'INVALID_SIGNATURE' });
  });

  it('honors a custom tolerance window', () => {
    const timestamp = String(Math.floor(Date.now() / 1000) - 30);
    const signature = sign(PAYLOAD, timestamp);
    expect(
      verifyWebhookSignature({ payload: PAYLOAD, signature, timestamp, secret: SECRET, toleranceSeconds: 10 }),
    ).toEqual({ valid: false, reason: 'STALE_TIMESTAMP' });
    expect(
      verifyWebhookSignature({ payload: PAYLOAD, signature, timestamp, secret: SECRET, toleranceSeconds: 60 }),
    ).toEqual({ valid: true });
  });
});
