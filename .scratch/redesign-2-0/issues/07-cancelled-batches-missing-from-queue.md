# Cancelled import batches do not appear in the awaiting queue

Status: resolved
Owner task: T13/T15
Source: progress.md:182 and review-T11-findings.md Minor 10 (M10); verified at af92d26 (queue) and wip/redesign-T11 @74f2eb4 (cancel)

## What is wrong
Cancel keeps the rows already persisted, but `functions/api/_services/queue.ts:103` lists only batches with `status IN ('processing','review','partial')`. After cancel, the preserved review rows are reachable only by batch id, so a user who cancels midway cannot find them in the queue.

## Open question (why triage)
Is keeping rows after cancel meant to be a promise (list them: add `cancelled` with review rows to the query), or should cancel discard them? Decide with the queue owner.

## Acceptance check
Whichever way it is decided: a test creates a processing batch with 2 persisted review rows, cancels it, reads the queue, and expects either the batch listed with `review_rows: 2` or the rows gone. It is red today (rows kept, batch not listed).

## Continuation disposition — 2026-10-05

8d95a75 includes cancelled batches with retained review rows in the actionable queue; expired and discarded rows remain excluded.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
