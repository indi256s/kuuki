# 04 — Review: ordinal-day year question, flown question, unresolved-date cue

Status: resolved
Type: task
Blocked by: 01
Requirements: QA-05, QA-06, QA-07, QA-09, QA-11, QA-13

## Outcome

The existing review consumes the OQ3 metadata. The year question also covers `date_ordinal_day` (suggested years never preselected, "Other year" validated, day 366 rejected in non-leap years) and answers with the existing date + `yearConfirmed` patch. A new flown question appears for `flown_required` rows dated on or before the member's local today without `flown_confirmed`: "I flew" patches `flownConfirmed: true` (and selects when ready); "Not yet" writes nothing and leaves the row in the review queue. Readiness blocks saving such rows with a visible reason. Rows with an empty date show an accessible "year to confirm" cue instead of a blank date (never a fabricated month/day for ordinal days). Rows with null confidence and `flown_required` show a "Read from the barcode" chip instead of "Confidence unknown": no percentage, no AI or verification wording.

ReviewStep gains a secondary **Finish later** action, shown only while the batch has review rows and no unsaved or pending row change (`dirty` empty, no pending save state). It links to `/journal?queue=awaiting` (the journal already lists import batches with review rows) and states that rows stay in the review queue until the batch expiry date. With unsaved changes it is disabled with the visible reason; it never promises recovery for unacknowledged edits.

## Owned paths

`apps/next/src/client/import/{import-types,draft-saver,review-model,questions,question-deck,review-row,review-step,copy}.ts(x)`, their existing tests, `apps/next/src/client/import/questions.test.ts` (new only if no existing test file covers questions).

## Acceptance

- Unit cases: ordinal → date with leap boundaries (day 60, 366), grouping across New Year, flown question visibility by date/marker, readiness blocker, patch body carries `flownConfirmed`.
- Finish later visibility: hidden/disabled while a change is unsaved.
- EN/RU copy with «вы»; 44px targets via existing Button; existing year/airport/status questions unchanged.
- Checks: `pnpm --filter @kuuki/next typecheck`, `pnpm --filter @kuuki/next lint`, `pnpm --filter @kuuki/next exec vitest run src/client/import`.

## Comments
- 2026-10-12 (final review repair): duplicate Quick Add rows now get the flown question and are never auto-selected; "Another year" max is today's year + 1. Regression case in questions.test.ts (fail-before shown).
