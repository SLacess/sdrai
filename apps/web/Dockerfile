# Builds and runs @sinal/web (Next.js) from the pnpm monorepo root context.
# Build with:  docker build -f apps/web/Dockerfile -t sinal-web .
# Run with:    docker run -p 3000:3000 --env-file .env sinal-web
#
# Not using `next build`'s standalone output tracer here: it symlinks into
# pnpm's node_modules layout in a way that needs elevated privileges on
# Windows dev machines, and skipping it keeps this Dockerfile identical in
# spirit to what `pnpm build` already does locally — one less divergent
# path between dev and the image. The tradeoff is a larger runtime image
# (full node_modules instead of a traced subset), which is an acceptable
# cost for a staging deploy.

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

FROM deps AS build
COPY . .
RUN pnpm db:generate
RUN pnpm --filter @sinal/web... build

FROM base AS runtime
ENV NODE_ENV=production
# Secrets (DATABASE_URL, AUTH_SECRET, REDIS_URL, INBOUND_WEBHOOK_SECRET,
# HUBSPOT_*, EMAIL_API_KEY, AI_API_KEY_PRIMARY, ...) are never baked into
# this image — inject them as env vars at deploy time (EasyPanel's env UI
# or `docker run --env-file`), never committed to git (see .env.example).
COPY --from=build /repo /repo
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
