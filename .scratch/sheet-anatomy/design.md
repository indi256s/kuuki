# Overview section sheets: one anatomy

Status: **proposed**, drawings only. No app code until the user reviews the Paper page "Sheet anatomy".
**Update 2026-10-12:** figures chosen (Rhythm date stamper, Aircraft hangars, Continents jigsaw tray; Rankings still open). Continents replaces the Crossings metric. Mockups now draw the shipped Arc components (`Button`, `Chip`, bottom sheet). Chart view toggles use a compact 32px control; the owner rejected the shipped 50px `SegmentedControl` for chart headers. Motion is on board "15 Motion — swipes and picks"; the swipe keeps the built scroll-snap pager. Figure code and keyframes: `.scratch/figure-redraw/` (`figures2.ts` stamper, `figures3.ts` hangars2, `figures4.ts` puzzle, `figures5.ts` keyframes).
Scope: the mobile chapter sheet (`apps/next/src/client/overview/mobile/section-sheet.tsx`, mobile-only today) and a desktop sketch.
Sources read: `DESIGN.md` (Illustration, Motion, Overview redesign, Sheet primitive), `section-sheet.tsx`, `mobile.css`, `chapter-motion.ts`, `ui/sheet.tsx`, `sections/registry.ts`, each `sections/*/section.tsx` and `figure.tsx`, the iso kernel. Memories applied: no content divider lines, sarcastic copy, parallel fresh design agents as explicitly requested, board 20.1 (Clock is a linear 24-hour histogram, and the figure digits match the hero).

## 1. A shared selection, with contextual exceptions

The hero and chart share a selected reading. Data figures such as Clock, Rhythm, Routes and Records expose a corresponding selected detail. Tapping a chart mark or that figure detail updates the reading; the selected mark uses the accent without adding glow. Leaving the chapter restores its headline. The reading is local to the sheet and does not rescope Overview.

Continents is a data figure: the selected continent's piece is coral, and a pick lifts it out of the tray and seats it again. An unflown continent has no piece, so its empty socket outlines in coral instead. Aircraft studies link the selected silhouette or wingtip to its type row in Fleet view. Makers share remains manufacturer-level data; aircraft dimensions do not encode the 59% value.

Chart selection replaces the current filter-on-pick action in this drawing proposal; filtering remains explicit through the fixed scope chip and chart actions. This interaction change remains subject to the user's drawing review.

## 2. Anatomy at 390×844 (iPhone 13/14; top safe area 47, bottom 34)

The sheet's height is the built rule, `100dvh − max(16px, safe-area-top)`, which gives 797px, starting at y=47. Fill `--surface-floating`, top radius 20. All y values below are absolute in the 844 frame.

