# Mobile dock: Journal section, rail + key, one Add card

Status: draft spec, 2026-10-15. Direction approved by the owner (Journal and Ground travel share one tab; transport filter as chips, option (b)). Open questions resolved on the same day (see Resolved questions).

Origin: `/dxe` review of the mobile dock (2026-10-15) and the follow-up conversation. Supersedes GT-01's "4 mobile tabs" (`docs/plans/2026-10-13-ground-travel.md:28`) and restores the approved rail of `8441ef07` (`.scratch/navbar-redesign/spec.md` Q15–Q19).

## Problem

- The rail has four tabs and no Add key (`client/nav.tsx` `TABS`). The + key was dropped in `22e349a8` to fit Ground travel.
- Adding is split three ways: the Journal header's phone Add flight (`journal/header.tsx:73`), the desktop header Add flight menu, and the ground page's `AddChooser`. From Overview or Passport a phone user cannot add anything without first switching tab.
- Ground travel is its own top-level section while Overview and the Passport map already treat flights and ground as one body of travel with a scope switch.

## Jobs

1. Add a flight, a train journey or a road trip from any member screen in two taps.
2. Find any trip record from one place: the Journal.
3. Keep the rail roomy at 320px in Russian.

## Decisions

### D1. Rail

**Overview · Journal · Passport · [+]**, as built in `8441ef07`: three labeled tabs (`GridSquares`, `BookOpen`, `Stamp`) and the 56px square solid + key, no visible label. Accessible name "Add" / «Добавить»; while open "Close" / «Закрыть». The + rotates 45° into ×.

- The Ground tab and its short label/`name` override are removed from `TABS`.
- The Journal tab is active on `/journal` and `/ground-travel` (and anything nested under either).
- The keyboard flag (`useKeyboardFlag`) is unchanged; opening the keyboard closes the card, as it did in `8441ef07`.

### D2. Add card (mobile) and Add menu (desktop): one list

The card is the shared `Menu` (side top, align end, spans the rail, 8px above it, tinted `MenuShield` scrim, rail stays above the shield and live), as in `8441ef07`. Desktop keeps one header `Menu` button with a chevron. Both render the same `AddActions`. Rows name themselves; there are no group labels:

| Row EN / RU | Href |
|---|---|
| Flights from files / Перелёты из файлов | `/import` |
| Flight by hand / Перелёт вручную | `/add` |
| Train journey / Поездка на поезде | `/ground-travel/new?mode=rail` |
| Road trip / Автопоездка | `/ground-travel/new?mode=road` |
| To review / На проверку (only with items) | existing `QueueMenuItem` |

- The flight pair and the ground pair are separated by space (two `MenuGroup`s with a gap), never a divider line.

- Fixed order on every page. No reordering by context.
- Ground rows carry the return context: on `/ground-travel` they use `withReturn(path, view)` for the current view (as `AddChooser` does today); elsewhere they link without `return`, so the form falls back to the list (`ground/form/return-context.ts`).
- Desktop button label becomes "Add" / «Добавить» (it no longer adds only flights).
- Ground row copy: reuse `ground/copy.ts` (`addTrain` "Train journey"; `addRoad` "Road trip") and add the RU strings there if they differ from the table; do not fork strings across files.

### D3. Journal section switch

Both list pages (`/journal`, `/ground-travel`) show the same visible heading **Journal / Журнал**. The heading's accessible text adds the section in a visually hidden span: "Journal · Flights" / «Журнал · Перелёты», "Journal · Ground" / «Журнал · По земле». Under the heading, directly under it, a section switch **Flights · Ground** / **Перелёты · По земле**.

- Semantics: a `nav` with an accessible name ("Journal sections" / «Разделы журнала») holding two links; the current one has `aria-current="page"`. Not `SegmentedControl` (a radio group): this changes the page, not a filter.
- Visual: the segmented look (one shared component, e.g. `JournalSections`), so it reads as a switch. Touch targets ≥ 44px tall on `pointer: coarse`.
- Always shown, including when the member has no ground journeys: the empty "Ground" state is the feature's only entry point besides the + card.
- Forms (`/add`, `/journal/[id]/edit`, `/ground-travel/new`, `/ground-travel/[id]/edit`) do not show the switch.
- Page metadata: `/ground-travel` becomes "Journal · Ground" / «Журнал · По земле»; `MobilePageTitle` shows "Journal" / «Журнал» on both.
- Routes, URL codecs (`journal/url.ts`, `ground/url.ts`) and return contexts stay as they are. `/ground-travel` is not renamed.

