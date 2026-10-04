# Thermos and Ponytail remediation

Reviewed baseline: `5b4427fefb742b5ddc59e626782ef9dd64636fde` on
`checkpoint/architecture-cloud-handoff-20261004`.

## Changes

- Scope persisted draft and flight retry receipt cleanup to the departing
  account. Resolve that account under the identity lock for explicit account
  mutations, including before session bootstrap finishes. Preserve aborts,
  identity broadcasts and full document navigation.
  If the owner lookup fails, continue the account action and skip persisted
  cleanup rather than deleting data under an unconfirmed identity. A browser
  regression verifies successful sign-out during that lookup failure.
- Add a browser regression in which account B creates an import draft and an
  uncertain save receipt while an old account A tab is hidden. Both values must
  survive A's later focus and identity reconciliation. Ordinary sign-out still
  deletes the departing account's values and preserves other accounts' values.
- Share Journal and Passport read services between authenticated RSC and HTTP
  callers. Both transports return the same collections and real revision
  metadata from one owner-scoped D1 batch. Client refreshes no longer copy
  revisions from the initial server payload.
- Remove `next:build:test` and the `KUUKI_TESTING_API` configuration branch.
  Keep the artifact admission check that rejects production testing APIs and
  retain the historical diagnostic evidence in the runtime runbook.
- Remove Next's unused `clsx`, `lucide-react`, `tailwind-merge` and
  `@next/playwright` declarations, plus Vite's unused `radix-ui` umbrella.
  Preserve the Vite packages and individual Radix components that have callers.
- Remove the conditional `agentation-mcp` candidate after finding no project
  invocation or registered local MCP configuration. Preserve the used
  `agentation` UI. Regenerate and install the lockfile offline with direct
  dependency versions unchanged; the package inventory loses 28 version entries.
  Regeneration deduplicates the retained MCP SDK onto the already locked
  `jose` 6.2.12 and normalizes ESLint peer snapshots.

The withdrawn D1 false-empty hypothesis remains withdrawn: actual SQL errors
throw. No speculative error path or implementation-mirroring test was added.
The documented Vite rollback stack, disabled Instant Navigation flags and
security boundaries remain required architecture.

## Verification

Passed for this remediation:

- API suite: 94 tests across 15 files, including the shared owner-read contracts.
- Vite client suite: 58 tests across 10 files.
- Final compiled Next browser suite: 28 tests, including both new regressions.
- Draft storage and preview configuration: 13 checks.
- Workspace, API and Next Worker type checks. Final Next types and lint were
  rerun after the availability and fixture follow-ups.
- Workspace lint: no errors; 22 existing Vite warnings.
- Fresh Next/OpenNext, compiled Pages API, legacy Vite and root Vite/PWA builds.
- Compiled Next workerd smoke and local artifact admission. Final artifact:
  build ID `ZHYrTFQbhCQF2liDAyw0M`, Worker 15,064,095 bytes uncompressed,
  2,742,371 bytes gzip, 132 static assets. Both navigation flags and the
  production testing API remain disabled.
- `git diff --check`.

The lookup-failure regression failed against the previous compiled build,
remaining on Settings with “Could not sign out.” It passed after rebuilding
the follow-up fix. The original cross-tab draft-loss reproduction was verified
before remediation; the final browser regression additionally verifies receipt
preservation.

The expanded browser suite exposed fixture contention at the unchanged
20-sign-ins-per-IP limit. Setup logins use distinct documentation-range client
IPs in local workerd; actual UI requests still exercise the production limit.

Two independent read-only Thermos reviewers checked the remediation. The
availability finding and subsequent fixture change received follow-up review;
no actionable finding remained. The reused smoke and unit evidence covers
unchanged code after the final client-only availability follow-up; the final
browser suite ran against the rebuilt application.

No push, hosted deployment, real provider request or real email delivery was performed.
Local admission does not establish production binding isolation or account
limits. The checkout started clean and existing branch commits were preserved;
only the remediation files were staged.
