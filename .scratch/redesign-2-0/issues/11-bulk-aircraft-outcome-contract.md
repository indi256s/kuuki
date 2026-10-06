# H3: no bulk-aircraft outcome contract; T14 uses the existing aircraft-batch outcomes

Status: resolved
Owner task: T15 / architecture
Source: progress.md:176; docs/plans/2026-10-04-redesign-2.0-implementation.md:141, :470; task-T14-brief.md:12; verified at af92d26

## What is wrong
The plan has T14 consume "H3's bounded bulk-aircraft outcome contract" with saved, failed and uncertain rows shown individually. H3 did not deliver it (plan line 739 marks H3 "Partial"). The only contract is `functions/api/flights/aircraft-batch.ts:10-12`: per item `accepted` or `error`, up to 20 items, one atomic D1 batch. There is no `uncertain` outcome (a timed-out or dropped response leaves the client not knowing which rows were written), and the client type `BatchResult` in `apps/next/src/client/capture/passport-manage.tsx:18` repeats the two-state shape. T14 builds its aircraft review on that, so it will be reworked when the contract lands.

## Open question (why triage)
Who owns the contract (architecture session or T15 shared-contracts review), and whether `uncertain` means a client-side reconcile read or a server idempotency key.

## Acceptance check
Once decided: a contract test on `aircraft-batch` for the new outcome (for example a replayed request with the same operation id returns the original per-item results), and a T14 UI test that renders saved, failed and uncertain rows separately. Neither exists today.

## Continuation disposition — 2026-10-05

The architecture-owned server bulk-aircraft outcome/idempotency contract is still required. Accepted UI repairs preserve failed/uncertain outcomes and reconcile canonical reads within the bounded existing endpoint; they do not establish a new server contract.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.

## Resolution — 2026-10-06

Contract choice: replay-safe absolute set. `aircraft-batch` writes an absolute `aircraft_icao`, so an identical replay returns `accepted` with the same flight state, leaves the rows unchanged, and republishes derived state without double-counting. `uncertain` is a client-side outcome (lost or ambiguous answer) resolved by resending the same items and re-reading the flights list. A server receipt/idempotency table was deliberately not added, and there is no migration. The handler change is its header comment only; the new tests showed replay is already equivalent.

- API contract tests (`functions/test/flights.test.ts`): identical replay gives equal per-item results and unchanged flight rows; a partial batch (valid, NOT_FOUND, UNKNOWN_AIRCRAFT) replays to the same outcome; `user_stats` and advanced aircraft breakdowns are equal after replay (revision advances, publication stays ready).
- `/passport/manage` now uses the shared `acceptAircraft` runner and outcome types from `aircraft-review.ts`: saved, failed and uncertain rows are listed separately, uncertain rows stay selected with the same calm note and "Try again for the rest" (resends the type originally sent), the list reloads after every outcome, and the 20-item limit stays. The local two-state `BatchResult` and general `mutate` are gone.
- Unit tests: `apps/next/src/client/capture/passport-manage.test.tsx`; navigation: `capture.test.ts` (port 8803).
- Leftovers from C6 review: dead `.capture-manage form` rule removed; duplicate section `<h2>` removed (paragraph kept).

Implementing commits: `3a04def` (replay contract tests, shared runner on `/passport/manage`), `ad62bda` and `4d6d1d1` (polite/assertive result announcements for each submission, flight dates formatted), all on `wip/redesign-C3-aircraft`. The shared `AircraftPanel` (Import and the Overview missing-aircraft sheet) received the same announcement pattern in the final-review fix commit `2ea4654`, reusing the summary helpers in `aircraft-review.ts`.

C3 task check results: `pnpm test:api` 502/502 (44 files); `pnpm typecheck:api` ok; Next units 987/987; Next lint and typecheck clean; `pnpm next:build` ok; `capture.test.ts` 3/3 on port 8803 (trace off). After the review fixes: `passport-manage.test.tsx` 7/7, lint and typecheck clean (navigation not re-run; no change to the asserted save-flow text). The integrated whole-branch results are recorded separately in the handoff once available.
