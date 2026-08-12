# Deploy — Docker / EasyPanel (BP-045)

Five services, each with its own env boundary. Nothing here bakes a secret
into an image or commits one to git — every value below is injected at
deploy time (EasyPanel's per-service "Environment" tab, or `docker-compose`
reading a local `.env` that stays out of git per `.gitignore`).

## Services and their env boundaries

| Service | Image / build | Needs |
|---|---|---|
| `web` (`@sinal/web`) | `apps/web/Dockerfile` | `DATABASE_URL`, `AUTH_SECRET`, `REDIS_URL`, `INBOUND_WEBHOOK_SECRET`, `HUBSPOT_ACCESS_TOKEN`, `HUBSPOT_WEBHOOK_SECRET`, `HUBSPOT_APP_BASE_URL` (optional), `APP_BASE_URL`, `N8N_CALLBACK_SECRET` |
| `worker` (`@sinal/worker`) | `apps/worker/Dockerfile` | `DATABASE_URL`, `REDIS_URL`, `EMAIL_PROVIDER`/`EMAIL_API_KEY`, `CALENDAR_PROVIDER`/`CALENDAR_CREDENTIAL_REF`, `APIFY_TOKEN`, `AI_PROVIDER_PRIMARY`/`AI_API_KEY_PRIMARY` |
| `postgres` | `postgres:16-alpine`, or an EasyPanel-managed/external Postgres | `POSTGRES_PASSWORD` (container only) — if using a managed instance, skip this service and just point `DATABASE_URL` at it |
| `redis` | `redis:7-alpine`, or a managed Redis | same idea — point `REDIS_URL` at whichever you run |
| `n8n` | `n8nio/n8n:latest` | `N8N_CALLBACK_SECRET` (shared with `web`, used to sign/verify `/api/integrations/n8n/callback` calls), `APP_BASE_URL` (so n8n's HTTP-request nodes know where the backend is) |

`web` and `worker` never receive each other's queue/job-internal secrets
beyond what they both need (`REDIS_URL`) — everything else is scoped to
the service that actually calls that external system, per CLAUDE.md's
"backend is the authority" boundary (n8n and the worker both call *into*
the backend for policy decisions/side effects, not around it).

## Reproducing staging locally

```bash
cp .env.example .env   # fill in real values; this file is gitignored, never commit it
docker compose build
docker compose up -d postgres redis
docker compose run --rm web pnpm db:migrate   # apply migrations against the fresh Postgres
docker compose up -d web worker n8n
```

`docker compose build` uses `apps/web/Dockerfile` and `apps/worker/Dockerfile`
against the monorepo root as build context (so pnpm workspace resolution
sees every `packages/*`), producing images that are reproducible given the
same `pnpm-lock.yaml` — `pnpm install --frozen-lockfile` fails the build if
the lockfile and `package.json` files disagree, so a staging image can
never silently drift from what CI/dev installed.

## EasyPanel specifics

- Create four EasyPanel services from this repo: `web` and `worker` as
  "Dockerfile" app types pointing at `apps/web/Dockerfile` /
  `apps/worker/Dockerfile` with build context set to the repo root (not
  the `apps/*` subfolder — the Dockerfiles `COPY` from the monorepo root).
- Either add EasyPanel's managed Postgres/Redis add-ons and copy their
  connection strings into `DATABASE_URL`/`REDIS_URL` on `web` and
  `worker`, or deploy the `postgres`/`redis` images from this
  `docker-compose.yml` as their own EasyPanel services.
- Deploy `n8n` from the official `n8nio/n8n` image as its own EasyPanel
  service; set `WEBHOOK_URL` to n8n's own public EasyPanel URL and
  `SALESOS_APP_BASE_URL`/`SALESOS_CALLBACK_SECRET` to reach `web`.
- Set every secret (`AUTH_SECRET`, `*_TOKEN`, `*_SECRET`, `*_API_KEY`) via
  EasyPanel's per-service Environment UI — never in the Dockerfile, never
  committed to `.env.example` (which only holds placeholder values).
- `pnpm db:migrate` must be run once against the target `DATABASE_URL`
  after the first deploy (and after any schema change) — it is not run
  automatically by the image's `CMD`, so a redeploy never accidentally
  re-runs migrations against a database another instance is already using.
