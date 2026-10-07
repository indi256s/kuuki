# Overview redesign — visual/interaction decisions (2026-10-07)

Companion to `decisions.md` (product decisions, settled). Captured during the design discussion, before boards. Not a spec.

## Globe band
- Desktop: contained card in the 1200px lane (level 1: `--surface` + hairline; dark: inner top highlight). The globe floats on `--surface-inset` inside it. The H1 sits above the card.
- Card corners are control zones: chips top-left, Fullscreen top-right, replay transport bottom-left, legend bottom-right; the globe owns the middle.
- Rim: one flat 8px ring at accent 14% (22% in dark) plus a 1px hairline at the limb. No blur, no gradient.
- Camera re-frame on filter change: a 600ms fly with `--ease-in-out`, the one exception to "filter changes never animate". Stats and chips swap instantly. Reduced motion: jump cut.

## Replay transport
- Overlay, bottom-left of the card: pause button + month label (mono). Desktop: the year scrubber slides out on hover/focus. Touch: tapping the month label expands the scrubber across the card's bottom edge. Touches that start on a control never count as a spin.

## Filters
- One chip per facet: "Airline · Turkish, Qatar +1 ×". Chips use level 2 (floating) since they sit over the map. Clicking a chip opens that facet in the popover.
- "+ Filter" popover, empty query: search field, then top values (most-flown country, airline, route, with mono counts) as one-tap picks, then "Browse all facets ›". Typing searches values across all facets, grouped.

## Figures
- Four equal figures: 56px Commissioner 600, tabular, −0.03em; 13/20 muted caption.
- Deltas are status-colored: up `--success-text`, down `--warning-text`, always with sign and arrow ("↑ +12 vs 2025") so color is never the only cue. Hidden for all time.

## Page framing
- Next/awaiting strip: a 44px ticket-stub row on the page, no card. Status pill, route in mono, date · flight number, chevron. The awaiting variant adds a count and "Review". Hovering highlights the dashed ghost arc on the globe.
- Section headers: H2 with a 6-dot grip in the left gutter, outside the text lane. The grip shows on hover/focus with fine pointers and always on touch. The whole header gets a grab cursor. A ⋯ menu on the right: Move up, Move down, Hide. Hidden sections come back from a footer row: "2 hidden sections · Show".
- Narrator: 15/24 Commissioner 400 in `--text-muted` at the section foot, separated by space only, max 60ch. No icon, no quotes.
- Mobile globe card: full guttered width, about 360px tall.

## Sections
- Records: editorial rows separated by space only (no hairlines). Label, route in mono 17px, a tiny great-circle glyph, value right-aligned.
- Crossings: a row of counters (equator, date line, Arctic/Antarctic circle) with small line glyphs, then time zones: clock shift total plus zones overflown.
- Fleet: one stacked bar by manufacturer (labelled, ramp shades), then family rows with count bars and the most-flown variant in mono.
- Clock: a linear 0–23h bar strip, night hours (22–06) shaded `--surface-inset`, peak hour labelled, red-eye count.
- Rhythm: rows are years (newest on top) by 12 month columns, 28px cells at radius 6, a 4-bucket ramp, row total in mono. Segmented Flights | Distance | Hours top right, legend below. Mobile: cells shrink to fit 12 columns.
- Rankings: top 5 rows plus "versus" rows drawn as one diverging bar split at the share point (accent vs. ramp bucket 1).

