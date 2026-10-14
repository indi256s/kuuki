# dxe pass — Ground travel UI (pre-build brief)

Mode: `dxe review` (non-mutating), 2026-10-13. Lenses loaded: core rubric, `semantic-html-first`, `interaction-contracts`, `interface-affordances`, `subtractive-design`, `real-content-design`. Not loaded: motion/native/Apple/Android lenses (no trigger).

## Hypothesis

`/ground-travel` is a repeat-use record page, not a showpiece. Its job is to let the owner list, add, complete and correct rail and road journeys without ever seeing a made-up number, date or stamp. Every contract risk (unknown ≠ zero, plan ≠ stamp, explicit city and country choice, no duplicate create) lands in four surfaces: the city picker, the multi-file OCR rows, the unified completion review and the unknown-result/409 states. Those four are where the existing primitives are weakest.

Non-goals: visual design, Paper boards, backend contracts, WebMCP, a security review.

## Evidence collected

| Evidence | Result |
| --- | --- |
| Materials | Next App Router, `client/ui/*` kit (Arc adaptations), tokens in `app/styles.css`, Keyline icons 1.8.0 (`Train`, `Car`, `Route`, `MoveUp`, `MoveDown`, `GripVertical`, `MapPinPlus`, `ArrowUTurnLeft`, `RefreshCw` exist). |
| Source read | `nav.tsx`, `shell.tsx`, `add-actions.tsx`, `add-menu.tsx`, `route-focus.tsx`, `route-transition-pairs.ts`, `navigation-link.tsx`; `ui/{sheet,segmented-control,combobox,menu,empty-state,destructive-confirm,field,filter-toolbar}.tsx` plus `ui.css`, `flight-controls.css`, `shell.css`, `empty-state.css`; `journal/{journal-page,states,header,detail-sheet,url,store(history part)}`; `passport/add-country-sheet.tsx`; `capture/{flight-form,capture-preferences,drafts,add-origin}`; `import/{file-dropzone,source-step(checkFile),review-step}`; `lib/format.ts`. |
| Requirements | `spec.md` GT-01..14, `page-flow-contract.md`, `rail-ocr-contract.md`, `places-contract.md`, DESIGN.md (whole), CODING_STANDARDS.md. `arc-components-research.md` (another agent, untracked) was read only to avoid contradicting it. |
| Rendering | **Not done.** No `.next`/`.open-next` build in this worktree, other agents are using the shared `.wrangler/next-build` and port 8800, and member pages need an authenticated fixture. All findings are `confirmed-source` or `likely`. Nothing below is a rendered defect. |
| Checks | Typecheck, tests and build **not run** (review mode; other agents are mid-edit in this worktree). |

## Verified strengths (preserve and reuse)

- [core] `ui/field.tsx` — `aria-describedby` chain, reserved 20px error line (`role="alert"` only when an error exists), so errors never shift layout. Use for every text input.
- [core] `ui/button.tsx` `disabledReason` — `aria-disabled`, still focusable, visible 13/20 reason. This is the "disabled explains why" rule.
- [semantic] `ui/menu.tsx` — Radix menu with real `a` items via `asChild` (`add-actions.tsx`), keyboard open/close skips motion, Esc returns focus to the trigger. Right shape for the Add chooser.
- [interaction] `ui/sheet.tsx` / `bottom-sheet.tsx` — modal Radix dialog, title focus, button alternative to drag, `closeLabel`, `initialFocusRef`, `onCloseAutoFocus`. Right shape for the journey detail.
- [interaction] `journal/detail-sheet.tsx` — handles the owner-masked "missing" case (`jd-missing`), returns focus to `[data-flight-row]`, drops late answers after identity change (`getAuthGeneration`, `kuuki:identity-reset`), mounts the sheet only after hydration (`mounted && mobile !== null`).
- [interaction] `journal/store.tsx` — filters `replaceState`, detail pushes one entry, close steps Back over its own entry, deep link closes by replace. This is exactly the page-flow contract's history model; it is just private to Journal.
- [core] `journal/states.tsx` — empty / no-matches / refresh-failed (rows kept) / offline / pending-publication are separate components with EN/RU copy. The states matrix below mirrors them.
- [interaction] `capture/flight-form.tsx` — "Unfinished entry restored" banner with Discard (:964), storage-failed note (:972), per-owner unfinished input (:232), saved-heading focus, receipt-based "unconfirmed save" footer (:883).
- [core] `route-focus.tsx` — focus moves to `main h1` only on pathname change; filters, search text and `?journey=` never trigger it. Matches the contract unchanged.
- [semantic] `passport/add-country-sheet.tsx:62-72` — focus restore falls back to `main h1` when the opener is gone. This is the fallback the contract wants for a card that left the filter.
- [affordances] `ui/checkbox.tsx` is a native checkbox with label/description; `ui/destructive-confirm.tsx` focuses Cancel, blocks dismissal while pending, keeps the dialog open on rejection.

