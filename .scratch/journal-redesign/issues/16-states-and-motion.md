# 16 States and motion

Status: open
Type: task
Owner: Sonnet
Blocked by: 08
Spec: States; Motion

## What

Empty journal (Add or Import), no matches (Clear filters), loading skeleton in the final ledger layout (`journal/loading.tsx`), background refresh failed (keep rows, alert with retry), publication pending note, offline note. 150ms opacity crossfade when the result set changes; no row FLIP; reduced motion instant. Fix 12.4 copy (no "Cloudflare D1", no offline-edit claim); retire the delete-confirm dialog and 8s undo copy.

## Done

- Tests for empty vs no-match vs refresh-failed. typecheck, lint, test green.
