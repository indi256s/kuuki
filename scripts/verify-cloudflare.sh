#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")/.."
export WRANGLER_SEND_METRICS=false

pnpm turbo run build --filter='./packages/*'
pnpm lint
pnpm format:check
node scripts/build-next.mjs --inventory-only
git diff --exit-code apps/next/api-routes.generated.ts
pnpm typecheck --concurrency=1
pnpm typecheck:api
pnpm typecheck:scripts
pnpm typecheck:maintenance
pnpm typecheck:import
pnpm --filter @kuuki/next run test --maxWorkers=2
node --test scripts/verify-cloudflare.test.mjs scripts/check-preview-config.test.mjs scripts/dependency-patches.test.mjs scripts/oxlint-design.test.mjs
pnpm exec tsx scripts/map-geometry.test.ts
pnpm exec tsx scripts/generate-continent-pieces.test.ts
node scripts/check-preview-config.mjs --config apps/next/wrangler.toml --maintenance-config workers/maintenance/wrangler.toml
pnpm build:import
pnpm build:import:release
pnpm test:api --maxWorkers=2
pnpm next:build
pnpm --filter @kuuki/next typecheck:worker
pnpm next:smoke
