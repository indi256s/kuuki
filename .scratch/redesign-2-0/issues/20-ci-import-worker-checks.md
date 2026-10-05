# CI does not typecheck or build the import worker

Status: resolved
Owner task: architecture (CI owner; T11 implementers do not edit `.github/workflows/ci.yml`)
Source: rereview-T11-r1-sol.md finding M6; ADR 0001 §9 delegates the CI additions. Verified on wip/redesign-T11-fix2 @d55498a

## What is wrong
`.github/workflows/ci.yml` (job steps around lines 30-45) runs `typecheck`, `typecheck:api`, `typecheck:scripts`, `typecheck:maintenance` and `build:maintenance`, but nothing covers `workers/import`. A type error or a broken Wrangler bundle in the import worker (the `ImportJob` Durable Object) passes CI. The `workers/import` code is imported by `functions/test/import-*.test.ts`, so the API tests exercise behaviour, not the worker's own tsconfig or deploy bundle.

## Expected behaviour
CI runs both root scripts that already exist in `package.json`:
- `pnpm typecheck:import` (`tsc --noEmit -p workers/import/tsconfig.json`), next to the other `typecheck:*` steps.
- `WRANGLER_SEND_METRICS=false pnpm build:import` (`wrangler deploy --dry-run --config workers/import/wrangler.local.toml --outdir .wrangler/import-build`), next to `pnpm build:maintenance`.

## Acceptance check
A pull request that introduces a type error in `workers/import/ImportJob.ts` fails the `typecheck:import` step, and one that breaks `workers/import/wrangler.local.toml` fails `build:import`. Both steps are green on the current branch.

## Continuation disposition — 2026-10-05

Import Worker CI ownership remains with the architecture/configuration lane. Local import typecheck/dry-build evidence does not establish the missing CI gate. No workflow or remote deployment was changed.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.

## Resolution — 2026-10-06

`.github/workflows/ci.yml` now runs `pnpm typecheck:import` after `pnpm typecheck:maintenance` and `WRANGLER_SEND_METRICS=false pnpm build:import` after `pnpm build:maintenance`. Both root scripts exit 0 locally. Gate proof: temporarily appending `const __bad: number = "x"` to `workers/import/ImportJob.ts` made `pnpm typecheck:import` fail with TS2322 (exit 2); the file was restored and is not committed. Commit: f7df55d. Nothing was pushed, so the remote CI run is not yet observed.

Checks: `pnpm typecheck:import` exit 0; `WRANGLER_SEND_METRICS=false pnpm build:import` exit 0 (dry-run); gate-bite run failed with TS2322 (exit 2) and was reverted, with `typecheck:import` exit 0 afterwards. Record updated in 9e02904 alongside f7df55d.
