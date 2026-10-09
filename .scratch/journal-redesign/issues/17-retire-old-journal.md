# 17 Retire the old Journal and migrate tests

Status: open
Type: task
Owner: Opus (orchestrator)
Blocked by: 05, 08, 09, 11, 12, 13
Spec: D4

## What

Delete `reads/journal.tsx`, `journal-filters.tsx`, `journal-row.tsx`, `journal-queue.tsx` (once review mode owns confirm), `journal-ledger.css`, `journal-range.test.tsx`, old interaction tests; drop `JOURNAL_PAGE_SIZE` use from the Journal. Update `apps/next/tests/read-journeys.test.ts` and `navigation.test.ts` for the new page (keep: no list request on first load, `q` survives reload, Back leaves filter tweaks, `flight` in URL and Escape removes it, select-all-matching then delete with Undo).

## Done

- `pnpm next:build`, full `pnpm test:next:navigation` green.
