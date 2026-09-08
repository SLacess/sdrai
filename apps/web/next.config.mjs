import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// `next dev`/`next start` run with this file's directory (apps/web) as cwd,
// so Next's built-in .env loading never sees the monorepo-root `.env` the
// README tells contributors to create. Load it here, once, before anything
// else in this process reads process.env. In production (Docker/EasyPanel)
// there is no root `.env` — secrets are injected as real env vars — so this
// is a no-op there.
const rootEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');
if (existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // bullmq/ioredis use worker_threads and dynamic requires that don't
  // survive webpack bundling into the API route handlers' server output —
  // keep them un-bundled so they see real on-disk paths at runtime.
  serverExternalPackages: ['bullmq', 'ioredis'],
};

export default nextConfig;
