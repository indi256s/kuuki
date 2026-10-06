# Import: cancel on a finished batch says cancelled; account deletion does not abort the job

Status: resolved
Owner task: T21
Source: progress.md:182 and review-T11-findings.md Minor 8 (M8). Verified on wip/redesign-T11 @74f2eb4 (T11 is not merged into af92d26 yet)

## What is wrong
1. `functions/api/_services/importDrafts.ts:490-494` `cancelBatch` updates only `status = 'processing'` rows and returns nothing; `functions/api/import/batches/[id]/cancel.ts:9-11` always answers `{ cancelled: true }`, even for a batch already `review`, `partial`, `failed` or `completed`.
2. `functions/api/auth/account.ts:33` runs `deleteUserCascade` and never calls `abortImportJob`. The provider call keeps running until its next fenced write or the 90 s deadline. No data is lost; it costs money.

## Expected behaviour
Cancel on a non-processing batch reports that nothing changed (for example `{ cancelled: false, status }`). Account deletion aborts the user's live import jobs.

## Acceptance check
(1) A test cancels a `completed` batch and expects `cancelled: false`; red now. (2) A runtime test deletes an account with a processing batch and expects the job aborted (provider stream cancelled); red now.

## Continuation disposition — 2026-10-05

8d95a75 reports cancellation from actual updated rows and aborts only confirmed active work. Account deletion returns the active job IDs read inside its atomic D1 cascade, closing the pre-delete read race. Wrong-password and racing-job regressions pass.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
