# Builds and runs @sinal/worker (BullMQ job processors) from the pnpm
# monorepo root context.
# Build with:  docker build -f apps/worker/Dockerfile -t sinal-worker .
# Run with:    docker run --env-file .env sinal-worker

FROM node:20-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/policies/package.json packages/policies/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/integrations/package.json packages/integrations/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY packages/queue/package.json packages/queue/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS runtime
ENV NODE_ENV=production
# Secrets (DATABASE_URL, REDIS_URL, HUBSPOT_*, EMAIL_API_KEY,
# CALENDAR_CREDENTIAL_REF, APIFY_TOKEN, AI_API_KEY_PRIMARY, ...) are never
# baked into this image — inject them as env vars at deploy time, never
# committed to git (see .env.example).
COPY . .
RUN pnpm db:generate
WORKDIR /repo/apps/worker
CMD ["pnpm", "start"]
