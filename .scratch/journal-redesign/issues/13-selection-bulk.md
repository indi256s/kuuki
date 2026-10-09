# 13 Selection and bulk actions

Status: done
Type: task
Owner: Opus
Blocked by: 08
Spec: Selection and bulk actions; D1, D5

## What

Hover/focus checkbox, `x` toggles, floating action bar "N selected" with "Select all M matching" (client-side ids, no `/api/flights/ids`). Delete: no confirm dialog, deferred 6s Undo, focus to Undo. Set aircraft: fill-only by default ("Set for 7 without aircraft (3 already set)"), explicit "Replace all 10" tick; `aircraft-batch` chunks of 20. I flew / Did not fly on pending, upcoming skipped and counted. Export selection. Offline disables.

## Done

- Tests: fill-only default sends only empty ones; replace needs tick; delete focuses Undo; upcoming skipped count.
- typecheck, lint, test green.
