# Connection-chain performance test uses an unrealistic fixture

Status: resolved
Owner task: T18
Source: progress.md:140 (T08 parked minor "perf test unrealistic fixture"), task-T08-report.md:85; verified at af92d26

## What is wrong
`functions/test/connections.test.ts:196-205` ("stays linear enough for a long hub history") builds 2000 TBS<->IST same-day pairs three days apart, with no `departure_utc`/`arrival_utc`. Every chain is two legs long, nothing is timed, nothing is ambiguous, and the only assertion is wall-clock `< 2000` ms, which is machine-dependent.

## Expected behaviour
The test models a hub-heavy history: timed and untimed legs mixed, long multi-leg chains, same-date ambiguous pairs, repeated airports. The assertion does not depend on wall-clock time.

## Acceptance check
Replace the timing assertion with an operation-count or scaling check (for example time or compare calls for N and 2N legs stay within a small factor), run on a realistic fixture. It goes red if `connectionChains` regresses to quadratic behaviour on long timed chains, which the current fixture cannot expose.

## Continuation disposition — 2026-10-05

8d95a75 replaces repeated membership scans and suffix walks with visited-set chain traversal. Realistic timed/untimed long-chain fixtures cover the bounded behavior without an arbitrary absolute-time promise.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