## Charts: TanStack Charts (decided 2026-10-07)
- All section charts use `@tanstack/charts` (1.0.0, published 2026-10-03; SVG, SSR + hydrate). The globe stays MapLibre + flightcn. The static-SVG globe fallback may use `geoShape`, and the replay scrubber may use `handleX`.
- Every chart is a filter input: clicking a mark, or pressing Enter on a focused mark (`onSelect`), adds the matching chip. Tooltips are themed through `--ts-chart-tooltip-*` with paper tokens, and the palette uses the accent ramp (`--ts-chart-1..6`).
- Motion: the library's default tweens (1,100ms) on data change, **overriding** "filter changes never animate" for charts only. Figures and chips still swap instantly. `respectReducedMotion` stays on (snap to final).
- Records: rows kept, plus a distance × block-time scatter with a fitted line. Outliers are labelled "tailwind" / "holding pattern", and a "Fastest ground speed" record is added. Click a dot to open the flight.
- Crossings: counters kept, plus a jet-lag ledger: one `arrow` per flight, x = date, y = UTC offset, from origin zone to destination zone. Eastbound in accent, westbound in ramp 1.
- Fleet: a waffle with one cell per flight, grouped by family and colored by maker. Hover shows the tail and type.
- Clock: a 24h radial clock (`radialBarRadius`) with the night arc 22–06 shaded and a Departures / Arrivals toggle. Click an hour to filter.
- Rhythm: the years × months grid is kept, plus an odometer: a cumulative-km `lineY` with `brushX`. Releasing the brush (commit) adds a date-range chip.
- Rankings: a bump chart of rank by year (Airlines / Airports / Routes segmented, `interactiveColorLegend`), plus the top 5 and the versus rows.
- Mobile: each chart reflows. The scatter and bump chart go full width with fewer ticks and labels. The ledger and odometer stay full width. The waffle wraps to 12 per row. The clock is about 300px. No horizontal scroll.
- Filtered state: matching flights in full color, all flights as a faint ghost layer behind them (grey dots, a grey odometer line), so the filtered set always has a baseline.
- Touch: the first tap pins a tooltip with an "Add filter" or "Open flight" button. Tapping elsewhere dismisses it. A tap never filters directly.
- Accessibility: a "View as table" text button under each chart opens its data as a table, which is also the screen-reader path. The library has no built-in fallback.
- Bump chart: always shown, with no flight-count threshold. Tied ranks share a y position.
- Ghost style: hairline grey for every chart except the scatter's grey dots. In the waffle, unmatched squares are drawn as outlines only. The clock draws the all-flights bars as grey outlines behind the colored bars. The bump chart draws the other entities as grey lines. The odometer draws the full line in grey under the filtered line.
- Figure deltas: shown only when a time filter is on, compared with the previous period of equal length. With facet filters only, each figure shows its share of all flights instead, like "24 flights · 35% of all".
- Boards: the filtered demo is Year 2025 + Turkish. On mobile the four figures sit in a 2×2 grid at 40px, and sections stay expanded. The mobile shell is the existing one from DESIGN.md: a 48px title header and the 5-tab bar, with Add in the tab bar.
- To verify at spec time: the gzipped bundle inside the Worker, whether a `'use client'` wrapper is needed, and the d3-geo 3 dependency.

## States
- First run: same card, still blank globe; the narrator line and the Import / Add buttons centered over the lower third. Figures and sections are not rendered.
- Filtered to zero: the globe stays, everything ghosted; figures show em-dashes; sections collapse into one narrator line with "Remove last filter" and "Clear all". The chips stay.
- Dark: token-driven. Ocean/card fill `--surface-inset`, land one step lighter, rim 22%, routes on the accent ramp.

## Audit fixes (2026-10-07)
These follow the `/impeccable audit` of boards 9.1 and 9.2 (scored 11/20). They supersede the colour and ghost lines above wherever the two conflict.

- **Data-mark tokens.** Every chart mark needs at least 3:1 against `--bg`. `--hairline` stays structural and is never used as a data colour.

  | Token | Light | Dark | Use |
  |---|---|---|---|
  | `--mark-1` | #a94e35 | #e6a184 | primary series, eastbound, Airbus |
  | `--mark-2` | #be7f5b | #b46f47 | secondary series, westbound, Boeing |
  | `--mark-3` | #b28555 | #a17749 | tertiary series, Embraer/ATR |
  | `--mark-4` | #66605b | #c4beb7 | fourth series |
  | `--mark-ghost` | #978c7f | #897e70 | ghost layer, Unknown, "Same zone" |

  Charts read these tokens through `--ts-chart-1..6`; no hex values are hard-coded in chart code.
- **Heat ramp** (Rhythm grid, used in both themes): `--surface-inset`, #dfccb8, #c38a69, #a94e35, #7a3524. Every cell also shows its count in its tooltip and in the table view.
- **Colour is never the only cue.**
  - Waffle makers: Airbus is a filled square, Boeing a filled circle, Embraer/ATR an outlined square, and Unknown a dashed outline.
  - Jet-lag arrows: eastbound points up and westbound points down. Same-zone flights are a ghost dot.
  - Bump lines use dashes: solid for the top two, `6 4` dashes for the third, solid grey for the fourth, and `1 4` dots for the fifth. The legend repeats each dash style.
