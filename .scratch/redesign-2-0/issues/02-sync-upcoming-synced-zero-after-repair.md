# sync-upcoming reports `synced: 0` after a stamp-only repair, so apps/web skips its cache refresh

Status: resolved
Owner task: T24
Source: progress.md:128, :140 (T07 parked minor); verified at af92d26. Cosmetic, rollback app only.

## What is wrong
`functions/api/flights/sync-upcoming.ts:27` returns `synced: due.synced` plus the inline repair result. When no flight changed but the evidence stamp was stale, the repair republishes and the body is `{ synced: 0, derived_state: 'ready', revision }` (asserted today at `functions/test/evidence-stamp.test.ts:72`). `apps/web/src/hooks/useFlights.ts:320` only calls `reconcileDerivedState` when `ack.synced > 0`, so the rollback app keeps its stale stats until the next fetch.

## Expected behaviour
A sync that republished derived state makes `apps/web` refresh its caches. Either `apps/web` also reconciles when the ack carries `derived_state`/`revision`, or the contract changes (note the documented meaning of `synced` at `sync-upcoming.ts:5-6`). The owner picks one.

## Acceptance check
A `useSyncUpcomingFlights` test in `apps/web` that resolves `{ synced: 0, derived_state: 'ready', revision: 3 }` and expects `reconcileDerivedState` to be called. It is red at af92d26 (the `synced > 0` guard).

## Continuation disposition — 2026-10-05

8d95a75 reconciles upcoming publication acknowledgments even when synced is zero. The rollback hook regression covers the repaired-server response.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
