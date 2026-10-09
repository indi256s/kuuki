# 17 Retire the old Journal and migrate tests

Status: done
Type: task
Owner: Sol 6.1, orchestrator integration
Blocked by: 05, 08, 09, 11, 12, 13
Spec: D4

## What

Delete `reads/journal.tsx`, `journal-filters.tsx`, `journal-row.tsx`, `journal-queue.tsx` (once review mode owns confirm), `journal-ledger.css`, `journal-range.test.tsx`, old interaction tests; drop `JOURNAL_PAGE_SIZE` use from the Journal. Update `apps/next/tests/read-journeys.test.ts` and `navigation.test.ts` for the new page (keep: no list request on first load, `q` survives reload, Back leaves filter tweaks, `flight` in URL and Escape removes it, select-all-matching then delete with Undo).

## Done

- `pnpm next:build`, full `pnpm test:next:navigation` green.

## Verification

Legacy Journal components, paging helpers and obsolete styles/tests are removed. Historical transit review remains mounted through its extracted component. Browser journeys cover client filters and history, deep-linked sheets, full matching selection, six-second delete/Undo and unmount cancellation, review retry receipts, bulk confirmation and Passport review links.

Final production build passed. Full browser suite: 38 passed on the final source, port 8815; log `/tmp/journal-accepted-navigation.log`. The Settings test uses accessible role locators to avoid the hidden outgoing route copy. No timeout increase.
