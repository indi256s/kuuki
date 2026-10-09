# 12 Review mode

Status: done
Type: task
Owner: orchestrator and Sol 6.1
Blocked by: 11
Spec: Detail sheet → Review mode; D1, D6

## What

Pill, Status → To confirm, `queue=awaiting` and `#arrival-<id>` open the sheet with "Did you take this flight? I flew / Did not fly", "Review 2 of 3", "Next to review". I flew reuses the confirm logic extracted from `reads/journal-queue.tsx` (candidate tokens, transit default, receipts, publication wait, newly stamped). Did not fly = deferred delete. Remove `JournalQueue` from the Journal; keep any import-batch review link (D6).

## Done

- Tests: I flew confirms and advances; Did not fly schedules delete with Undo; review counter.
- typecheck, lint, test green.

## Verification

Review-mode unit checks: 11 passed, including confirmation completing after close and reopen. Feedback and automatic advance stay in the session that started the request. Existing review receipt replay, transit choices, publication feedback and deferred deletion remain covered. Full browser verification is recorded with ticket 18.