| # | Band | y | Height | Contents | Moves on swipe |
|---|---|---|---|---|---|
| 1 | Handle | 47–75 | 28 | 40×4 grip, `--control-border`, radius full. Sole drag-to-dismiss surface (built). | no |
| 2 | Header | 75–127 | 52 | H2 22/28 600 "Clock" + "4 of 7" 13/20 `--text-muted`; options 44×44 and close 44×44 at the right. | text shift 24px (built) |
| 3 | Pager | 127–149 | 22 | 7 segments 2px `--control-border`, 4px gaps, inset 24; accent indicator. | indicator 1:1 (built) |
| 4 | Filter row | 149–193 | 44 | **Always present.** Scope chip drawn as the shipped `Chip`: 32 tall, radius 10, 1px `--control-border`, `--surface-floating` fill with the 8% white ring, 13/20 400: "All flights" with a sliders icon; when filtered, "Boeing 737 · 2024" plus a 44px ✕ target. Opens the facet picker sheet. | no (chrome) |
| — | gap | 193–201 | 8 | | |
| 5 | **Figure stage** | 201–377 | **176** | Figure box 300×160, centered, optically centered within the shared box, with a bottom alignment guide at y369. No well and no plate: the figure sits on the sheet fill. | parallax 0.8× + fade |
| 6 | **Hero** | 377–473 | **96** | Value 40/44 600 −0.03em, tabular; unit inline at 22/28 `--text-muted` ("82 h", "8,298 km"). The caption is 15/24 `--text-muted` and always reserves 2 lines (min-height 48, clamped to 2). The "Only …" chip (32 tall) is pinned to the right of the value line and present only when the reading is not the headline. Its slot is absolutely positioned, so nothing reflows. | 1:1 |
| — | gap | 473–489 | 16 | | |
| 7 | **Chart stage** | 489–705 | **216** | Header row 32: caption 13/18 600 `--text-muted` on the left ("Local departure time", "Flights by month · all years", "Flights by continent", "Share of flights"); where a chapter has two views, the compact view toggle sits on the right. Toggle: 32px tall, 1px `--control-border`, radius 10, 2px padding; options 26px tall, 12px inline padding, 13/18 500; the selected option is a radius-8 `--surface-inset` pill in `--text`, the other is `--text-muted`. The 44px coarse-pointer hit area is the build's job. 8 gap. Plot 152. Axis 24. Axis ticks 12/16 Paper Mono `--text-muted`. | 1:1 |
| 8 | Details | 729→ | flexible | Section-specific. Mobile: a `Disclosure` (`ui/disclosure.tsx`) closes the fixed stages: a 44px trigger with the details heading (15/24 600) and an 18px chevron, collapsed by default. Opening it snaps the layout, fades the content in over `--dur-fast`, and the slide scrolls. Desktop shows details up front in three columns. Narrator at the foot. | 1:1 |
| 9 | Footer | 754–844 | 56 + 34 | Previous / Next, 44 tall, labels on one line (built). | label shift (built) |

Why fixed heights: the figure stage, hero and chart stage are identical boxes in every chapter. A swipe therefore puts two chapters side by side with their stages aligned, and the hero and chart baselines line up across the seam. Only the details below the fold differ in height.

### 2.1 Figure stage rules
- Each figure is drawn at its own k, fitted to 300×160 (`fitBox`) and capped at k 1.8, so strokes stay 1px. CSS never scales a figure (the DESIGN.md rule). This replaces "sheet figures share SHEET_K = 1": a calendar and a globe have no common real-world scale, so fitting the stage beats one shared k.
- Bottom alignment guide: y369 is a design annotation, never a visible content divider. The stage remains fixed; flat blueprint drawings may center optically within it.
- One selected detail in the accent, without glow. The figure is `aria-hidden`; its tap targets are separate transparent buttons with labels ("Show busiest hour"), each at least 44×44.
- The figure stage is not a drag surface. Swipes that start on it page the track like anywhere else.

### 2.2 Chart stage rules
- Ordinary marks use `--mark-ghost` fill. The reading's mark is `--accent`, and its value label is 13/18 600 `--text`. Baseline ghost outlines (all-time) stay 1px `--mark-ghost` strokes, as built.
- Makers follows the same selected-accent rule as Routes; manufacturer identity is carried by labels.
- No gridlines and no axis rules (divider ban). Bars sit on an implied baseline; labels carry the scale.
- The plot is 152 tall on every chapter. The view toggle is the 32px dense size DESIGN.md names, so it shares the caption row instead of taking its own (the shipped 50px `SegmentedControl` was tried and rejected 2026-10-12). Charts with more rows than fit (Rhythm heat grid, Rankings shares, Routes per year) live in Details.

### 2.3 Hero
The value always equals what the figure shows (board 20.1 rule: "figure digits must match the hero value"). Caption order: what the value is · the evidence · one extra fact. Proposed: on a pick the value rolls per character with the Arc `SlotText` (200ms `--ease-out`, direction follows the change) and the caption swaps in place. First render and swipes stay static; reduced motion swaps at once. This amends today's rule that Overview text swaps instantly.

### 2.4 Details
Whatever the section already has that does not fit a stage: tiles, ledgers, disclosures, coverage lines and the narrator. Groups are separated by space (24px between groups, 12px inside), with no hairlines.

