# Kuuki

Personal flight journal on Cloudflare.

## Where things live

- `apps/next` is the current app: Next App Router, built with OpenNext, running on Workers.
- `apps/web` is the Vite app, kept as the legacy rollback surface. Change it only to keep rollback working.
- API handlers are in `functions/api`. The Next worker also serves them.
- D1 migrations are in `db/migrations`, and the maintenance cron is in `workers/maintenance`.

## Read first

- **UI work:** read `DESIGN.md`. Tokens live only in `apps/next/src/app/styles.css`.
- **Domain work:** read `GLOSSARY.md`, then only the sections of `docs/adr/` that your task touches.
- **Plans and specs:** they are in `docs/plans/` and `.scratch/<feature>/`. Conventions are in `docs/agents/issue-tracker.md`.
- **Reviewing a diff:** apply `CODING_STANDARDS.md`.

## Checks

- `pnpm test` runs the API, Next and legacy unit tests.
- `pnpm install` enables the pre-commit hook in `.githooks/`, which runs lint and typecheck on affected packages.
- The gate for any UI task is the full `pnpm test:next:navigation` suite. Shared controls break journeys in other test files.

## Gotchas

- In a fresh worktree, run `pnpm next:build` before Playwright or `typecheck:worker`. Both read its output.
- Sign-in allows 20 attempts per 15 minutes per client IP, and every Playwright request shares one IP. A test that signs in repeatedly sends its own `CF-Connecting-IP` header, as `apps/next/tests/shell.test.ts` does.
- After adding or removing a `functions/api` route, run `node scripts/build-next.mjs --inventory-only` and commit `apps/next/api-routes.generated.ts`. CI fails on drift.
- After moving an App Router route, run `pnpm --filter @kuuki/next exec next typegen` before typechecking. Stale `.next/types` report TS2307.
- The root `miniflare` (4.20260730) rejects compatibility dates newer than its build. A fixture that needs a newer date uses the Miniflare bundled with Wrangler.
- Downscale screenshots before reading them: `sips -Z 1200 <file>.png`.
- A running subagent-driven plan keeps its progress ledger at `.superpowers/sdd/<plan>/progress.md`, which is untracked.
