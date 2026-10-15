# Coding standards

Read this before changing code and apply it when reviewing a diff. Oxlint, Oxfmt, the pre-commit hook and CI enforce the mechanical rules; these cover what they cannot check.

Formatting uses single quotes and no semicolons; generated files, vendored maps and scratch work are excluded. In a shared checkout, format only owned paths with `pnpm exec oxfmt <paths>`; run repository-wide formatting in an isolated candidate. The direct pre-commit hook selects staged paths but reads working-tree content. For partial staging or shared files, use [shared-checkout Git](docs/agents/shared-checkout.md) to run the hook against the actual candidate.

`pnpm lint` runs Oxlint for `apps/next`. Its config preserves the migrated Next, React, accessibility and TypeScript rules. Native React rules check immutability, refs and state updates in effects; JavaScript compatibility plugins retain Next's navigation checks and React's deprecated API check. The local `kuuki/design-tokens` rule enforces semantic colors and explicit transition properties outside unit tests. JSX usage is handled by Oxlint's unused-variable analysis.

## Where code changes go

- `apps/next` is the application; `packages/client` owns shared browser transports and helpers.
- Design tokens live only in `apps/next/src/app/styles.css`.
- `apps/next/api-routes.generated.ts` is generated: after changing API paths or exported HTTP methods, run `node scripts/build-next.mjs --inventory-only` and commit the output. Auth endpoints are enumerated in the generator (`scripts/build-next.mjs`).

## Verify a change

`pnpm test` runs API integration and Next unit tests; it excludes the separate composed-Worker smoke and browser suites.

Before reporting a change done, run the checks for its behavior in addition to affected lint/typechecks and regression tests:

| Change                                          | Additional checks                                                                                                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API handlers                                    | `pnpm typecheck:api`, `pnpm test:api`                                                                                                                                         |
| Next UI                                         | `pnpm next:build`, then the full `pnpm test:next:navigation` suite; shared controls break journeys in other test files                                                        |
| Worker dispatch, auth boundary or static assets | `pnpm next:build`, `pnpm --filter @kuuki/next typecheck:worker`, `pnpm next:smoke` (includes boundary checks)                                                                 |
| Migration or release tooling                    | Relevant isolated preservation and admission checks from `docs/runbooks/audit-remediation-release.md` and the current deploy procedure in `docs/skills/deploy-kuuki/SKILL.md` |
| Prose only                                      | Verify changed claims, links and commands against their sources; application tests are unnecessary                                                                            |

Run builds and browser/runtime fixtures serially within one checkout: they share `.wrangler/next-build`. Typegen, dependency builds, generators and commit hooks also write shared outputs (`.next`, `.open-next` and package `dist`); coordinate their use or run them in separate candidate checkouts. Use current build output after source changes. A failing shared-checkout check does not authorize changing or staging another owner's unfinished work.

Carry the owner's explicit check waivers into the handoff. Reuse passing evidence
while its candidate, inputs and relevant environment remain unchanged; rerun
affected checks after relevant changes. Review the completed feature once unless
new changes, unresolved findings or the owner require another round.

- In a fresh worktree, run `pnpm next:build` before Playwright or `typecheck:worker`. Both read its output.
- Sign-in allows 20 attempts per 15 minutes per client IP, and every Playwright request shares one IP. A test that signs in repeatedly sends its own `CF-Connecting-IP` header, using `fixtureHeaders` in `apps/next/tests/helpers.ts`.
- After moving an App Router route, run `pnpm --filter @kuuki/next exec next typegen` before typechecking. Stale `.next/types` report TS2307.
- The root Miniflare rejects compatibility dates newer than its build. Check its installed version in `pnpm-lock.yaml`; a fixture that needs a newer date uses the Miniflare bundled with Wrangler.

## Review judgement calls

1. **Contract coverage.** Test credible failures once at the owning boundary. Keep focused regression checks for auth, ownership, data preservation, destructive operations and accessibility. Another layer needs a distinct risk, such as transport or lifecycle behavior. Avoid tests that copy inventories, inspect implementation strings or repeat an existing stronger journey. A regression test must fail against the old behavior.
2. **Carried gaps.** A gap handed to a later task becomes a failing test or an issue file under `.scratch/`, not only a ledger note.
3. **Gate before read.** Auth, ownership and visibility checks run before any private read. A guest gets a redirect status, not a streamed 200.
4. **Canonical fields win.** In error envelopes and DTOs, spread optional details first and the canonical fields (`error`, `code`, ids, states) after.
5. **Historical data.** Repair and derivation code tolerates malformed legacy rows: it skips and reports them without throwing. Migrations are additive and preserve historical passport evidence.
6. **States and copy.** UI diffs follow `DESIGN.md` "Interaction and states": loading, empty, partial, error and ready stay distinct. Every user-visible string has EN and RU copy, with real plural forms and «вы».
7. **Docs match config.** Runbook and ADR statements about flags, bindings and environments match the checked-in `wrangler.toml` files and workflows. Report conflicts with the intended ADR/runbook contract; configuration alone does not establish deployment or release acceptance.