### 2.5 Filter row
This replaces `.ov3-sheet-scope`, which collapses to 0px when unfiltered and appears at 44px when a filter turns on, a jump this anatomy forbids. The row is always 44px, sits in the chrome, and does not move with the chapter, because scope is global to every chapter.

### 2.5b Loading and empty (boards 11 and 10d)
- **Loading:** one `Skeleton` (`ui/skeleton.tsx`: static `--surface-inset` block, `--radius-md`, no pulse) per band, at that band's final box: figure 300×160, hero 96, plot and axis 176. The header, pager, filter chip, chart caption, toggle and footer stay live, so nothing jumps when data lands.
- **Empty:** `EmptyState` (`ui/empty-state.tsx`) replaces the hero and chart stage: a 17/24 title, one 15/24 line and one action, with no icon tile and no motion. The figure stays at rest with nothing lit. Example: Aircraft with no aircraft known shows "No aircraft on file" with the line "Your flights flew on something. Add the type and the hangars open." and the action "Open Journal".

### 2.6 "Only …" chip
When the reading is not the headline, a 32px chip at the right of the hero value line offers to filter the Overview to it ("Only 21:00", "Only March", "Only Qatar Airways"). It is `Button dense`, secondary, with a 14px filter icon. Tapping it applies the filter, and the filter row immediately names it with the real `Chip` (`Departure hour · 21:00` with its × remove button; board 11). A 44px hit area extends below the chip into the caption's top padding.

## 3. The seven sheets

The drawings use a saved order in which the user moved Clock up next to the fifth chapter: **Rankings 1, Routes 2, Records 3, Clock 4, Continents 5, Rhythm 6, Aircraft 7.** Continents takes Crossings' slot in the default order (Rankings, Routes, Records, Continents, Rhythm, Clock, Aircraft). Numbers marked *illustrative* are placeholders where the brief gave no real value.

### Clock (4 of 7)
- **Figure:** alarm clock reading **00:20**; the lit segments are the live part.
- **Hero:** `00:20` · "Earliest departure · ICN → DOH · busiest hour 21:00".
- **Chart:** "Local departure time", with control Departures | Arrivals. 24 vertical bars 00–23, 9px wide with 4px gaps (24×9 + 23×4 = 308; 342 plot width, centered). A night band from 22:00 to 06:00 sits behind the bars as `--surface-inset` with a 12px "night" label. The bar at 00 is the reading (accent). The bar at 21 is the tallest, labelled "21", in ghost. Axis: 00 06 12 18 23.
- **Link:** tap the 21 bar → the display morphs segment by segment to 21:00 (built morph, 200ms `--ease-out`), and the hero becomes `21:00` · "Busiest hour · 7 flights *(illustrative)* · most of them red-eyes". Tapping the snooze bar cycles earliest → latest → busiest → earliest (this extends the built earliest/latest toggle).
- **Details:** departures before noon, red-eye count (22:00–06:00), coverage line ("Based on N of M flights with departure times"), narrator.

### Rhythm (6 of 7)
- **Figure:** the passport-control date stamper (`figures2.ts` `stamper`). Its month band reads MAR in coral, and its last impression beside it prints "MAR · 11 FLIGHTS".
- **Hero:** `March` 11 flights · "Busiest month · longest gap 13 months, which the passport took personally".
- **Chart:** view toggle Calendar | Over time, caption "Flights by month · all years". 12 bars J–D: 6 2 11 6 3 2 5 0 5 6 4 7 *(illustrative shape, March highest)*; 20px bars at a 29px pitch; March is the reading.
- **Link:** tap a month bar → the band rolls to that month (200ms `--ease-in-out`), the head presses 3px (100ms) and returns (150ms) while the new impression inks in; 450ms in all (`--dur-moment`). Rapid picks retarget the band and press once, after the last. Over time keeps the stamper and sets the band to the selected year.
- **Details:** "Year by month": year × month heat grid with Flights/Distance/Hours, longest gap, daily activity, narrator.

