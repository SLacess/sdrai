import { prisma } from '@sinal/db';
import { MockLeadProvider } from '@sinal/integrations';
import { logger } from '@sinal/observability';
import { createIdempotentWorker, createRedisConnection, QUEUE_NAMES } from '@sinal/queue';
import { createAccountDiscoveryProcessor } from './processors/account-discovery';

export * from './processors/account-discovery';

function bootstrap() {
  const connection = createRedisConnection();
  // No APIFY_TOKEN configured yet (see .env.example) — MockLeadProvider keeps
  // the pipeline functional until a real ApifyLeadProvider is wired in.
  const leadProvider = new MockLeadProvider();

  const worker = createIdempotentWorker(
    QUEUE_NAMES.ACCOUNT_DISCOVERY,
    connection,
    createAccountDiscoveryProcessor(prisma, leadProvider),
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'account-discovery job completed'));
  worker.on('failed', (job, error) => logger.error({ jobId: job?.id, err: error }, 'account-discovery job failed'));

  logger.info('worker started, listening on queues: %s', QUEUE_NAMES.ACCOUNT_DISCOVERY);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap();
}