### D4. Switching is an instant swap

`/journal` ↔ `/ground-travel` is no longer a tab switch. In `route-transition-pairs.ts`, `isTabSwitch` returns false for this pair (both remain in `TAB_ROUTES`, so Overview/Passport ↔ either still fades). Because `useTransitionKey` keeps the boundary key for unapproved pairs, the page swaps with no fade and no scroll reset.

Focus after a switch goes to the page heading via `RouteFocus` (unchanged), as Passport does for its view switch. The heading's hidden section text (D3) makes the announcement differ per section; the switch is the next Tab stop.

No shared Next layout is introduced: with an instant swap the remounted header is visually identical, and the forms under both routes must not inherit it.

### D5. Remember the last section

The Journal tab (rail and desktop nav) links to the section last viewed in this browser tab only (owner decision): `sessionStorage` key `kuuki:journal-section` = `flights` | `ground`, written when either list page mounts. Server render and first client render use `/journal`; the stored section is applied after mount (no hydration mismatch). The section switch links themselves are fixed.

### D6. Ground transport filter becomes chips (option b)

On `/ground-travel`, the `SegmentedControl` All / Rail / Road inside `FilterToolbar` (`ground-page.tsx`) is replaced by a `ChipGroup` of `FacetChip`s (`ui/chip-group.tsx`), matching the Journal toolbar (`journal/toolbar.tsx:518`). "All" is the state with no chip selected; Rail and Road are single-select. `?mode=` and `GroundTotals` behaviour stay unchanged.

### D7. Removed entry points

- `journal-add-mobile` (Journal header phone Add flight) and its CSS: removed; the + key covers it.
- The ground page header `AddChooser`: removed on all widths; the header Add menu (desktop) and + card (mobile) cover it. `EmptyGround` keeps an add action: pass it the two ground rows (train, road) so the empty state still offers adding directly.
- Desktop `PrimaryNav`: the Ground travel link is removed; Journal is active on both sections.

## Non-goals

- A merged chronology ("All" across flights and journeys). The two pages have different read models (server-read store vs client read sectioned by the visitor's "today") and different list shapes; merging data is a separate project.
- Leaderboard in the rail. It stays in the account menu; a Passport rank tile linking to `/leaderboard` is a follow-up, not this spec.
- Changes to the account menu (the Passport duplicate via `account-who` is left as is).
- Route renames or redirects.

## Acceptance checks

- At 320×568 and 390×844, EN and RU: rail shows three labeled tabs and the + key with no truncated labels; no horizontal overflow.
- From Overview, Passport and both Journal sections: + opens the card above the rail; the four rows and (with items) To review are present in the fixed order; × closes; Escape closes and returns focus to the key; the keyboard opening closes the card.
- Each Add row lands on its form; Cancel from a ground form opened on `/ground-travel?mode=rail` returns to that view.
- Journal tab is `aria-current="page"` on `/journal`, `/ground-travel`, `/ground-travel?mode=road`.
- Switching sections swaps instantly (no fade, also with reduced motion), focus lands on the heading, `aria-current` moves to the other link.
- After viewing Ground, going to Overview and tapping Journal opens Ground.
- A member with no ground journeys sees the switch and the Ground empty state with train/road actions.
- Desktop: header shows "Add" / «Добавить» with the same grouped list; no Ground travel link; Journal active on both.
- Existing suites updated: `nav.test.tsx`, `add-menu.test.tsx`, `journal/header.test.tsx`, `ground/ground-page.test.tsx`, `route-transition-pairs.test.ts` (`['/journal', '/ground-travel', true]` becomes false), `scripts/smoke-next-runtime.ts` if it asserts tabs.

## Docs to update when built

- `DESIGN.md` "Route transitions" (line ~322: Journal ↔ Ground is an instant swap) and the mobile rail / Add card section.
- `docs/plans/2026-10-13-ground-travel.md` GT-01: note supersession.
- `docs/README.md` behavioural entry points if they name the Ground tab.

## Resolved questions (2026-10-15)

- Q1. Desktop Add label: "Add" / «Добавить» (owner).
- Q2. No group labels in the Add list; self-describing rows, the two pairs separated by space (owner accepted the recommendation).
- Q3. Section switch focuses the heading; the heading's accessible text names the section (owner accepted the recommendation).
- Q4. Section memory per browser tab, `sessionStorage` (owner).

## Coordination

The working tree has uncommitted changes in `ground/ground.css` and other shared files from other threads. Build on a task branch, keep those hunks intact, and follow `docs/agents/shared-checkout.md` before landing.