### Rankings (1 of 7)
- **Figure: open.** The trophy was rejected; both loyalty-card takes (stepped wallet, fanned hand) were removed from the board on 2026-10-12. No sheet is drawn until one is chosen.
- **Hero:** Pegasus · Top airline · 4 flights, tied with Qatar Airways.
- **Chart:** Top airlines; Airlines/Airports/Routes. Pegasus 4, Qatar 4, 3F 3 are supplied; remaining rows illustrative.
- **Details:** Airports and routes; existing disclosures below the first viewport.

### Routes (2 of 7)
- **Figure:** boarding-pass stack; the top pass reads ROV ↔ VKO, and 74% of the passes carry the red stub.
- **Hero:** `32` routes · "74% repeats · ROV ↔ VKO ×9. Commuter, with extra steps".
- **Chart:** "Most-flown routes". 5 horizontal rows: ROV ↔ VKO 9 (reading), then 4 *illustrative* rows (4, 3, 2, 2). Mono route codes.
- **Link:** tap a row → that route's pass is dealt to the top of the stack (lift 6px, slide in, 200ms `--ease-out`), and its print changes. Tap the stack → steps through the top 5.
- **Details:** commuter/explorer profile, home share, flights and new routes per year chart with table, narrator.

### Continents (5 of 7) — replaces Crossings
- **Figure:** a world-map jigsaw tray (`figures4.ts` `puzzle`): real 110m coastlines merged per continent; flown continents are raised pieces, the rest empty sockets; Europe coral. The tray edge prints "3 OF 7 PIECES".
- **Hero:** `3` of 7 continents · "Europe most · Africa since 2024. The tray still has four holes in it."
- **Chart:** view toggle Flights | Firsts, caption "Flights by continent" (counted per airport). Seven rows at a 24px pitch: Europe 36 (reading), Asia 27, Africa 3, then North America, South America, Oceania, Antarctica as 4px stubs with "—" *(richest local test user)*. Firsts lists the year each was first reached.
- **Counting:** per airport, not per country. `packages/data/src/countries.json` files RU, TR, GE, AM and KZ under Asia and the Americas as one region, so: RU 19°–60°E → Europe; KZ west of 51.5°E → Europe; Turkish Thrace (lon < 29.1, lat > 40.4) → Europe; Egypt east of 32.6°E (Sinai) → Asia; Americas split by `subregion`; overseas European territories by location.
- **Link:** tap a row or piece → the piece lifts 4px (120ms `--ease-out`), takes the coral, and seats (200ms `--ease-out`); the old piece returns to the rest fill (150ms). An unflown row outlines its socket in coral and the hero reads 0 flights. The lifted piece paints last.
- **Details:** "Lines you crossed": the old Crossings counters (clock shifts 82 h, equator, Arctic Circle) and the per-year shift ledger, narrator.

### Records (3 of 7)
- **Figure:** folded map, DOH → NRT, with pins and the dashed route.
- **Hero:** `8,298` km · "Longest flight · DOH → NRT. Long enough to rewatch the safety video for fun".
- **Chart:** "Longest flights · km". 5 rows: DOH → NRT 8,298 (reading), then 4 *illustrative* rows.
- **Link:** tap a row → the map re-pins (the old pins drop and the new ones rise, 160ms) and the route redraws origin → destination (the built 160ms dash stagger). Tap the map → steps through the five.
- **Details:** the record cabinet (shortest, northernmost airport, earliest departure, busiest year), narrator.

### Aircraft · Makers view (7 of 7)
- **Figure:** three arched hangars on an apron, floor area by share (`figures3.ts` `hangars2`): AIRBUS 59%, BOEING 31%, OTHER 10%. Each name is painted over its door; each share is a stand marking on the lead-in line. The selected maker's doors, name and marking are coral.
- **Hero:** 59% · Airbus. Boeing 31%, Other 10%, Unknown 4 flights and 96/100 coverage are illustrative secondary data.
- **Chart:** view toggle Makers | Fleet, caption "Share of flights". Selected Airbus swatch and bar use the coral of its doors.
- **Link:** selecting a maker moves the coral to its hangar (150ms crossfade). Lighting only: the hangars never move, so reduced motion looks the same. Fleet artwork remains undecided.
- **Details:** Flights, distance or time; coverage and manufacturer disclosures below the fold.

