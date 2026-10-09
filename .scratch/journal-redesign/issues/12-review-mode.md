# 12 Review mode

Status: open
Type: task
Owner: Opus
Blocked by: 11
Spec: Detail sheet → Review mode; D1, D6

## What

Pill, Status → To confirm, `queue=awaiting` and `#arrival-<id>` open the sheet with "Did you take this flight? I flew / Did not fly", "Review 2 of 3", "Next to review". I flew reuses the confirm logic extracted from `reads/journal-queue.tsx` (candidate tokens, transit default, receipts, publication wait, newly stamped). Did not fly = deferred delete. Remove `JournalQueue` from the Journal; keep any import-batch review link (D6).

## Done

- Tests: I flew confirms and advances; Did not fly schedules delete with Undo; review counter.
- typecheck, lint, test green.