- **Segmented controls** use the DESIGN.md size: 44px cells, at least 104px wide, 3px padding. Earlier boards used 32px cells.
- **Hit areas.**
  - Dense controls (Fullscreen, + Filter, the queue pill, replay pause, ⋯ menus) are 32px visually with a 44px hit area on coarse pointers.
  - Text links ("View as table", "Find the missing 5") reach 44px through vertical padding.
  - Small chart marks get no 44px boxes. The library focuses the nearest point within 48px, so a tap near a mark already hits it.
- **Brush (odometer).**
  - Handles: a 44px hit area on coarse pointers is the goal, but `brushX` in @tanstack/charts 1.0.0 has no separate hit-area option. `handleSize` sets both the drawn width and the hit width (`dist/interaction-brush.js:12,179`). The hit-area option in the docs belongs to `handleX`. At spec time, either widen the hit area with a transparent stroke (untested) or accept `handleSize: 6` and rely on the month pickers.
  - `touch-action: pan-y` on the host doesn't reach the brush area, because the overlay sets `touch-action: none` inline (`:142`). A vertical swipe that starts on the brush won't scroll the page, so the brush is the only part of the chart that captures touch.
  - There is always a non-drag alternative: a From / To row of 44px month pickers plus a 44px clear button under the chart. It writes the same date-range chip.