## Findings

### Critical

None. Nothing was rendered, and no source defect blocks a primary task of a page that does not exist yet.

### Should fix (before or while building; each has a bounded correction)

1. `confirmed-source` [interaction-contracts] `client/ui/combobox.tsx:133,176,241` — The Combobox is a synchronous, code-keyed airport picker. `choices` is a prop; typed text is uppercased and pushed through `onChange` as if it were the value (`typed.current = …toUpperCase()`); on blur `settle()` commits the only remaining match (`all.length === 1`); `key={choice.code}`. There is no loading, no-result, error or manual-place row. For cities this silently chooses a place by text, which `places-contract.md` forbids (same names must be told apart by country/region; no merge by text). **Fix:** build a `PlaceCombobox` on the same popover/Sheet shell and `ChoiceOptions` list, but with separate `query` and committed `placeRef`, blur never commits, an explicit state row (searching / no result + "Add as manual place" / error + Retry), and a stale-response guard keyed to the latest query.
2. `confirmed-source` [interaction-contracts] `client/import/file-dropzone.tsx:133,171,182` + `import/source-step.tsx:29` — Single-file by construction: drop and input both take `files[0]`, the hidden input has no `multiple`, the prop is `file: File | null`, Delete/Backspace on any row button clears the lot, one `sr-only` status names one file, and a document-level `paste` listener swallows any pasted image on the page. `checkFile` allows PDF/PNG/JPEG only (no WebP) and trusts `file.type` (no signature check). **Fix:** per-file rows with a status (queued / reading / read / no trains found / too large / unsupported / provider error), per-row remove and Retry, counts announced politely, own `accept` + signature check (PDF/JPEG/PNG/WebP, ≤10 files, ≤10 MiB each), and no global paste listener (the contract does not ask for paste).
3. `confirmed-source` [real-content-design] `lib/format.ts:126,139` + `journal/header.tsx` — The formatters have no unknown path: `formatDurationDays` maps non-finite to **"0 h"**, `formatDuration(NaN)` prints "NaN min", `formatDistanceKm(0)` prints "0 km", and nothing renders "≈". Unknown distance/time shown as zero is the one failure GT-07/GT-10/GT-13 name. **Fix:** a small `journey-format.ts` whose inputs are `number | null` and whose output for `null` is the words ("Distance unknown", «Расстояние неизвестно»), never a number; the only way to print "≈ … km" is through it.
4. `confirmed-source` [interaction-contracts] `client/capture/flight-form.tsx:883-920` — The unknown-result footer offers "I checked the journal — start a new save" (`rotateFlightOperationId`). `page-flow-contract.md` forbids a new create ID as a bypass. The whole block is also `role="alert"` with the buttons inside, so any re-render re-announces. **Fix:** copy "Retry original save" / "Check result" only; announce a single short alert and keep the buttons outside the live region; no "start a new save" for Ground travel.
5. `confirmed-source` [interaction-contracts] `capture/capture-preferences.ts:3-9`, `flight-form.tsx:232-238` — Unfinished-input storage has no schema version, no shape check on read (`JSON.parse(...) ?? fallback`), and is written synchronously on every field change. GT-08 needs owner + schema version + kind/ID, and OCR candidates make the payload large. Identity-reset clears only the `kuuki:capture:` prefix. **Fix:** a ground-specific draft helper under the same prefix (so identity reset clears it), a `v1` segment, a validator that discards an unreadable draft with a visible "could not restore" note, and a debounced write.
6. `confirmed-source` [semantic-html] `client/nav.tsx:55-67`, `route-transition-pairs.ts:12`, `capture/add-origin.tsx:12,24` — Three silent omissions once `/ground-travel` exists: `MobilePageTitle` has no entry (the 56px mobile header reads "Kuuki"); `TAB_ROUTES` lacks it, so Ground ↔ other tabs swap instantly while every other tab switch fades; `AddOriginTracker` excludes only `/add`, so `/ground-travel/new?mode=rail` can become the return target of a later "Add flight". **Fix:** add the route to all three; exclude `/ground-travel/new` and `/ground-travel/*/edit` from the origin tracker.
7. `likely` [interface-affordances] `app/shell.css:264-305`, `nav.tsx` `Tab` — Four rail destinations at 320px: rail 296px − 12px padding − 3×4px gaps ⇒ **68px per tab**, 2px side padding, `.tab-label { white-space: nowrap }` with no ellipsis or wrap. «Наземные» (12/16, 500, then 600 when active) is the longest label and will nearly fill or overflow the slot; at larger text it overflows the pill. Also `Tab` has no `aria-label`, but the contract wants the full accessible name «Наземные путешествия» ("Ground travel"); a name containing the visible label satisfies Label-in-Name. **Fix:** give `Tab` an optional `ariaLabel`; measure «Наземные» in Commissioner 500/600 at 320px and 360px before accepting; if tight use ellipsis plus the full accessible name rather than shrinking below 12px.
8. `confirmed-source` [interface-affordances] `ui/ui.css:643-655` — Non-dense `SegmentedControl` cells have a 104px minimum. Three options need 3×104+2×2+6 = **322px**, but the content box at 320px is 288px, so "All / Trains / Road" wraps into 2+1 rows with the thumb on a second row. **Fix:** use `dense` (32px visual, 26px cells, 44px hit area on coarse pointers via `::after`; 8px/12px spacing rule applies) or add an explicit one-row mode to the primitive. Do not ship the wrapped version.
9. `confirmed-source` [semantic-html] `ui/empty-state.tsx:24` — `EmptyState` always renders `h3`. Under a lone `h1` that skips h2 (confirmed-empty at page level has no section heading above it). **Fix:** give the list region visible or `sr-only` `h2`s ("Plans", "History") and keep the empty states inside them; do not change the primitive for this.

