Plan contract: wave-plan/v1

# Legacy cleanup

Goal: address the post-redesign legacy audit with a smaller, independently usable Next application and a working Vite rollback.
Architecture: keep shared browser API/CSV/geo code in private `@kuuki/client`; retain pure domain/reference packages and server implementations.
Success: accent settings survive reload, obsolete draft links and orphan code are gone, Next has no imports from Vite source, and required functional/build/runtime checks pass.
Out of scope: hosted cutover, public API retirement, database/schema deletion, sending mail, paid provider calls, visual inspection, removal of active/evidence-bearing worktrees.
Constraints: preserve user data and identity-reset draft sweep; serialize builds and browser/runtime fixtures; preserve unrelated work.
Planning basis: [audit](../audits/2026-10-06-legacy-code-audit.md), `AGENTS.md`, `DESIGN.md`, source and package manifests.
Execution profile: primary=runtime-selected; workers=gpt-6-sol/medium; reviewers=gpt-6-sol/medium; exact-profile-attestation=not-requested
Authority evidence: user “Address all” after the audit; local changes only.

## Execution map

| Wave | Outcome                                | Depends on | Writes (active owner)                                                                                                                                                               | Reads / validates                | Parallel-safe with                                     | Material risk → primary proof                                                        | Acceptance owner |
| ---- | -------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------- |
| W1   | Fix preferences and remove orphan code | —          | Next bootstrap/drafts/CSS (Next worker); Vite components/hooks/dead helpers (Vite worker); client package and import migration (client worker); API constants/config/docs (primary) | Audit/callers                    | Other W1 owners, with excluded files transferred later | Preference reversion and rollback regression → focused test, lint/types, unit suites | primary          |
| W2   | Integrate, review and verify           | W1         | W1 ownership transfers to primary; audit dispositions and handoff                                                                                                                   | Complete diff and required gates | Read-only reviewer                                     | Import/mocking/runtime regressions → build, navigation and composed/boundary smoke   | primary          |

## W1: Coherent cleanup

Remove verified orphans, not framework entrypoints, exposed endpoints, meaningful tests or historical data. Preserve `clearDrafts` for old browser data. A valid current accent cookie wins; use the legacy value only for migration. Move seven shared modules to `@kuuki/client` without forwarding legacy aliases or a dependency cycle. Model current client rows explicitly instead of importing Supabase-generated flight/claim types. Consolidate demonstrated coupled limits using the existing shared constants module; leave intentionally distinct validation and small helpers local. Correct documentation and mark historical assets/tools explicitly.

Focused proof: a bootstrap regression fails against the old code; both frontends' existing API and geo tests retain behavior. No agent runs builds/browser fixtures or Vitest while other writers mutate sources.

- [x] W1 accepted by primary after reviewing all edits.

## W2: Final evidence

Review the complete diff independently. Run lint and affected types, `pnpm test`, `pnpm next:build`, Worker typecheck, the full navigation suite, composed/boundary Worker smokes and rollback rehearsal serially. Fix failures at their actual owners and repeat only affected checks. Record intentional retention and release-only gates in the audit disposition rather than claim deployment acceptance.

- [x] W2 accepted after checks and review.

## Final evidence gate

Identity: base `65107ee` plus final tracked diff and added files; retain local check logs.

| Lane       | Proves                                      | Command or scenario                                                                                                                  | Success signal    | Parallel-safe        |
| ---------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | -------------------- |
| types/lint | Imports, API types and project conventions  | `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:api`, `pnpm typecheck:scripts`, `pnpm typecheck:maintenance`, `pnpm typecheck:import` | exit 0            | After writers finish |
| units      | API and both frontend behavior              | `pnpm test`                                                                                                                          | exit 0            | After writers finish |
| runtime    | Current built Worker, boundary and rollback | `pnpm next:build`, Worker types, `pnpm next:smoke`, `pnpm next:smoke:boundary`, `pnpm exec tsx scripts/rehearse-next-rollback.ts`    | exit 0            | no                   |
| navigation | All shared-control journeys                 | `pnpm test:next:navigation`                                                                                                          | full suite passes | no                   |

Final acceptance: primary confirms every audit finding has an implementation or justified retention disposition; no hosted changes inferred.

Final results: 45 API files / 515 tests, 101 Next files / 1,060 tests,
12 Vite files / 65 tests, and all 102 navigation tests pass. Required builds,
types/lint, Worker smokes, local rollback and artifact admission pass. The initial
Next unit failures were missing DOM matcher registration; the shared test setup
now extends the local Vitest expect explicitly, with a red/green button probe
and the complete Next suite confirming the fix. The API result was reused when
rerunning the two frontend legs; no API source changed after its accepted run.
See the adjacent handoff for evidence paths and retained boundaries.
