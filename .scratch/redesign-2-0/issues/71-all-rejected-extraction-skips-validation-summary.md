# Synchronous extraction with every row rejected logs no validation summary

Status: resolved
Owner task: import (T11 follow-up)
Source: rereview-T11-r2-sol.md finding N2. Verified at feature/redesign-2.0 69be4b7.

## What is wrong
`functions/api/import/_extract.ts:144` logs `validation_complete` only after `normalizeFlights` returns. When a non-empty extraction has no valid rows, normalization throws (`_extract.ts:246`–`247`), so the summary is never logged. The HTTP response (`PROVIDER_INVALID_RESPONSE`) and refusal behaviour are correct; only the operational log is lost.

## Expected behaviour
Exactly one `validation_complete` summary (`valid: 0`, `total: n`, `rejected: n`) is logged before the all-rejected error propagates.

## Acceptance check
Extend `functions/test/import-provider.test.ts` with a synthetic provider response containing only rejected rows; assert the error code and one `validation_complete` event with the expected counts.

## Continuation disposition — 2026-10-05

8d95a75 emits a compact validation_complete summary when every extracted row is rejected. Sync/stream regressions verify totals and privacy canaries without source/provider text.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