### Nice to have

10. `confirmed-source` [subtractive] `ui/menu.tsx:256` / `ui.css:550` — `MenuSeparator` still paints a 1px hairline, which DESIGN.md and the no-divider rule ban inside menus. Do not use it in the Add chooser or any row menu; space groups.
11. `confirmed-source` [core] `ui/sheet.tsx:82` — `closeLabel` defaults to the English "Close"; every Ground-travel caller must pass the RU/EN label (`Journal` does).
12. `confirmed-source` [affordances] `ui/checkbox.tsx` / `checkbox.css:107` — the native checkbox is a 24px wrapper; the 44px hit area exists on coarse pointers only. The country checklist must make the whole row the label (≥44px tall), not rely on the box.
13. `confirmed-source` [affordances] `ui/ui.css:99-102` — dense `Button` hit area is `inset:-4px` (40px) on fine pointers, 44px on coarse. Per-row Move up / Move down / Remove should be regular (44px) buttons, not dense.
14. `confirmed-source` [affordances] `capture/flight-form.tsx:950` — "⌘/Ctrl + Enter" hint is shown to everyone, including touch; Journal copy explicitly avoids that. Do not copy it.
15. `likely` [semantic] `capture/flight-form.tsx:979` — `<fieldset disabled>` while saving drops focus from the active control. Fine for the flight form (it re-focuses notices); a longer ground form needs focus parked on the Save button, which `Button loading` already keeps mounted.
16. `unverified` — Overview has a drag-reorder implementation (DESIGN.md "Overview reorder": 400ms coarse hold, Escape cancels, FLIP). I did not read it. Check whether its pointer logic can be shared before writing a second one.

