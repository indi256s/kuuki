# Ground travel: free Arc candidates

Date: 2026-10-13. Scope: read-only research for `/ground-travel`. Arc Pro source was not fetched, read or reconstructed.

## Evidence (fetched 2026-10-13)

- `https://uiarc.dev/r/registry.json`: 135 items, every `meta.tier` = `free` (no Pro entries in this index). `https://uiarc.dev/llms.txt` says "132 of 250 items are free" and marks Pro items with `(Pro)`. Pro installs only from the token-gated `@uiarc-pro` registry, so Pro source is out of reach and out of bounds.
- Licence for free items: MIT, already reproduced in `apps/next/src/client/ui/ARC-LICENSE.txt`. Nothing about it changed.
- Registry check by name: `sortable-list` and `reorder-list` return 404. The catalog's drag-and-reorder items (`kanban-board`, `project-board`, `workspace-sidebar` draggable favorites) are all **Pro**: do not use them. **Arc has no free sortable/reorderable list.**
- There is no free Arc map or route item. Pro has map blocks; they are out of bounds.

## Need → owner → candidate

| Need | Local owner (exists) | New free Arc candidate | Deps | Recommendation |
| --- | --- | --- | --- | --- |
| Journey cards, rail/road distinguishable | `ui/category-mark.tsx`, `ui/airline-mark.tsx`, `ui/chip.tsx`, `signature/` Ticket/Stamp ("rectangular for land and sea") | none; [`card`](https://uiarc.dev/r/card.json) / [`badge`](https://uiarc.dev/r/badge.json) already in inventory as "Compose" | motion, radix-dialog | Reuse. Mode via mark + text label, not colour alone. |
| Segmented All / Trains / Road | `ui/segmented-control.tsx` (radiogroup, `dense`) | [`segmented-control`](https://uiarc.dev/r/segmented-control.json) already adapted | none | Reuse. |
| Cancelled filter | `ui/chip.tsx`, `ui/filter-toolbar.tsx`, `ui/switch-row.tsx` | [`chip-group`](https://uiarc.dev/r/chip-group.json) / `filter-toolbar` already adapted | none | Reuse. |
| Add chooser (Train / Road trip) | `ui/menu.tsx` (Radix dropdown; "Add card" pattern in DESIGN.md), `add-menu.tsx` | [`split-button`](https://uiarc.dev/r/split-button.json), [`dropdown-menu`](https://uiarc.dev/r/dropdown-menu.json) (both in inventory) | radix-dropdown-menu | Reuse `Menu`. No new fetch. |
| Detail Sheet | `ui/sheet.tsx` + `ui/bottom-sheet.tsx` (Arc detents, fetched 2026-10-12) | [`bottom-sheet`](https://uiarc.dev/r/bottom-sheet.json) already adapted | radix-dialog, motion | Reuse. Do not add a second sheet stack. |
| Route schematic map (straight lines) | `maps/`, `overview/globe/` (local SVG + d3 geometry; MapLibre vendored) | none (Arc map items are Pro) | n/a | Local SVG, no Arc. |
| Rail form, repeatable legs | `ui/field.tsx`, `ui/calendar.tsx`, `ui/button.tsx`, `ui/disclosure.tsx` | [`stepper`](https://uiarc.dev/r/stepper.json) is "Compose" in inventory, **no local file** | motion | Not needed for legs. Optional only for the review stage indicator (see below). |
| Road-trip ordered stops: **buttons + drag** | none (no sortable code in `apps/next/src`; `dnd-kit` not installed) | **none free in Arc** | n/a | **Gap.** Build locally: Move up / Move down buttons as the canonical path (already required by the contract) plus pointer drag as an enhancement. See "Sortable" below. |
| "Return to start" action | `ui/button.tsx` | none | n/a | Plain button. |
| Async city combobox: loading / no result / error | `ui/combobox.tsx` (`choices` prop is synchronous, no loading/error slot) | Arc [`combobox`](https://uiarc.dev/r/combobox.json) is also sync (`emptyMessage` only); [`expanding-search`](https://uiarc.dev/r/expanding-search.json) not async either | lucide, motion | No Arc gain. Extend the local Combobox seam (status row + `aria-busy`, stale-response guard), as the contract says "adapt at the current seam". |
| Manual place (name + country, optional coords) | `ui/field.tsx`, `ui/disclosure.tsx`, `ui/dialog.tsx` | [`number-field`](https://uiarc.dev/r/number-field.json) (free, not adapted) for lat/lon, optional | lucide, motion | Use plain Fields. Skip `number-field`: coordinates need validated text, not steppers. |
| Multi-file dropzone with per-file status / retry | `import/file-dropzone.tsx` (+ `.module.css`) is **single-file** (`onFilesChange([files[0]])`, line 133/171) | [`file-dropzone`](https://uiarc.dev/r/file-dropzone.json) (already the base of the local one; upstream has `multiple`, `maxFiles`, per-row remove/retry, progressbar, polite status, ArrowUp/Down between rows, Delete removes, paste) and block [`file-upload`](https://uiarc.dev/r/file-upload.json) (per-file progress, retry, AbortSignal) | lucide, motion | **Best fit for a gap-fill.** Re-read the already-recorded upstream file-dropzone hashes in the inventory, then extend the local component for multi-file (do not re-fetch unless the hashes differ). Optionally fetch `file-upload` as a reference for the status rows; do not adopt its fake progress (OCR gives no truthful percentage, per the "truthful progress only" rule). Limits from rail-ocr-contract: 10 files, 10 MiB, 2 concurrent, PDF/JPEG/PNG/WebP. |
| Unified review step (route, dates, country checklist) | `ui/checkbox.tsx`, `ui/switch-row.tsx`, `ui/alert.tsx`, `import/` review components | [`checkbox`](https://uiarc.dev/r/checkbox.json), [`alert`](https://uiarc.dev/r/alert.json) already adapted; optional [`timeline`](https://uiarc.dev/r/timeline.json) | lucide, motion (+ radix-checkbox where used) | Reuse checkbox/alert. `timeline` is a newest-first, day-grouped feed with UTC/time-zone clocks: wrong shape for a route with unknown dates. Do not fetch. A local ordered `<ol>` is simpler and keeps unknown dates explicit. |
| Stage indicator (Route → Dates → Countries) | `import/progress-step.tsx` | [`stepper`](https://uiarc.dev/r/stepper.json) (free; `nav` with `aria-current="step"`, arrows, Home/End, SR status "Completed / Not started / Error") | motion | Optional. Only if the review step is multi-stage; otherwise skip. Fetch needs inventory entry (it already has a "Compose" row and registry hash). |
| Compact stats blocks | `overview/` hero figures, `ui/slot-text.tsx` (adapted), `charts/arc-sparkline.tsx` | [`metric-card`](https://uiarc.dev/r/metric-card.json) (inventory: drop its `animated-counter` import) | motion | Reuse existing blocks/`SlotText`. Show unknown/incomplete explicitly (contract). |
| Empty / error / partial states | `ui/empty-state.tsx`, `ui/alert.tsx`, `ui/skeleton.tsx`, `ui/feedback-text.tsx` | [`empty-state`](https://uiarc.dev/r/empty-state.json), `alert`, `skeleton` already adapted | none | Reuse. Three distinct states: confirmed empty, filtered empty, read error. |
| Date inputs with "unknown date" | `ui/calendar.tsx` (typed, locale-aware), `ui/date-range-picker.tsx`, `ui/switch-row.tsx` | [`date-picker`](https://uiarc.dev/r/date-picker.json) is "Reference" only | lucide, motion | Reuse local `Calendar` plus an explicit "Date unknown" switch or checkbox; no Arc change. |
| Row actions on cards (complete / cancel / restore / delete) | `ui/context-menu.tsx`, `ui/menu.tsx`, `ui/confirm-morph.tsx`, `ui/destructive-confirm.tsx` | `swipe-actions` adapted already (`ui/swipe-actions.tsx`) | radix-dropdown-menu | Reuse. Contract says no Undo promised on delete: use `DestructiveConfirm`, not the deferred-delete `ConfirmMorph` flow. |

## Sortable list (the one real gap)

Facts (checked): no free Arc sortable, none in the local tree, `dnd-kit` absent from `apps/next/package.json`, `motion` ^14.1.0 present (used by bottom-sheet).

Options, smallest first:

1. **Buttons-only** (Move up / Move down per row, `aria-label` with stop name and position, focus kept on the same button after the move, polite status "Moved to position N of M"). Meets the contract's keyboard alternative on its own; zero new dependencies.
2. **Add pointer drag locally** using Motion's `Reorder` or pointer events on a labelled handle. `Reorder.Group` has no keyboard model; keep the buttons as the accessible path and mark the handle `aria-hidden`/not focusable. Needs the repo's reduced-motion rule (no layout animation on rows is already a DESIGN.md rule for the Journal: apply it here).
3. `@dnd-kit/sortable` gives pointer + keyboard sensors and announcements, but it is a new dependency (needs approval and the dependency table update); I did not verify its current version or React 19 support here, so treat as unchecked.

Recommendation: option 1 first, option 2 as an enhancement, decide on option 3 only if option 2's touch behaviour inside the mobile Sheet conflicts with the Sheet's vertical drag (header drag and vertical-body drag are already claimed by the Sheet: restrict the drag to the handle with `touch-action: none`).

## Keyboard model summary (Arc free sources)

- **file-dropzone**: Enter/Space opens the picker; ArrowUp/Down moves between rows' remove/retry actions; Delete/Backspace removes; Ctrl/Cmd+V pastes; focus moves to a neighbour row on removal; polite `role="status"`, errors `role="alert"`. The local single-file adaptation has not been extended to rows yet.
- **stepper**: arrows move between reachable steps, Home/End, Enter/Space selects a completed step.
- **timeline**: arrows between expandable rows, Home/End, Enter/Space.
- **combobox**: listbox with an empty-state status row; results are not virtualised ("pre-filter very large lists"), consistent with the contract's "do not load the full city corpus".

## Recommendations

1. Reuse existing local adaptations for cards, filter, menu, Sheet, forms, states and stats. No new fetch is needed for them.
2. Gap-fill: extend `import/file-dropzone.tsx` (multi-file, rows, retry) from the already-recorded upstream `file-dropzone` source. Fetch `file-upload` only as reference, if at all.
3. Sortable list: local implementation (buttons first, optional handle drag). Nothing free exists in Arc.
4. Async combobox: extend `ui/combobox.tsx`; Arc offers nothing async.
5. Skip `timeline`, `number-field`, `metric-card` count-up and any Pro map or board.
6. `stepper` only if the review step genuinely has stages.

## Adoption steps if any new item is fetched (existing inventory convention)

1. Fetch only from `https://uiarc.dev/r/{name}.json`, unauthenticated; assert `meta.tier` = `free` and HTTP 200 for the item and its `registryDependencies`.
2. Stage the bytes outside the repo (a new empty directory, as `/tmp/kuuki-arc-source/`), record SHA256 of the registry JSON and of each extracted file.
3. Adapt in place under `apps/next/src/client/ui` (or the owning feature folder): Kuuki tokens, 44px targets, no hairlines between rows, reduced-motion branch; drop `motion` and Radix where Kuuki already owns the behaviour (DESIGN.md "Arc adaptations"). Never import `foundation.css`.
4. Add to `docs/research/2026-10-08-arc-source-inventory.md` a dated "fetched 2026-10-XX" paragraph in "Actual adoption map" (registry SHA256, upstream TSX/CSS hashes, adaptation decisions), and update the component ledger row.
5. Add one dated sentence to `apps/next/src/client/ui/ARC-LICENSE.txt` ("X was additionally fetched on …"). The MIT text stays verbatim.
6. If the component table in DESIGN.md changes (new primitive), update it in the same change. No new npm dependency is implied by these candidates (`motion` and `lucide-react` are present).
7. Add one test per failure mode (multi-file ordering independent of completion order; retry of one file leaves the others; reorder keeps focus), run the project's typecheck and unit tests.

## Caveats

- Licence page still labelled a draft not yet lawyer-reviewed (recorded in the inventory); the repository LICENSE is MIT.
- I probed `https://uiarc.dev/r/pro/timeline.json` once for HTTP status only (it returned 200 for a free item name, likely a generic response) and discarded the body; treat that URL as unverified and do not rely on it.
- Hashes in the inventory were not recomputed against live bytes today; if a re-fetch is made, compare before adapting.
