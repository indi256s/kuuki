# 07 Arc primitives B: filter-toolbar, chip-group, multi-select, swipe-actions, year presets

Status: done
Type: task
Owner: Sonnet
Blocked by: —
Spec: Page structure 4; Mobile; D7

## What

Same adaptation rules as 06. `filter-toolbar` + `chip-group` (a chip shows facet name, up to two values plus +N, opens its picker, removable), `multi-select` (searchable, checkbox options with counts, Popover on desktop and `Sheet` on mobile like `combobox.tsx`), `swipe-actions` (pointer-driven, left and right actions, 44px targets, a menu path must exist so nothing is swipe-only, reduced motion snaps), and year presets for `date-range-picker.tsx` (an optional `presets` prop; do not break existing callers).

## Done

- Tests: multi-select keyboard selection; swipe-actions fires the action past the threshold and exposes buttons to assistive tech; date-range-picker preset applies a whole year.
- `pnpm --filter @kuuki/next typecheck`, `lint`, `test` green.