## Cuts (do not add)

- Docked 460px detail pane (`useDockedDetail`), review mode, selection mode, bulk action bar, swipe actions, row context menu, shortcuts popover. The contract asks for one Sheet and per-detail actions.
- `SlotText` rolling numbers, count-up, sparkline/chart, map hero, route animation on the list. Stats are two quiet blocks; the full map is inside a journey. No decoration iso figure.
- A global paste handler, HEIC/GIF/archives, "paste email text", ticket thumbnails of stored originals (nothing is stored).
- A typed-phrase delete confirmation, undo/trash, archived plan versions, deferred-delete toast (`ConfirmMorph`). Contract: explicit `DestructiveConfirm`, no Undo promise.
- A "start a new save" bypass, an auto-merge on 409, a silent "pick the only match" for cities, auto-checked countries, auto-joined OCR legs.
- A third filter dimension on the list (search box, year, sort menu). Filters are exactly All/Trains/Road + Cancelled.
- `MenuSeparator`, row dividers, a "Stepper" for the review (single screen with sections is enough), `timeline`, `number-field`, `metric-card`.
- Beforeunload/"unsaved changes" guards: GT-08 restores unfinished input, so a guard is redundant noise.

## Proposed changes (to existing code, for the implementing agents)

1. Add `/ground-travel` to `NAV_ITEMS`, `TABS` (remove `.tab-add-slot` and its key), `MobilePageTitle`, `TAB_ROUTES`, and exclude `new`/`edit` from `AddOriginTracker`. Keep `AddMenu` (flights) in the desktop header; add the ground Add menu on the page.
2. New `PlaceCombobox` (async, explicit commit) alongside `ui/combobox.tsx`; do not alter the airport Combobox contract.
3. Extend `file-dropzone` to a multi-file variant (rows + status + Retry) rather than forking a second visual language.
4. `journey-format.ts` with null-safe distance/time/date formatters.
5. Extract the Journal sheet-history behaviour (push on open, replace on switch, Back-over-own-entry on close, replace on deep link) into a shared hook, or copy its tested rules exactly. Re-deriving it risks the Safari history-write throttle and Next's patched `history.state` keys documented in `journal/store.tsx:117-130,343`.
6. One `OrderedRows` list primitive shared by the rail legs editor and the road stops editor (OCR contract requires legs to be reorderable too, not only road stops).

## Verification status

Not run: typecheck, tests, `pnpm next:build`, navigation suite, any browser. Reason: review mode, no build output in this worktree, shared build/port, other agents editing. No console/page errors were collected. The pre-build acceptance in `spec.md` ("real UI not yet checked") still stands.

## Limits and unresolved observations

- The completion flow's URL is **not defined** by `page-flow-contract.md` (only `/new`, `/<id>/edit`, `?journey=`). Decide whether completion is `edit` in a mode, a query on `edit`, or a Sheet step, before building the card's "Complete" action. Past-dated plans must offer it but not change status.
- Whether a completed trip may have **zero** confirmed countries is not stated. A domestic trip crossing no border needs an explicit "No border crossed" answer; an empty checklist must not mean both "skipped" and "none".
- Text-only 200% zoom: most rail and control sizes are px, so they may not scale with text-only zoom. Unverified; test with browser text zoom, not page zoom.
- Whether a Keyline icon exists for the rail tab: `Route`, `Train`, `Car` do. `Route` is the likelier neutral choice; the design owner picks.

---

# Build guidance for /ground-travel

