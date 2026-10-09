# 11 Detail sheet: split pane, read-first content, inline edits

Status: open
Type: task
Owner: Opus
Blocked by: 05, 08
Spec: Detail sheet; D5

## What

Read-first sheet (route, times with UTC offsets, aircraft, airline, distance and duration, connection, firsts spelled out, provenance). ≥1280px: docked 460px `<aside>` split pane, ledger drops Duration and Distance, selected row highlighted, j/k or click swaps. Below 1280px: `Sheet side="right"` overlay. ≤700px: `.flight-full-sheet` bottom sheet. Inline edits one field at a time through `PATCH /api/flights/:id` (Enter or blur saves, field confirms in place, toast offers Undo by re-PATCHing the previous value, consequence preview line for airport/date changes). Retire the 12.2 dialog edit path (`/journal/[id]/edit` stays as the full editor route). Deep link `?flight=<id>`. Offline disables edits with the existing note.

## Done

- Tests: inline save confirms in place; Undo re-PATCHes; consequence preview appears before saving an airport change; offline disables.
- typecheck, lint, test green.
