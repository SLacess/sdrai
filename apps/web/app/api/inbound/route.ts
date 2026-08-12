import { prisma } from '@sinal/db';
import { NextResponse } from 'next/server';
import { processInboundWebhook } from '@/lib/inbound/service';
import { errorResponse } from '@/lib/http/errors';

export async function POST(request: Request) {
  try {
    const secret = process.env.INBOUND_WEBHOOK_SECRET;
    if (!secret) throw new Error('INBOUND_WEBHOOK_SECRET is not configured');

    const rawBody = await request.text();
    const result = await processInboundWebhook(prisma, {
      rawBody,
      signature: request.headers.get('x-salesos-signature'),
      timestamp: request.headers.get('x-salesos-timestamp'),
      secret,
    });

    switch (result.kind) {
      case 'UNAUTHORIZED':
        return NextResponse.json({ error: { code: result.reason, message: 'Invalid webhook signature' } }, { status: 401 });
      case 'INVALID':
        return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: result.message } }, { status: 400 });
      case 'DUPLICATE':
        return NextResponse.json({ status: 'DUPLICATE' }, { status: 409 });
      case 'UNMATCHED_CONTACT':
        return NextResponse.json({ status: 'ACCEPTED_UNMATCHED' }, { status: 202 });
      case 'ACCEPTED':
        return NextResponse.json({ status: 'ACCEPTED', inboundMessageId: result.inboundMessageId }, { status: 202 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