## 4. Motion inside a sheet

Board "15 Motion — swipes and picks" holds the keyframes and lanes. One moment per chapter: a pick moves the figure's live part, and nothing else plays. No idle loops, arrival animations, glow or count-up.

| Chapter | Pick | Figure | Total |
|---|---|---|---|
| Continents | row or piece | lift 4px 120ms `--ease-out`, seat 200ms `--ease-out`; fills 150ms | 320ms |
| Rhythm | month bar | band roll 200ms `--ease-in-out`, press 100ms, return 150ms + ink in | 450ms |
| Aircraft | maker row | coral crossfade 150ms `--ease-out` (lighting only) | 150ms |
| Clock | hour bar | segment morph 200ms `--ease-out` (built) | 200ms |
| Routes | route row | pass lifts 6px and deals to the top, 200ms `--ease-out` | 200ms |
| Records | record row | old pins drop 120ms, new pins rise 160ms, route redraws with the built 160ms stagger | 280ms |
| Rankings | — | figure open | — |

Shared: a tap is under 8px of movement; press 120ms. The selected chart fill crossfades over `--dur-fast`; view toggles slide the selected pill over `--dur-base` `--ease-in-out` (the built thumb timing) and bars morph over `--dur-sheet` `--ease-out`. The hero value rolls with `SlotText` (§2.3, proposed). A new pick retargets from the current pose; nothing queues. Reduced motion keeps the lighting only: fills swap at once, with no lift, roll, press or morph.

## 5. Swipe choreography

**2026-10-12: keep the built pager.** Chapters stay slides in the native scroll-snap track (`mobile.css`, `chapter-motion.ts`): the browser owns tracking, momentum, axis lock and edge bounce, `scroll-snap-stop: always` keeps a flick to one chapter, and the pager, title and footer labels already follow the scroll position. The only addition is the figure's lag: each slide gets a view timeline (`view-timeline: --chapter inline`), and its figure stage, spanning the slide width, runs `translateX(-20%) → none → 20%` with opacity `0.25 → 1 → 0.25` over `animation-range: cover`. That is 0.8× parallax with no per-frame script, behind the same `@supports` gate as the pager; without it the figure moves 1:1. Hero, chart and details move 1:1. Reduced motion drops the parallax and fade. The transform-pager physics below (thresholds, spring, gesture ownership) are **superseded** and kept only as the earlier proposal.


The drawings specify a transform-driven pager. The current app's native scroll-snap behavior is source context, not proof of the proposed physics. No runtime changes have been made.

| Layer | Ratio to finger | Treatment |
|---|---|---|
| Grip, filter, actions, footer frame | 0 | Anchored chrome |
| Hero, chart, details | 1:1 | Translate by drag distance |
| Figure | 0.8× | Counter-translate by 0.2× the slide displacement; opacity falls to 0.25 at one full width away |
| Pager indicator | 1:1 progress | Position interpolates continuously between segments |
| Title and footer labels | Switch on committed release | One short fade; no per-frame React state |

At 40% drag, outgoing content is −156px and incoming content +234px. Figures move −124.8px and +187.2px in total, with opacities 0.70 and 0.55. Their centers remain 312px apart. At 60% drag, content positions are −234px/+156px and figures −187.2px/+124.8px. Figure and chart stage heights never change.

### Commit and settle

Commit one adjacent chapter when |dx| ≥25% of width, or |velocity| ≥0.45px/ms in the intended direction after ≥16px movement. Estimate velocity from the last 100ms; do not let a stale early flick override a reversed release. Otherwise return to the current chapter. Seed a critically damped settle with current position and release velocity: stiffness 300, damping 34.6, mass 1, approximately 330ms to rest. These are design targets for later device testing, not measured runtime results.

A new pointer down interrupts the settle and captures its visible transform, so nothing jumps. Clamp navigation to one chapter per release. At either edge, apply 80·(1−1/(1+d/240)) resistance, capped asymptotically at 80px, then settle back.

### Gesture ownership and rendering