All reuse is by import from `apps/next/src/client/`. "New" means a small addition, not a new visual language. Copy rule: EN and RU together, `formatCount` for plurals (RU needs one/few/many), «вы», calm text for save/error/conflict/delete/permission, wit only as a secondary line in non-critical empty states, and never as a factual claim. Wit must stay true: fix a wrong joke with a different joke, not a bland line (memory: `copy-lean-sarcastic`).

## 1. Primitive map

| Need | Reuse | Add / adapt | Notes |
| --- | --- | --- | --- |
| Page header + unified list | `journal/header.tsx` shape (h1 + one summary line), `<ul>` of cards | Card component (own). | h1 "Ground travel / Наземные путешествия". Sections as `h2`: Plans, History (cancelled view: "Cancelled"). Cards are `li`; the title is a real link (`href="?journey=<id>&…filters"`, `scroll={false}`) so it is shareable and middle-clickable. No table, no row divider. |
| Card transport cue | `Train` / `Car` Keyline icon + visible word | — | Cue = icon **and** text "Train"/"Road trip" (not colour). Plan/Completed/Cancelled status as text pill (existing `.ui-chip` look), never colour alone. |
| All / Trains / Road | `ui/segmented-control.tsx` with `dense` | — | See finding 8. Label "Transport". Options use `mode=rail|road`; "All" removes the key. Arrow keys select immediately and replace history (same as Journal filters); focus stays. |
| Cancelled filter | `ui/filter-toolbar.tsx` (group "Ground travel filters") holding the segmented control + a toggle `Button` `aria-pressed` "Cancelled" | — | Not a fourth segment: it changes the whole list type (only cancelled; stats hidden). `status=cancelled`. Show the count only if the read provides it. |
| Add chooser | `ui/menu.tsx` + `MenuItem asChild` + `NavigationLink` | Page-level trigger button (primary, 44px, `Plus`, label "Add journey"/«Добавить поездку»). | Items: Train → `/ground-travel/new?mode=rail`, Road trip → `/ground-travel/new?mode=road`, each 52px row with `Train`/`Car` icon. Mobile: `scrim="mobile"`, `side="bottom"`, no `+` key (removed). No separator. Existing `Add flight` stays untouched. |
| Detail | `ui/sheet.tsx` (`side` right desktop, bottom mobile via `useMobile`), pattern of `journal/detail-sheet.tsx` | Typed detail body (rail vs road). | Open only after hydration (`mounted && mobile !== null`). Title = route text with `→` `aria-hidden` and `sr-only` "to"/«в» (copy the Journal title); long loops ("Tbilisi → Kars → Tbilisi → …") wrap, never ellipsis in the detail. Actions in the sheet footer: Edit, Complete (plan), Cancel plan / Restore, Return to plans (completed), Delete (`DestructiveConfirm`). |
| Rail legs editor | `Field`, `PlaceCombobox`, `Calendar`, `Disclosure` | `OrderedRows` | One `fieldset`/`li` per leg with a dynamic `legend` ("Leg 2: Tbilisi → Kars"). Required: from + to. Station, times, carrier/number inside a closed `Disclosure layout="row"` "Details". New leg prefills from the previous arrival. |
| Road stops editor | same + `OrderedRows` | "Return to start" button | Ordered list, min 2 points. Nights, notes in a closed `Disclosure`. |
| Return to start | `Button` secondary + `ArrowUTurnLeft` icon | — | Appends a **new point** (new identity, same place ref). If the last point already equals the first: `aria-disabled` with visible reason, not hidden. |
| Reorder | `Button` (non-dense) `MoveUp` / `MoveDown` + optional `GripVertical` handle | `OrderedRows` | Buttons are the canonical path. Handle is pointer-only, `aria-hidden`, not tabbable, `touch-action: none` on the handle only; no row layout animation (Journal rule); Escape cancels a drag (Overview rule). |
| Async city combobox | `Sheet` (mobile full-height `flight-full-sheet`), popover CSS from `flight-controls.css`, `ChoiceOptions` | `PlaceCombobox` | See §2 and finding 1. Row shows name, then region and country in muted text; the same name in two countries is always distinguishable. |
| Manual place | `Field` ×2, `Disclosure` | — | Opened from the no-result row or a persistent "Can't find it? Add a place" link. Name + country required, coordinates optional with validation text, no stepper. Selecting it is explicit, and the result reads "manual place" in the row. |
| Multi-file OCR | `import/file-dropzone.tsx` (extend), `Alert`, `Button dense` for Retry | Row status component | See §2. Nothing stored; say so in one line next to the picker. |
| Unified completion review | `Checkbox`, `Alert`, `FloatingActionBar` (kept mounted while saving), `Disclosure`, `Calendar` | Review sections (own) | See §3. |
| Compact stats | plain `dl` in a level-1 card, `formatCount`/`journey-format.ts` | — | Two blocks (Trains, Road trips) with 2–3 figures each. No `SlotText`, no chart. |
| Unknown date/distance | text via `journey-format.ts` | — | "Date unknown" / «Дата неизвестна»; distance "≈ 1,240 km, straight line between cities" / «≈ 1 240 км по прямой между городами»; incomplete: "Distance unknown: 1 city has no coordinates" (never a partial sum as the total). Rail duration: known sum plus coverage ("4 h 20 min on trains, 2 of 3 legs"). |
| Empty/read error/partial | `EmptyState`, `Alert`, `Skeleton`, patterns of `journal/states.tsx` | — | See §5. |
| Toasts | `useToast` | — | Saved: message states outcome ("Journey saved") with a "View" action. Errors are inline first, toast second. |

