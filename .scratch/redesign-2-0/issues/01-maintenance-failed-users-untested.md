# Maintenance `failedUsers` branch has no test

Status: resolved
Owner task: T15
Source: progress.md:149 (T09 parked minor); verified at af92d26

## What is wrong
`workers/maintenance/index.ts:41-49` counts a per-user `applyDueTransitions` throw in `failedUsers` and keeps going, and `:101` turns a non-zero count into the retryable cycle failure `A due transition failed`. No test in `functions/test/maintenance-order.test.ts` makes one user's transition throw, so this branch can be deleted without a red test.

## Expected behaviour
With two due users where one user's transition throws, the other user's transitions still commit, the cycle ends failed (`maintenance_status.last_error` set, `last_success_at` not advanced), and the next healthy cycle recovers.

## Acceptance check
Add a case to `maintenance-order.test.ts` using `instrumentDb` (`hooks.failBatch(...)`, as in the "publication that fails after the transitions committed" case at line 103) scoped to one user. It goes red if the `try/catch` is removed (the second user is never processed) or if `:101` is removed (cycle reports success).

## Continuation disposition — 2026-10-05

74c5575 adds isolated maintenance pre-commit and lost-response post-commit failure regressions, including continued work for the other user and failedUsers admission. Both mutation controls failed as intended; no production maintenance change was needed.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
