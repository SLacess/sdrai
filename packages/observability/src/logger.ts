import pino, { type Logger, type LoggerOptions } from 'pino';
import { getTraceContext } from './context';

const isDev = process.env.NODE_ENV !== 'production';
// pino-pretty's transport spawns a worker_thread that requires a real file
// path at runtime. Next.js's dev server (web) intercepts/bundles server-side
// module resolution in a way that breaks that path, throwing an
// uncaughtException the moment this module loads (harmless — the request
// still completes — but noisy and worth avoiding). @sinal/worker runs plain
// tsx with no such interception, so it keeps pretty colorized logs.
const isNextJs = process.env.NEXT_RUNTIME !== undefined;

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
  ...(isDev && !isNextJs ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {}),
};

export const logger: Logger = pino(options);

export function createLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

export type { Logger };