After 8px movement, lock horizontal when |dx| >1.25·|dy|; otherwise yield to vertical sheet scrolling. Keep that lock until release. Vertical drag-to-dismiss belongs to the grip only. Figure and chart taps require movement under 8px; they never dismiss the sheet. A chart long press may acquire scrubbing after 350ms without movement; ordinary horizontal movement stays a pager gesture.

Read pointer position into a mutable animation value and write transform/opacity on requestAnimationFrame; no React render, layout size, top/left or scrollLeft mutation per animation frame. Commit selected chapter state once after release. Reserve touch-action and pointer capture so horizontal dragging does not swallow vertical scrolling; confirm nested scroll ownership on physical iOS and Android before implementation approval.

Desktop arrows and navigation buttons use the same settle. Trackpad horizontal deltas use the same transform progress, with a quiet-period release; predominantly vertical deltas continue panel scrolling. System history gestures remain platform-owned at screen edges.

### Reduced motion

Direct manipulation still follows the finger. Remove figure parallax, fade and scale so figure, hero and chart move together 1:1. On release snap immediately, with no spring, idle or selection animation. Keyboard and button navigation switch immediately.

## 6. Desktop (≥ 701px)

**Decided 2026-10-12: full cards inline, no chapter panel.** Each desktop card is the whole chapter in the sheet's band order, inside the built two-lane masonry. At a 1440 viewport that is two 684px lanes with a 16px gap and a 28px gutter.
- **Card:** the `.ov3-frame` shell, dark (`--surface`, radius 14, inset highlight, no border), padding 20/24.
- **Header 44:** H2 18/24 600 and a ⋯ ghost button. The grip shows on hover or focus.
- **Row A:** the 300×176 figure stage beside the hero (48/52 value, 3-line caption, "Only …" slot).
- **Chart stage 246:** header 32 with the caption and the compact toggle, plot 182, axis 24. Row charts stretch to the 636 content width. Count-driven column charts keep their natural 592 width, left-aligned.
- **Details up front:** heading, three detail columns, the coverage line, then collapsed `Disclosure` rows for the deeper analyses, then the narrator.
- **Hover:** fine pointer only. The chart tooltip previews; a click or Enter picks.
- **Board:** 14. Boards 10–10d (panel) are superseded as a container; their band contents feed the cards.

The earlier panel proposal, kept for reference:


Proposal for review, not a decision: tapping a card's title opens a **chapter panel**, a right-side Sheet 640px wide (`min(640px, 100vw − 48px)`, up from 460) at full height, radius 20 on the left corners.
- Header 64: title + "4 of 7", options, close; chevron buttons ‹ › sit beside the title instead of a footer.
- Pager 22, filter row 44.
- **Row A, 208 tall:** figure stage 300×176 on the left (figure box 300×160) and hero on the right (value 48/52, caption 3 lines). The figure sits **beside** the hero, so the chart gets full width.
- **Row B, chart stage 264:** full width 592, plot 200.
- Details below, scrolling.
- Paging: ← / → when focus is not in a text field or segmented control, horizontal trackpad swipe, mouse drag (§5), and the chevrons. Same parallax rule.
- Open question: whether desktop should instead keep bento cards and only adopt the figure / hero / chart order inside each card. The panel adds a second way to read the same section.

## 7. Open decisions for the user
0. (2026-10-12) Rankings figure: open. View toggle: the 50px `SegmentedControl` is rejected; build adds a `dense` prop to `SegmentedControl` on the `Button dense` pattern (`arc-scout.md`). Hero value roll with `SlotText` on picks (§2.3).
1. Tap-to-select instead of tap-to-filter on chart marks, with filtering moved to the "Only …" chip (§1).
2. Arrival beat only, or capped idle loops plus a DESIGN.md amendment (§4).
3. Fitted figure k per sheet instead of a shared SHEET_K (§2.1).
4. A filter row always present (44px) in chrome (§2.5).
5. ~~Desktop: chapter panel or bento-only (§6).~~ Decided 2026-10-12: full cards inline (§6).
6. `overscroll-behavior-x: contain` vs `none`, which needs a device check (§5.2).