## 2. Surface contracts (keyboard / focus / return)

| Surface | Keyboard | Focus | Return / history |
| --- | --- | --- | --- |
| Nav tab / header link | Native links; `aria-current="page"` via prefix `isActive` (covers `/new`, `/edit`). | `RouteFocus` → `main h1` on pathname change only. | Tab link while on `?mode=rail` clears filters (Journal treats a shell link as Reset); mirror `ROUTE_LINK_EVENT`. |
| Filters | Radiogroup: Tab to selected option, arrows select, Home/End. Toggle button: Enter/Space. | Never moves on a filter change. | `replaceState` / `router.replace`, never push. |
| List result announcement | One `role="status"` line ("3 journeys · Trains") updated on filter change, not per card. | — | — |
| Add chooser | Enter/Space/ArrowDown opens; arrows; Esc closes and returns to trigger; Enter on a link navigates. | After navigation, `RouteFocus` → h1 of the form. | — |
| Card | Title link; Enter opens detail. Only one tab stop per card; secondary actions live in the sheet (cancelled cards also show an inline 44px Restore). | — | Open pushes one entry; switching card replaces; deep link close replaces to the list (page-flow contract). |
| Detail Sheet | Esc closes; Tab trapped; close button 44px; Back closes. | Opens on the title; on close returns to `[data-journey-card=id]`, else to the list `h2`/`h1` (Passport add-country pattern). | URL `?journey=<UUID>` keeps filters. |
| Detail load | Missing (owner-masked 404) → "This journey is not in your list." + Close. Failed read → Alert "Could not load the details" + Retry; the list stays. | Focus on the alert's Retry. | — |
| Form (new/edit) | Native form; Enter submits from text fields (keep `⌘/Ctrl+Enter` out). | h1 on route entry; first error field after failed submit (flight-form pattern); success → h1 of the list. | Cancel and success use the **allowlisted** return context (`/ground-travel` + `mode`, `status`, `journey` only); no origin ⇒ `/ground-travel`. Cancel keeps the draft and the list shows no banner; reopening shows "Unfinished entry restored" + Discard. |
| Rail legs / road stops | Tab through fields; Move up/down are buttons with names like "Move Tbilisi, stop 2 of 5, up". Use `aria-disabled` (not `disabled`) at the ends. | After a move, focus stays on the same direction button, or the other one if this move made it a no-op; polite status "Tbilisi moved to position 1 of 5". After Add stop/leg → the new row's first empty field. After Remove → the next row's legend (`tabindex=-1`) or "Add" when last. | Draft only until Save. |
| Return to start | Button. | New last point's place field (filled), status "Returned to start: stop 6". | — |
| City combobox | Type → results; ArrowUp/Down moves; Enter chooses the highlighted row **only**; Esc closes and keeps typed text visible but uncommitted; Tab leaves without choosing. | Mobile Sheet title/search focus as airport Combobox; close returns to origin field without reopening. | Query ≠ choice. Late response for an old query is ignored. |
| Dropzone / OCR rows | Space/Enter on the picker; per-row Remove and Retry are real buttons; Delete on a row removes **that row** only. | After remove → next row's Remove, else picker. After Retry → row status text (live). | Reload restores received fields; unreceived sources must be reselected (OCR contract). |
| Review | Native fieldsets; country checklist rows are whole-row labels; "Add suggested (N)" and "None of these" are buttons. | On entry → review h1/h2; on validation error → the first unanswered group's legend. | One save; Back keeps own edits. |
| Delete / cancel plan | `DestructiveConfirm` (Cancel focused); cancel-plan is non-destructive and uses a plain button. | On success focus the list h1 (card gone). | Delete copy states the consequence: removes this journey's evidence from Passport only; other sources of the same stamp stay. No Undo promise. |

