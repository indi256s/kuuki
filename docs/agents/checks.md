# Checks

Pick checks by the changed behavior before reporting a change done.

- `pnpm test` runs API integration tests and Next/legacy unit tests; it excludes the separate composed-Worker smoke and browser suites.

Choose checks by the changed behavior, in addition to affected lint/typechecks and regression tests:

| Change | Additional checks |
| --- | --- |
| API handlers | `pnpm typecheck:api`, `pnpm test:api` |
| Next UI | `pnpm next:build`, then the full `pnpm test:next:navigation` suite; shared controls break journeys in other test files |
| Worker dispatch, auth boundary or static assets | `pnpm next:build`, `pnpm --filter @kuuki/next typecheck:worker`, `pnpm next:smoke`, `pnpm next:smoke:boundary` |
| Migration or release tooling | Relevant isolated rehearsal, preservation and admission checks from the release runbooks (`docs/runbooks/2026-10-04-next-release-candidate.md`, `docs/runbooks/audit-remediation-release.md`) |
| Prose only | Verify changed claims, links and commands against their sources; application tests are unnecessary |

Run builds and browser/runtime fixtures serially: they share `.wrangler/next-build` and port 8800. Use current build output after source changes.

## Gotchas

- In a fresh worktree, run `pnpm next:build` before Playwright or `typecheck:worker`. Both read its output.
- Sign-in allows 20 attempts per 15 minutes per client IP, and every Playwright request shares one IP. A test that signs in repeatedly sends its own `CF-Connecting-IP` header, as `apps/next/tests/shell.test.ts` does.
- `apps/next/api-routes.generated.ts` is generated: after changing API paths or exported HTTP methods, run `node scripts/build-next.mjs --inventory-only` and commit the output. Auth endpoints are enumerated in the generator (`scripts/build-next.mjs`).
- After moving an App Router route, run `pnpm --filter @kuuki/next exec next typegen` before typechecking. Stale `.next/types` report TS2307.
- The root Miniflare rejects compatibility dates newer than its build. Check its installed version in `pnpm-lock.yaml`; a fixture that needs a newer date uses the Miniflare bundled with Wrangler.