- **Focus.** The chart host keeps a `:focus-visible` ring (2px `--accent`, 2px offset). Never use `outline: none`.
- **Captions.** Chart captions use 15/24 Commissioner 600 in normal case. Instructions are never set in all caps. Short column labels and pills may stay uppercase.
- **Grip dots** are `--text-muted` (#66605b), not #b3ada7.
- **Performance.**
  - Charts below the fold load lazily (an IntersectionObserver with a 200px root margin) behind a fixed-height skeleton, so nothing shifts.
  - On filter change, only charts in view tween; the rest snap to their final state.
  - Measured bundle: about 153 KB gzipped including React, so roughly 95 KB for the charts (inferred). Confirm inside the Worker at spec time.
- **Russian.** Captions and segmented labels must fit in Russian at 390px; see the length check below.

### Russian length check (2026-10-07)
Method: canvas widths in the app's own Commissioner woff2 files (Cyrillic glyphs confirmed), measured against the mobile slots at 390px. Script: `/tmp/kuuki-audit/scripts/ru.mjs`.
- Segmented cells leave about 100px for the label. The tightest is "Авиакомпании" at 92px in the 600 weight. All the others are 70px or less.
- Captions (15px 600): the longest is "Журнал смены часовых поясов" at 223 of 358px. The H2 "Пересечения" is 124 of 286px.
- The waffle legend in Russian is 329 of 358px and close to full. It must be allowed to wrap onto a second line; never truncate it.
- Range pickers ("С" + "янв 2021" + chevron): about 65 of 101px.

### Re-check after fixes (2026-10-07)
- Rankings top-5 count bars use `--mark-1` on the `--surface-inset` track. The old ramp step measured 2.58:1.
- Rhythm future-month cells use a dashed `--mark-ghost` outline instead of hairline.
- Accepted below 3:1: the pale heat-ramp steps and their legend swatches. A sequential ramp can't put every step at 3:1 against the page, so adjacent steps are kept distinct and every value is in the tooltip and table. The far side of the Versus bar is also accepted, because the data boundary is accent against pale (about 3.8:1) and both shares are printed.

## Accent: Shu 朱 replaces Terracotta (2026-10-07)
Terracotta read as generic; it used only 69% of the chroma its lightness allows, so it looked brown. Shu (vermilion, torii red) becomes the default and Terracotta is removed. The other four accents are unchanged. This supersedes the mark and heat-ramp values in "Audit fixes" above.

| Token | Light | Dark | Measured |
|---|---|---|---|
| `--accent` = `--accent-text` = `--mark-1` | #c23417 | #ea846f | light 5.30:1 on bg, 5.53:1 on #fff, 4.86:1 on inset; dark 5.63:1 on bg, 4.81:1 on surface, 4.12:1 on inset (below 4.5: no accent text on dark inset) |
| `--accent-foreground` | #fff | #292827 | 5.53:1 / 5.63:1 |
| `--mark-2` | #da6a53 | #c85f49 | 3.26:1 on bg / 3.64:1 on bg |
| `--mark-3`, `--mark-4`, `--mark-ghost` | unchanged | unchanged | |
| `--danger-text` | #a02442 | #f0a7af | 7.12:1 / 7.60:1 on bg |
| `--danger-fill` | #ca3056 | #f25776 | fill grade, never text |

- Heat ramp: `--surface-inset`, #e6c8c1, #e4735c, #c23417, #892410.
- Hue spacing in OKLCH: Shu 33°, the new crimson danger 12° (21° apart), Sakura 355° (17° from danger). The old danger red (24°) sat on top of every red candidate, so danger had to move.
- Dark Shu looks coral. Any red light enough for text contrast on #292827 turns salmon; this is accepted.
- Not yet propagated: DESIGN.md accent table, `styles.css`, `tokens.test.ts`, the stored accent name and the legacy-name mapping (`terracotta`/`kincha`/`sumi`/yellow → `shu`). That is build work for the spec.
- Map buckets (globe legend, accent-picker shade strips): Shu light #ecc6bb, #e5a494, #da7d68, #c94c33; dark #674e47, #865c51, #ac6b5d, #d87d6a. They are mixed in **oklab**, not oklch. Under DESIGN.md's `color-mix(in oklch, accent N%, map-land)`, the hue drifts towards the land colour's hue, so Shu buckets would turn orange (#d68253 at 65%). At spec time, change that formula to `in oklab`. Terracotta's old buckets showed the same drift; the brown was hiding it.
- The accent proposal board's claim that every accent is at least 20° from a status hue no longer holds: Sakura is 17° from the new danger, so the board text now says 17°.

- **Banned (user, 7 Oct 2026): divider hairlines inside content.** No rules between list rows (Records, Top 5, Versus, sheet rows), above the narrator or between hero figure columns. Space, alignment and the bar tracks do the grouping. Extended the same day to page chrome: no rule under the page header, around the Next strip, above Hidden sections, above the mobile tab bar or on the sheet header/footer. Only full outlines stay (cards, inputs, chips, buttons), plus the 2px active-tab indicators. Boards 9.1/9.2 keep them as the untouched "before".
- **Records chart (7 Oct 2026): record progression replaces the distance × block-time scatter.** The user rejected the scatter and its metric. The new chart is a step line of the longest-flight record over time: a dot each time a flight beat the previous longest (7 records, the last DOH→AKL in Mar 2023). All flights appear as faint ghost dots underneath. Three labels: JFK→LHR, DOH→NRT, and DOH→AKL · 14,535 km. The tooltip shows the date, the distance and "Beat the record by N km". Bento capture: `/tmp/kuuki-live` `RecordsProgress`, job `b1p`. Mobile sheet 9.5 still shows the old scatter.
- **Crossings chart (7 Oct 2026): yearly clock-change bars replace the per-flight jet-lag arrows.** The user found the arrows confusing. Bars above zero show hours of clocks forward (east, Shu); bars below show hours back (west, mark-2). Each bar has its value, and years with no flights show a dash. The "Clocks shifted" counter changed from 41 h to 85 h to match the data: 54 h forward + 31 h back. Bento capture: `/tmp/kuuki-live` `CrossingsShift`, job `b2s`. The mobile sheet still shows the arrows.
- **Hero figures (7 Oct 2026): ranked panel instead of four equal 56px figures.** The figures are now in a white card like the bento cards. The lead figure is 69 flights at 80px, with "Flights since March 2014" and a "3 awaiting review →" link. Below it is a 13-bar flights-per-year strip ('14–'26) with the 2019 peak in Shu, the other years in #E6C8C1 and empty years as 2px stubs. Then a 2×2 grid at 32px with 15px units: 141,204 km (3.5× round the equator), ≈ 9d 4h (in the air, 6 estimated), 16 countries and territories, and 18 airports. The airports figure is new and computed from the flight data. The mobile hero on 9.4 is unchanged.

## Navbar logo — old kana tile restored (2026-10-07)
- Replaces the solid Shu 空 tile + "kuuki". Tile 32×32, radius 8, Shu at 10% tint; glyph Noto Sans JP 700 18px in Shu; wordmark "Kuuki" Commissioner 600 18px, gap 8.
- Motion = the old shipped kana crossfade く→う→き: `kuuki-crossfade` 7.5s ease-in-out infinite, delays 0 / 2.5s / 5s (0–8% 0, 20–30% 1, 42–100% 0). Hover tint 10%→20%. Reduced motion: static く.
- Literal 12s spin (old dev icons page only) rejected: reads as a loading spinner. Spec board 9.6.
- DESIGN.md:182 (空 tile, "crossfade not built") must be updated when this ships.

## Category colour — manufacturers & alliances (interview, 2026-10-07)
Context: the user liked the old site's maker waffle, fleet ridgeline, flag map and alliance-marked airline filter, and wants distinct colours per manufacturer and alliance. Finding: the planned dye palette collided with 4 of 5 accents (Ai, Matcha, Asagi, Sakura), so new dedicated palettes are required.
- **Palette:** new manufacturer palette in the hue gaps left by the 5 accents + status hues (ochre, jade, cerulean, violet), each paired with a fixed cell shape. Separate from accents; Shu never a category colour. Build/check with better-colors + dataviz validator, light and dark steps validated separately.
- **Slots (global, same for every user):** Airbus, Boeing, Embraer, ATR. Everything else → grey "Other", expandable in the legend (each member a filter input).
- **Attribution:** current type designation (A220 = Airbus), one table keyed by ICAO type.
- **Alliances:** mark-first (★ ○ △) in deep low-chroma "tinted ink" tones; never share a chart with makers. Own filter facet matched by membership at flight date; airlines that left get a note ("S7 · left Oneworld 2022"). Operating carrier decides airline and alliance. No Alliances chart; colour appears in filter, chips and Journal rows (12px mark before airline code, none for unaligned).
- **Mapping data:** versioned typed TS tables in repo (ICAO type → maker; airline → alliance with dates), with tests.
- **Tokens:** entity tokens (`--cat-maker-airbus`, `--cat-alliance-star`, …) per theme, mapped onto `--ts-chart-n` per chart at render.
- **Text:** numbers and legends stay text ink; identity via swatch/shape chip beside them.
- **Filters:** maker identity persists page-wide (map routes, fleet rows, chip swatch).
- **Manufacturers card (new, split from Fleet):** waffle; metric toggle flights / hours / km. Flights = 1 cell per flight (shrink to 6px min, then 1 cell = 5 flights, stated in legend); hours/km = 100-cell percentage grid with absolute total in header. Toggle re-flows cells 300ms, instant under reduced motion. Toggle stored in URL per session. Cell tap = maker filter; hover lights all cells of that maker + tooltip for that flight. Shapes on every mark ≥ 8px. Unknown = dashed ghost cells at the end + "5 unknown · Add aircraft →" to the review queue. One-line narrator (glados-copy rules), muted non-italic 14px.
- **Fleet card:** body split = Narrow | Wide segments with 6px gap, maker-colour sub-bands inside; ridgeline per type for ≥ 8 flights, actual dots for smaller types.
- **Map:** Shu visits ramp stays default; "Flag tones" becomes a map-layer mode with one curated dominant colour per country, tuned per theme, pushed off pure Shu (Turkey/Japan → crimson).
- **Social:** same global maker colours on public profiles and leaderboard.
- **Mobile:** tile shows proportional bar + headline; section sheet holds full waffle, toggle and Other list.
- **Dark:** full parity, drawn in this pass.
- **Next boards (user-scoped):** palette + tokens (light/dark, accent-clash checks ×5), Manufacturers card, Fleet card. Alliance surfaces + map not in this pass.
- **Palette values (validated 2026-10-07, dataviz validator, all-pairs CVD in both themes):** Airbus Hanada 縹 `#0F6390` / dark `#0685B6` (rounded square); Boeing Tokusa 木賊 `#16A384` / `#04AC7B` (circle); Embraer Ōdo 黄土 `#8C6D08` / `#A4770F` (rounded diamond); ATR Kikyō 桔梗 `#9A52CF` / `#A36FFA` (ring); Other `#978C7F` / `#897E70` (inset square); Unknown = dashed ghost outline. Light worst all-pairs CVD ΔE 10.5, normal 17.8; dark 10.4 / 16.8. Nearest accent hue: ATR↔Ai 26°. Trade-off: Airbus 10° from info, Boeing 14° from success, Embraer 16° from warning (status always icon + label, never in charts). Alliance inks: Star ★ `#6B5A2E` / `#CDB98A`, Oneworld ○ `#6A3F55` / `#D3A6BC`, SkyTeam △ `#3E5266` / `#A9BBD0` (≥ 5.9:1). Spec brief for boards: `/tmp/kuuki-pal/BRIEF.md`. Boards 10.1, 10.2, 10.2d, 10.2m, 10.3.

## Maker marks: one shape, colour only (2026-10-07)

- Replaces the per-maker shapes (circle / diamond / ring / inset / dashed). Every maker mark — waffle cells, bar segments, legend chips — is one filled rounded square (radius 20% of size). Reason: the hollow ATR ring and dashed Unknown cells broke the waffle's texture; the palette already passes CVD on colour alone.
- Greys retuned because without shapes old Other `#978C7F` collided with Boeing for deutan (ΔE 1.8):
  - Other: light `#C2BAB0`, dark `#C9C1B7` (all-pairs CVD and normal-vision pass; light is 1.9:1 on white, relieved by always-on legend labels).
  - Unknown (`--cat-maker-unknown`): light `#ECE9E5`, dark `#47433F` — reads as an empty slot next to "Add aircraft →".
- Fleet ridgeline: sparse types (< 8 flights) draw one narrow spike per flight on the shared baseline instead of floating dots.

## Records card — record cabinet (2026-10-07)
- Replaces the label/route/value rows and the "longest flight, record by record" step chart (user: rows too plain, progression chart too much). Bento board 9.3; the mobile sheet 9.5 still shows the old rows.
- Layout: lead tile (558) + 2×2 tiles (276 each, gap 24), all on `--surface-inset`, radius 10, each with an ↗ "open flight" affordance. Narrator unchanged.
- Lead · Longest flight: route in mono 28, city names, 64px figure, flight meta; three stats (in the air, average ground speed, clock shift); a route sketch crossing a dashed equator; a "% of the way round the equator" bar (40,075 km) with a tick at the previous best.
- Tiles, each a 32px figure + mono route + one micro-visual on a 240px track, dot marker in accent: Shortest (scale 0 → longest, "1/78 of your longest"), Furthest north (0–90° with the Arctic zone shaded), Earliest departure (00–24 with the 22–06 night band shaded), Busiest year (12 month bars, peak month in accent).
- Tile captions stay factual; the narrator is the only sarcastic line in the card.

## Rankings card — leaders + head to head (2026-10-07)
- Kept as is: Rank by year (bump chart, segmented Airlines / Airports / Routes, View as table). User: "I love only Rank by year".
- Top 5 lists with per-row bars → three leader tiles on `--surface-inset` (354 each, gap 48, so they share the column grid with the row below). Each: "Top airline / airport / route" + "of N", the #1 name at 22px (routes in mono), 32px count + share, one 10px share strip (#1 in accent, #2–#5 in ramp 1, rest on the track, 2px gaps), a "Top 5 = N%" caption, then #2–#5 as plain rank/name/count rows (no bars).
- Versus split bars → "Head to head" scoreboards: chip + name on each side, mono score "38 : 21" in the centre, one 8px split bar. Airbus/Boeing use the maker tokens; haul and day/red-eye use accent vs ramp 1.
- Header hint now "Click any name to filter the page". Narrator moved off "Turkish Airlines, 24 times" (the leader tile already says it).
- Sample-data placeholders to compute for real: "of 14 airlines", "of 31 routes"; airport share is per airport visit (2 per flight).
- Leader tiles v2 (same day, polish pass): label only ("Top airline"); lockup = 44px badge (accent 10% tint #EDDDD8, text #B02F14, 4.9:1; airline/airport code in mono, a route glyph for routes) + name 18/24 600 with a 13px context line (alliance / "Georgia · home airport" / city pair) + count 28px right-aligned over "flights". One 8px strip: #1 accent, #2–#5 combined in map bucket #E5A494 (1.7:1 vs the track, was 1.2:1 with #E6C8C1), rest on the track, with a two-swatch legend ("35% of your flights", "Top 5: 72%"). Rows 24px tall, 4px apart; 16px between groups. "of N" counts dropped.

## Crossings counters → tiles (2026-10-07)
- The four bare 44px counters become inset tiles (271 wide, 16 gap, padding 16/18/18, radius 10), matching the Records and Rankings tiles. Each tile: 13px label; a row with the 32px figure (68px slot) and a 147–151px graphic; a 12px caption.
- Clocks shifted: forward/back split bar (accent / #E4735C, the chart's "back" colour), "54 h forward · 31 h back". Time zones: 24 ticks, 18 in accent, "18 of 24 hourly UTC offsets". Equator / Arctic Circle: dashed reference line with one dot per crossing, plus the last crossing's route.
- Tiles now total about the ledger chart's height, so the two columns balance. The Head to head scores got a fixed 96px centred slot so all three line up.
- Clock dial labels checked: 00/06/12/18/22 sit on one radius (measured); "22" only looks inset because it is the one non-cardinal label (night-band start). Not a bug.

## Critique fixes (2026-10-07)

This round follows the critique snapshot in `.impeccable/critique/`. Findings that only matter in the built app were left for the spec, not fixed on the board:
- 44px hit areas on 32px controls;
- loading and error states;
- hover affordances;
- token names for literal hex values.

Desktop 9.3:
- **Clock narrator** now reads "More trips start at 7 a.m. than at any other hour…". 07:00 is the most common hour, not most flights.
- **Head to head** gains a card-level footnote: "Daytime v red-eye leaves out 8 untimed flights". It sits under the bouts rather than inside one, so the three bouts stay the same height.
- **Hero year bars:** the non-peak bars use `--mark-2` #DA6A53 instead of #E6C8C1. That is 3.40:1 on white, up from 1.57:1. The 2019 peak stays Shu.

Mobile 9.4 / 9.5:
- **Crossings tile:** 85 h, matching desktop.
- **Rankings tile:** the TK/QR/FZ labels go from 9px to 12px.
- **Tab icon:** the active stroke is now Shu, matching its label.
- **Tile order** follows desktop: Rankings, Records, Fleet, Clock, Rhythm, Crossings.
- **Records sheet:**
  - The rows match desktop: Earliest departure TBS → IST 04:55 replaces Fastest ground speed.
  - The rejected scatter is removed.
  - The sheet now sizes to its content ("2 of 6", next is Fleet).

Kept on purpose:
- **Rankings first** (the user's call).
- **Grey tiles** in Records, Rankings and Crossings (approved today).

Still open:
- Long-haul and red-eye segments (#E6C8C1) and map buckets 1–3 are below 3:1. These need a ramp or token decision.
- Repeated facts (busiest year, Airbus vs Boeing).
- Sticky filter scope when scrolled.
- The page ending.

## Mobile catch-up (2026-10-07)

9.4 and 9.5 brought in line with the maker-colour, Records-cabinet and section-order decisions:
- **9.4 Manufacturers tile** (from 10.2m) added full-width after Records, so the mobile order is Rankings, Records, Manufacturers, Fleet, Clock, Rhythm, Crossings (same as desktop). Board height is now fit-content.
- **9.4 Fleet tile:** the mixed-shape Shu waffle (squares, circles, rings, dashed cells) is replaced by the desktop's Narrow 48 | Wide 16 bar with maker sub-bands. Caption "Most flown type · 8 types" replaces "Airbus 38 · Boeing 21", which the Manufacturers tile already says (one repeated fact gone).
- **9.5 Records sheet:** rows → record cabinet: lead tile (DOH → AKL, 14,535 km, equator bar at 36%) plus four inset tiles (Shortest, Furthest north, Earliest departure, Busiest year). Pager "2 of 7" with 7 segments; Next is Manufacturers. The sheet still clears the status bar.


## Implementation source reconciliation (2026-10-07)

The real 69-flight source takes precedence over illustrative board data labels: 14 countries, with Maldives already visited on DOH→MLE, 2023-07-27. The hero therefore shows 14 and upcoming DXB→MLE is not a new country. Preserve actual dates, routes, distances and durations; add sourced KTT/AT76 reference metadata for geometry and canonical type parity. See [source acceptance gates](issues/02-board-source-parity.md).

The exact prescribed palette also takes precedence over the conflicting blanket 3:1 mark rule. Unknown and all below-3:1 heat steps join the labelled-mark exceptions in both themes, with visible ink labels/values and accessible tooltip/table paths. Exact values stay verbatim; no mark is falsely certified as 3:1. See [contrast acceptance gates](issues/01-palette-contrast.md).

### Dated alliance admission (2026-10-07)
operate on inclusive from/exclusive to ISO calendar dates. Official recognized regional/associate/affiliate participation qualifies; parent/lounges alone do not. EN has no admitted span despite stale static JSON. OK is SkyTeam, not static Star. FJ continuous from2018-12-05; WY formal2025-06-30; CZ formalagreementend2019-01-01. SU is suspended; use2022-04-27 as earliest documented official-statement archive as-of boundary, explicitly qualified in source comments/report as inferred observation, not a verified issuer-effective day. This consciously admitted snapshot inference resolves the date-only gap; no year/month padding or open-ended SU. LP from2000-06-01 is composite-primary inferred event linkage, explicitly qualified. Preserve final partial operating day for MX/QA to2010-08-29 and MA to2012-02-04; NW to2010-01-31 and US to2015-10-17 are operational-code/brand cutoffs, not asserted formal alliance exits. Cite primary exit/entry sources in adjacent provenance comments when one source row field cannot convey both. TA proven2012-06-21 entry can remain open-ended because no established termination and 2026 carrier-issued TA code continuity; disclose lack of separately confirmed current full membership. Known leavers include every admitted complete span (CM/FM/SK/EI/JJ/4M/XL/LP/QA/AB/HG/MX/CO/NW/MA/US). Incomplete additional historical intervals (AZ exactstart, MXpriorStarstart, USpriorStarstart, COlaterStar, JP/JK/BD/RG/AN/KF/O6, AZA) remain excluded with documented unknown coverage; do not fabricate days or conflate successor IATA identities. For reusedcodes MX current successor must not inherit old operating history. Research dossiers are read evidence, not generic current static classification.

## 2026-10-07 — reused MX former-history safety

Task3 round1 I1 disposition (2026-10-07): Breeze primary documentation identifies current MX (https://pro-docs.flybreeze.com/api/ndc-xml/sample-flows/make-a-test-booking), corroborated by IATA clearing-house list. Current MX must not inherit old Mexicana former alliance. Without an admitted exact code-reassignment day, conservatively suppress formerAlliance for normalized MX on every date; allianceAt preserves the admitted old Mexicana active span. This explicitly qualified former-note coverage omission avoids fabricating a reassignment boundary. Ordinary same-carrier former/gap behavior remains unchanged. M1 lint config warnings are nonblocking inherited tool-scope noise; retain accurate report, no unrelated tooling repair.

## 2026-10-07 — control focus and updated month bounds

Task14 controls review dispositions (2026-10-07): fix both Important findings from r3-task14-controls-review-round1.md. Popover: Escape and blank/nonfocusable outside dismissal restore actual opener focus; preserve intentional outside-control focus. Use supported Radix autofocus hooks, do not introduce modal swallowing of outside actions or custom positioning. MonthRange: validate every nonempty candidate endpoint against current shape/bounds; discard incompatible partial drafts when min/max change, never emit an out-of-bounds retained controlled endpoint. Canonical category marks still await accepted Task3 integration.

## 2026-10-07 — membership aggregation and Passport identity

Task4 groups monthly rows by actual dated membership state and retains an earliest actual represented date so alliance facets survive aggregation. Monthly period/replay labels and Release2 metric distinctions remain. Task5 upcoming-country novelty requires Passport country identities; current payload carries only scalar counts. Add sorted pressed countryCodes from the already owner-scoped passportRead result, without another query or a new service, and update required constructors/fixture generators. No country novelty is inferred from counts.
