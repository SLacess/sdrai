import pino, { type Logger, type LoggerOptions } from 'pino';
import { getTraceContext } from './context';

const isDev = process.env.NODE_ENV !== 'production';

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  base: { service: process.env.SERVICE_NAME ?? 'sinal' },
  mixin() {
    const trace = getTraceContext();
    if (!trace) return {};
    return {
      correlationId: trace.correlationId,
      entityType: trace.entityType,
      entityId: trace.entityId,
      agentRunId: trace.agentRunId,
    };
  },
  ...(isDev ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
};

export const logger: Logger = pino(options);

export function createLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

export type { Logger };
