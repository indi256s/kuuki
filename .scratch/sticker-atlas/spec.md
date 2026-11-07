# Sticker atlas: add a country in two taps

On the owner's Passport map, an unrecorded country is a sticker. The first tap lifts it, and a tear-off tab both records the visit and says how you got there. Owner direction and rounds: 7 Nov 2026, this thread. Implementation plan: [docs/plans/2026-11-07-sticker-atlas.md](../../docs/plans/2026-11-07-sticker-atlas.md).

## Flow

| State        | What the owner sees                                                                                                                                                                                                                  | Leaves by                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **Rest**     | The map as today. Unrecorded countries are `--map-land`, with no hover effect.                                                                                                                                                         | Tap an eligible country → Lifted                                                |
| **Lifted**   | The country rises as a sticker with its name printed on the face. Under it hang four tear-off tabs: **Поездом · На машине · Морем · Иначе** (EN working copy: By train · By car · By sea · Other).                                   | Tab tap, or tab pulled past the threshold → Recorded. Anything else → Rest      |
| **Recorded** | The sticker tears off from that tab's side, the country turns `--accent`, its stamp lands, and a toast reads «{Страна} в паспорте» with **Отменить**. Nothing else appears.                                                           | Undo → Rest; toast timeout → the map shows the country as visited               |

Two taps, nothing else in the moment: no form, no sheet, no year. The year and a note are added later in the country sheet (Edit on the visit row) if the owner wants them.

Cancelling from Lifted writes nothing. The owner can cancel with a tap outside, Esc, a tap on another eligible country (that one lifts instead), or a pull released before the threshold. Tapping only to see what a country is therefore stays safe.

## Eligibility

A tap lifts a sticker only when all of these hold:

- The viewer is the owner on `/passport` in the Map view, and the view is not the visitor preview.
- No search or filter is active. Under a filter, a country recorded "By train" while "Flights" is selected would turn accent and then vanish.
- The country is in the catalog and is not pressed, pending or hidden, checked against the full collection rather than the filtered one.
- The country is a polygon. Microstates drawn as point markers open the sheet. If they turn out to matter, they get a round sticker in a later pass.

Every other tap behaves as today and opens the country sheet. Visitors never see stickers.

## What each tab writes

One `ground_visits` row, with no year and no note:

| Tab        | `entry_method` | `mode` | Counts under the filter    |
| ---------- | -------------- | ------ | -------------------------- |
| Поездом    | `land`         | `rail` | Trains, map scope «По земле» |
| На машине  | `land`         | `road` | Road trips, «По земле»     |
| Морем      | `sea`          | —      | Manual                     |
| Иначе      | `NULL`         | —      | Manual                     |

A tab never creates a claim, so Undo and Edit work the same way for all four.

There is no plane tab: flights come from the journal. Bus, walking or "I don't remember" go under Иначе.

## Data

- New nullable column `ground_visits.mode` (`rail` | `road`), allowed only when `entry_method = 'land'` (migration `0018`, additive). Legacy rows stay `NULL`, and a legacy `land` row reads «По суше» / "By land".
- The POST accepts `mode`. A new `PATCH /api/passport/ground-visits/:id` edits year, note and way.
- Sources: a visit with a mode counts under that mode, not under Manual. Claims and visits without a mode stay Manual.
- Overview, leaderboards, country evidence counts and publication are unchanged, and the mode never leaves the owner projection.
- The country sheet's "How you entered" uses the same four ways and labels (one shared module). Its visit rows gain Edit.

## Interaction contract

- **One sticker at a time.** Lifting another country drops the current one at once.
- **Lifted is a group named by the country.** Focus moves to the first tab. Esc closes it and returns focus to the map container. Tabs are buttons at least 44 px tall and are part of the sticker, not a separate panel.
- **Small countries.** If the country's outline is under 96 px on its longest side, the camera fits it, with a duration scaled by distance (0–300 ms) and 0 under reduced motion. The sticker follows every camera move.
- **Pull.** A pointerdown on a tab that moves more than 6 px is a pull: the sticker folds from that tab after the finger. Releasing at progress ≥ 0.4 completes the tear; releasing earlier springs back. Without movement, a tap plays the tear by itself. Tabs use `touch-action: none`, so a one-finger pull never scrolls the page. The rest of the map keeps its cooperative gestures.
- **The write starts at the tear and is optimistic.**
  - Undo waits for the created id if the write is still in flight, then deletes exactly that row.
  - On failure, the sticker fades back, the fill reverts, and an error toast offers Retry. Retry writes again without the tear, then lands the stamp.
- **No replay.** The recorded country is marked seen in the new-stamp baseline, so the Cards view does not replay its impression.
- **Keyboard.** The map canvas has no per-country focus. The keyboard path stays Add country → country sheet, whose form offers the same four ways.
- **Toast copy is bilingual**, because the toast outlives a locale switch (as with Hide).

