# Kuuki

Personal flight journal on Cloudflare.

Use `gh-axi` for GitHub and `chrome-devtools-axi` for browser automation.

## Where things live

- `apps/next` is the current app: Next App Router, built with OpenNext, running on Workers.
- `apps/web` is the Vite app, kept as the legacy rollback surface. Change it only to keep rollback working.
- API handlers are in `functions/api`. `apps/next/worker.ts` dispatches them through direct handlers and the compiled Pages Worker.

## Read first

- **UI work:** read `DESIGN.md`. Tokens live only in `apps/next/src/app/styles.css`.
- **Domain work:** read `GLOSSARY.md`, then only the sections of `docs/adr/` that your task touches.
- **Plans and specs:** they are in `docs/plans/` and `.scratch/<feature>/`. Conventions are in `docs/agents/issue-tracker.md`.
- **Resuming a plan:** read its adjacent `*-handoff.md` first and locate the owning checkout with `git worktree list` before creating progress files.
- **Reviewing a diff:** apply `CODING_STANDARDS.md`.
- **Deploying:** CI only verifies; deploys are manual through the `deploy-kuuki` skill.
- **Runtime or release work:** read `docs/runbooks/2026-10-04-next-release-candidate.md`; for D1 migration/cutover gates, read `docs/runbooks/audit-remediation-release.md`.

## Sources of truth

Run commands from the workspace root containing `pnpm-workspace.yaml`. Legacy Vite/Supabase descriptions are historical context. Report conflicts with the intended ADR/runbook contract; configuration alone does not establish deployment or release acceptance.

## Checks

- `pnpm test` runs API integration tests and Next/legacy unit tests; it excludes the separate composed-Worker smoke and browser suites.

Choose checks by the changed behavior, in addition to affected lint/typechecks and regression tests:

| Change | Additional checks |
| --- | --- |
| API handlers | `pnpm typecheck:api`, `pnpm test:api` |
| Next UI | `pnpm next:build`, then the full `pnpm test:next:navigation` suite; shared controls break journeys in other test files |
| Worker dispatch, auth boundary or static assets | `pnpm next:build`, `pnpm --filter @kuuki/next typecheck:worker`, `pnpm next:smoke`, `pnpm next:smoke:boundary` |
| Migration or release tooling | Relevant isolated rehearsal, preservation and admission checks from the release runbooks above |
| Prose only | Verify changed claims, links and commands against their sources; application tests are unnecessary |

Run builds and browser/runtime fixtures serially: they share `.wrangler/next-build` and port 8800. Use current build output after source changes. Local preflight is read-only and does not authorize remote D1 writes; those require the runbook's explicit target, writer hold, backup/restore proof, schema admission and separate authorization.

## Gotchas

- In a fresh worktree, run `pnpm next:build` before Playwright or `typecheck:worker`. Both read its output.
- Sign-in allows 20 attempts per 15 minutes per client IP, and every Playwright request shares one IP. A test that signs in repeatedly sends its own `CF-Connecting-IP` header, as `apps/next/tests/shell.test.ts` does.
- `apps/next/api-routes.generated.ts` is generated: after changing API paths or exported HTTP methods, run `node scripts/build-next.mjs --inventory-only` and commit the output. Auth endpoints are enumerated in the generator (`scripts/build-next.mjs`).
- After moving an App Router route, run `pnpm --filter @kuuki/next exec next typegen` before typechecking. Stale `.next/types` report TS2307.
- The root Miniflare rejects compatibility dates newer than its build. Check its installed version in `pnpm-lock.yaml`; a fixture that needs a newer date uses the Miniflare bundled with Wrangler.
- Downscale screenshots before reading them: `sips -Z 1200 <file>.png`.
- At a session handoff, update `docs/plans/<plan>-handoff.md` with the owning branch/checkout, scope, accepted progress, latest checks and next action or blocker; include it in the handoff commit. Detailed `.superpowers/sdd/<plan>/progress.md` ledgers stay local. Reconcile the note with current Git and review evidence before acting.
