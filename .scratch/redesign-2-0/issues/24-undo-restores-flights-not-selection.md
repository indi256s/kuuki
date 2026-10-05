# Undo after a bulk delete restores the flights but not the selection

Status: wontfix
Owner task: T13
Source: T13 fix round 1 concern; `apps/next/src/client/reads/journal.tsx` (`scheduleDelete`)

## What differs
Scheduling a delete clears the selection (so no stale "Cancel" or action bar remains). Undo therefore brings the rows back unselected; a user who selected 40 flights must select them again.

## Decision needed
Whether Undo should restore the previous selection (keep the ids in the pending record and re-select them on Undo, if they are still on the page or still match the query).

## Acceptance check
A Journal unit test: select two rows, delete, Undo, and the same two rows are checked; a changed query between delete and Undo restores nothing.

## Continuation disposition — 2026-10-05

Accepted Journal Undo restores the rows and deliberately clears the previous selection before a write/query transition. Restoring stale selected IDs is not the current interaction contract.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
