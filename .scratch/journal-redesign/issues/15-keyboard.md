# 15 Keyboard map and shortcut popover

Status: done
Type: task
Owner: Sonnet
Blocked by: 08, 11
Spec: Keyboard (desktop)

## What

`/` search, ↑↓ or j/k row focus, Enter opens, Esc closes sheet or clears search, `x` select, `e` edits the focused sheet field, `?` popover listing them. Ignore keys while typing in inputs. No single-key destructive shortcuts.

## Done

- Test per key. typecheck, lint, test green.

## Implementation (2026-10-09)

The page wires useJournalKeys to the real search input, ledger region, selection store, sheet close and shortcuts popover. Moving row focus swaps an open docked detail pane. Other modals retain their keyboard handling; the flight sheet keeps edit/close shortcuts. Empty review placeholders count as an open sheet and retain the docked split layout (ticket 12).

Checks: Next typecheck and affected ESLint pass; 65 focused tests pass across page integration, ledger, toolbar, keyboard and header. Existing key tests cover each shortcut and editable-field exclusion; page integration covers search, focus, selection, native Enter, docked navigation, Escape and help. No single-key destructive action. Browser navigation/layout checks and the build belong to the orchestrator.