## 3. Unified completion review (GT-09/11/12)

- One screen, three labelled sections: **Route** (the editable legs/stops, same editor), **Dates** (each date optional, "Date unknown" explicit), **Countries**.
- Countries: `fieldset` with legend "Countries you actually crossed" / «Страны, которые вы действительно пересекли». Every row is a `Checkbox` with the country name; **nothing is pre-checked**. Countries derived from the route are listed first under "On the route" with an optional "Add suggested (N)" button; countries off the route come through the Passport country search (`passport/add-country-sheet.tsx` pattern). Add a mutually exclusive "None of these" so an empty checklist is never ambiguous.
- Transit without stopping counts (GT-11): say it in one muted line under the legend, not in a tooltip.
- Footer: `FloatingActionBar` stays mounted while saving; `Button loading` + `disabledReason` for the missing answer; the same bar for new-old-trip, complete-plan and correct-completed.
- Map is a schematic only: never a way to tick a country. Label it "Route sketch (straight lines)".
- Back-to-plans confirmation states the consequence: this journey's stamps and totals are removed until you complete it again; other flights/trips keep theirs.

## 4. OCR rows (per file)

States per row, one live text each: *Waiting*, *Reading…*, *Found N trains* (plural), *No trains found*, *Too large (max 10 MiB)*, *Unsupported type*, *Could not read this file — Retry* (provider error), *Some fields unclear* (partial). Limits shown in the picker hint: up to 10 files, PDF/JPEG/PNG/WebP, tickets are not stored. Results merge into the legs editor in source order; each candidate shows the file name. Extracted fields appear as editable inputs, uncertain ones flagged by text ("Check this"), not by colour alone. Join candidates only on an explicit "Join as one journey". Never prefill a year, coordinates or countries from OCR. Duplicate candidates (retry of one file, two similar tickets) are marked "Possible repeat" and not removed. Stopping does not start new files and ignores late responses; received rows are kept.

## 5. States matrix