## Motion

Rare action, so the tear may take its moment. The lift happens on every exploratory tap, so it stays a standard 200 ms. Tokens are from `apps/next/src/app/styles.css`, and the defaults from `~/.claude/docs/motion-durations.md`.

**Lift**

| Element    | Role                      | Starts | Duration                   | Motion                               | Relationship                       |
| ---------- | ------------------------- | ------ | -------------------------- | ------------------------------------ | ---------------------------------- |
| Sticker    | Lead                      | 0      | 200 ms (`--dur-base`)      | scale 1 → 1.04, shadow, `--ease-out` | —                                  |
| Camera     | Lead (small country only) | 0      | 0–300 ms by distance       | `fitBounds`                          | Together; the sticker rides along  |
| Tabs       | Support                   | 0      | 200 ms                     | fade + 4 px rise                     | Together: part of the sticker, no stagger |

**Tear**

| Element         | Role           | Starts                         | Duration                                                  | Motion                                                                     | Relationship                          |
| --------------- | -------------- | ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------- |
| Sticker + tabs  | Lead           | 0                              | 320 ms; after a pull `clamp(120, remaining × 320, 320)` ms | fold from the tab across the country, ease-in, leaves toward the tab, fades | —                                     |
| Country fill    | Static         | 0, switched under the sticker  | —                                                         | uncovered by the fold                                                      | No animation of its own               |
| Stamp (centre)  | Lead (handoff) | 240 ms                         | 450 ms (`cs-press-in`)                                    | existing impression                                                        | Lands as the sticker clears ~75%      |
| Toast           | Support        | 240 ms                         | existing entrance                                         | —                                                                          | Together with the stamp's impact      |
| Stamp, leaving  | —              | toast exit                     | 150 ms                                                    | fade                                                                       | Leaves with the toast                 |

**Close:** the sticker and tabs settle together in 150 ms (`--dur-fast`).
**Pull released early:** spring back in 200 ms with `--ease-out`.
**Undo and failure:** the sticker fades back in 150 ms, and the stamp and toast leave together.
**Interrupted tear:** a new tap jumps the tear to its end state first.

**Reduced motion:** the lift is an outline highlight with no scale and a camera jump. The tear is the sticker's opacity → 0 and the stamp's opacity → 1 together in 150 ms.

**Not moving:** the rest of the map and its labels (no scrim), the visited-countries counter (it updates at impact), and taps on visited countries (instant, as today).

**Feel check (owner, on a preview):**
- The tear should read as "the sticker uncovered the stamp", not as a queue. Scrub frames 200–300 ms. If it reads as a queue, start the stamp at 200 ms.
- A tapped tear's ease-in start should not read as lag. If it does, add a ~60 ms unstick bump.
- On a phone, the tabs should not sit under the thumb. Try Chile and Russia.

## Acceptance

- As the owner on the unfiltered Map view, a tap on an unrecorded polygon country lifts it within 200 ms, with its name and four tabs.
- A tap on Поездом writes exactly one row (`land`, `rail`, no year). The country turns accent, its stamp lands, and the toast offers Отменить. The country then appears under the Trains filter and «По земле», and not under Manual.
- Undo removes exactly that row, even when pressed before the write returns.
- A pull released before the threshold, a tap outside, or Esc writes nothing.
- A visited, pending or hidden country, a microstate marker, any country under an active filter or search, the visitor preview and the public page all open the sheet as today. Visitors never see a sticker.
- Under reduced motion there is no scale, camera flight or fold.
- The country sheet adds and edits visits with the same four ways, and a legacy `land` row reads «По суше».

## Rejected (do not re-propose)

| Round | Idea | Why it was rejected |
| --- | --- | --- |
| 1 | Scratch map with hold-to-peel | Gesture fights the map, hidden gesture |
| 1 | Panini sticker-sheet album | A new screen |
| 1 | Advent window with the form on the back | A queue of eight moves; reward before work |
| 2 | Flight-chain gaps ("teleports") | Owner wanted the sticker UX itself |
| 3 | A typed or dictated "sticker sheet" batch | «Поле мы не пишем, наше поле — это карта» |
| 4 | Drawing a route across countries | «Слишком сложно» |

A plane tab is rejected too. Any follow-up after the stamp (year chips, a "how?" question) is rejected as well: the end of the flow is the stamp.

## Out of scope

- Auto-peel for countries pressed elsewhere: a later idea, not in this release.
- Microstate stickers, stickers for visitors, and the Add country sheet redesign.
- Overview, leaderboard and publication semantics.
- Deploy. The remote D1 migration `0018` was approved by the owner on 2026-11-07 and runs through the `docs/runbooks/audit-remediation-release.md` gates.
