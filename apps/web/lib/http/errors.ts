import { NextResponse } from 'next/server';
import { logger } from '@sinal/observability';
import { AuthError } from '@/lib/auth';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: error.message } }, { status: 404 });
  }
  logger.error({ err: error }, 'Unhandled route error');
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } }, { status: 500 });
}