| State | List | Detail Sheet | Form / review | Pattern |
| --- | --- | --- | --- | --- |
| Loading | Skeleton per band at final size (header, filter, 3 cards), `aria-busy`; nav live. | Title + skeleton body; no spinner. | Form fields render; city search shows "Searching…" row. | `ui/skeleton.tsx`, `loading.tsx`. |
| Confirmed empty (no journeys at all) | `EmptyState`: title, one line, Add chooser button. Stats hidden. | — | — | `EmptyState` (h3 inside an h2 region). |
| Filtered empty | `EmptyState` naming the filter ("No trains yet" / "No cancelled journeys") + "Show all". Stats stay for the filter. | — | — | Distinct from above (Journal NoMatches). |
| Partial | Cards render; unknown fields as words; stats show "Incomplete" with coverage. If only stats/detail fails, an inline `Alert` + Retry in that region; list stays. | Known legs shown, failed leg area has Retry. | — | `Alert variant=warning`. |
| Read error (list) | `Alert` (urgent) + Retry in place of the list. **Never** `EmptyState`. If rows exist from an earlier load, keep them and add `RefreshFailed`. | "Could not load the details" + Retry; list unaffected. | — | `journal/states.tsx`. |
| Ready | Plans first (nearest date, then past-dated, then undated), then History, newest first, undated last. | Typed fields; unknown as words. | Draft banner when restored. | Contract order. |
| Saving | Card shows nothing; button `loading` ("Saving…"). | Action buttons `loading`, sheet not dismissible while pending (`dismissible=false`). | `Button loading`; keep the entered values; no navigation until server ack. | `Button`, `Dialog`. |
| Saved + pending publication | Journey is shown; one status line "Saved. Totals are still updating." under the stats; never re-submit. | Same line in the sheet. | Success toast + return to list. | `PublicationPending` pattern. |
| Unknown result (lost response) | — | — | One `role="alert"` ("We could not confirm the save"), frozen payload shown, buttons **Check result** and **Retry original save**; new edits stay local until resolved; no new create ID. | Receipt pattern minus the bypass. |
| 409 conflict | Newer version appears in the list. | Alert with the current saved summary. | `Alert`: "This journey changed elsewhere." Buttons: *Review saved version* and *Apply my changes on top* (explicit); own edits kept; no auto-merge. | Focus the alert heading. |
| Offline | `OfflineNote` (`Offline. Connect to change journeys.`) + `disabledReason` on write buttons. | Same. | Same; draft keeps working. | `journal/states.tsx`. |
| Session changed | Writes disabled with "Your session changed. Reopen the page." | Same. | Draft not shown to another owner. | `kuuki:identity-reset`. |
| City search | — | — | *Searching…* (`aria-busy`), *No place called "X"* + manual-place action, *Search failed* + Retry; typed text and a prior choice are never cleared by an error. | New `PlaceCombobox`. |

## 6. 44px / 320px / 200% text pitfalls found in existing code

1. `ui.css:643-655` — non-dense `SegmentedControl` wraps at 320px with three options (finding 8).
2. `shell.css:264-305` — four rail tabs are 68px wide, `nowrap`, no ellipsis; the longest RU label is the risk (finding 7). Test both languages at 320 and 360px and at text zoom 200%.
3. `ui.css:99-102`, `:114-116` — dense `Button` hit area is 40px on fine pointers; use regular buttons for row actions and keep 8px/12px gaps between neighbours.
4. `checkbox.css:107` — 44px hit area only on coarse pointers; make country rows full-row labels.
5. `flight-controls.css:28-40` — combobox popover is absolutely positioned inside the field, `z-index:55`, `max-height:360px`; it will clip inside any `overflow:hidden` ancestor and cover following rows. Keep legs/stops in page flow, not inside a clipped container.
6. `ui.css:258-264` — Sheet close is 44px with negative margins; long route titles must wrap, not push it off at 320px.
7. `capture/flight-form.tsx:950` — keyboard hint shown to touch users; omit.
8. Long values: place names, loops, 10 legs, RU plural strings. Use `min-width:0` and wrapping on card text; ellipsis only where the full value is one tap away, and never in the detail.
9. Fixed-px typography (rail 12/16, many 13/20 hints) may not follow text-only zoom. Unverified.

## 7. Real-content checks the first build must pass

Use clearly labelled synthetic fixtures, not live records: (a) loop Tbilisi → Kars → Tbilisi with one repeated city and one undated leg; (b) two cities with the same name in different countries; (c) a plan with a past date; (d) an undated completed trip in the History tail; (e) a 6-leg rail journey where only 2 legs have duration; (f) a manual place without coordinates; (g) a cancelled plan; (h) an RU run at 320px and 200% text; (i) zero, one and many countries; (j) a PDF that returns no trains next to a good JPEG.
