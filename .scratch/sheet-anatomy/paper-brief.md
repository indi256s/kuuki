# Paper brief: "Sheet anatomy"

You are drawing static design boards in Paper (the design tool, via its MCP tools). This is a drawing task only: do not edit app code, commit, deploy or start servers. The design rationale is in `/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/design.md`; this brief has everything you need to draw.

## 0. Procedure (follow in order)
1. Call `get_guide({ topic: "paper-mcp-instructions" })` first and follow it.
2. `list_resources` / `get_basic_info` to find the file. Use the Paper file **"Kuuki — Auth redesign"** if it exists (it holds the earlier Kuuki boards). Create a **new page** named **"Sheet anatomy"** with `create_page`, and draw everything on that page by passing its `pageId`. Never draw on or modify other pages. If no suitable file exists, use `create_file` and name the page "Sheet anatomy".
3. Call `get_font_family_info` for **Commissioner** and **JetBrains Mono** before styling any text. If Commissioner is unavailable, use the closest available geometric sans and say so in your report. Do not silently substitute.
4. Draw with `write_html`, **one visual group per call** (e.g. the sheet chrome, then the figure stage, then the hero, then the chart, then the details). Build one complete sheet first (Clock), screenshot it, fix it, then reuse it: `duplicate_nodes` the finished Clock artboard for the other sheets and change contents with `set_text_content` / `update_styles` / `write_html` into the stage containers.
5. After each artboard, call `get_screenshot` and check: nothing clipped, text on one line where specified, stage boxes at the exact y positions, no divider lines.
6. When done, call `finish_working_on_nodes`. In your final report, list the artboards you made and any deviation from this brief.

## 1. Hard rules
- **No divider lines** anywhere inside the sheet: none between rows, under the header, above the footer, between stages, or as gridlines or axis rules in charts. Group with space only. Allowed: the 2px pager segments, the 4px drag grip, control outlines (segmented control, chip), and annotation guides **outside** the phone frames.
- No glass, blur, gradients, shadows on dark, or glow on UI. Glow appears only inside the pasted figure SVGs.
- Text never fades by opacity. Only chart marks and figure layers may use opacity, and only where this brief says so.
- Use tabular figures (`font-variant-numeric: tabular-nums`) for numbers.
- **Figures are pasted SVG markup, not redrawn.** Read each file with your file tool and paste the full `<svg …>…</svg>` markup inside the figure box. Keep its `width`/`height` attributes as given (do not rescale).
- Annotation ink, used only outside phone frames or as clearly separate overlay labels: `#4c9deb`, JetBrains Mono 11/14. Annotation lines are 1px dashed `#4c9deb`.

## 2. Tokens

| Token | Dark | Light |
|---|---|---|
| page `--background` | `#292827` | `#fbfaf8` |
| `--surface` | `#353331` | `#ffffff` |
| sheet fill `--surface-floating` | `#3c3a37` | `#ffffff` |
| `--surface-inset` | `#403d3a` | `#f2f0ed` |
| `--text` | `#f1efeb` | `#302d2a` |
| `--text-muted` | `#c4beb7` | `#66605b` |
| `--accent` | `#ea846f` | `#c23417` |
| `--accent-foreground` | `#292827` | `#ffffff` |
| `--control-border` | `#958b82` | `#837b74` |
| `--mark-ghost` (ordinary chart marks) | `#897e70` | `#978c7f` |
| scrim over page | `rgba(0,0,0,.6)` | `rgba(0,0,0,.4)` |
| sheet edge | inner ring `0 0 0 1px rgba(255,255,255,.08)` | shadow `0 -8px 24px rgba(0,0,0,.10)` |
| maker selected / muted / Other / Unknown | `#ea846f` / `#897e70` / `#c9c1b7` / `#47433f` | `#c23417` / `#817970` / `#c2bab0` / `#ece9e5` |

Type: Commissioner for UI and JetBrains Mono for codes, times and axis labels.

| Style | Spec |
|---|---|
| Sheet title H2 | Commissioner 22/28, 600, −0.01em |
| Position "4 of 7" | 13/20, 400, muted |
| Hero value | 40/44, 600, −0.03em, tabular |
| Hero unit | 22/28, 500, muted, 4px left gap, same baseline |
| Hero caption | 15/24, 400, muted, max 2 lines |
| Chart caption | 13/18, 600, muted |
| Chart labels / axis | JetBrains Mono 12/16, muted; a value on the reading mark is Commissioner 13/18 600 `--text` |
| Row label | 15/20, 400, `--text`; route codes in JetBrains Mono 14/20 |
| Details heading | 15/24, 600, `--text` |
| Details body | 13/20, muted |
| Segmented control | 32 tall, radius 10, 1px `--control-border` outline, options 13/18 500; the selected option has a `--surface-inset` thumb (radius 8, inset 2px) and `--text`; the others are muted |
| Chip | 36 tall (32 for the hero "Only" chip), radius 10, `--surface-inset` fill, 13/18 500 `--text`, 12px horizontal padding, 16px Lucide icon |

Spacing is on a 4px base. Sheet inline padding is 24.

## 3. The phone frame (390 × 844) and exact bands
Each sheet artboard is 390×844, with layout coordinates absolute from the artboard's top-left.

| Band | y from | y to | Content |
|---|---|---|---|
| Status bar + scrim | 0 | 47 | Page `--background` with the scrim over it; "9:41" 15/20 600 `--text` at x 32, y 14; small battery/signal glyphs at the right are optional. |
| Sheet | 47 | 844 | Fill `--surface-floating`, top corners radius 20, sheet edge per tokens. |
| Handle | 47 | 75 | Grip 40×4, radius 2, `--control-border`, centred at y 59. |
| Header | 75 | 127 | Inline padding 24. Title "Clock" + 12px gap + "4 of 7", vertically centred. Right side: options button 44×44 (Lucide `more-horizontal` 18px, muted) then close 44×44 (Lucide `x` 20px, `--text`), with the last ending at x 382. |
| Pager | 127 | 149 | At y 127: 7 segments of 2px tall across x 24–366, 4px gaps (each segment (342 − 24)/7 = 45.43 wide); `--control-border`; the active segment (index from the position) is `--accent`. |
| Filter row | 149 | 193 | Chip at x 24, y 153, 36 tall: Lucide `sliders-horizontal` 16 + "All flights". |
| Figure stage | 201 | 377 | Box 300×160 centred (x 45–345). The SVG is bottom-aligned so its lowest point is at y 369 and centred horizontally. No fill and no outline (on the template only, a dashed annotation outline). |
| Hero | 377 | 473 | Inline padding 24. Value line top y 381 (44 tall). Caption from y 429, 2 lines (48). "Only" chip slot: right-aligned at x 366, vertically centred on the value line, shown only where specified. |
| Chart stage | 489 | 705 | Header row y 489–521: caption left at x 24, segmented control right-aligned to x 366 (when the section has one). Plot y 529–681 (152). Axis y 681–705. Plot inline area x 24–366 (342 wide). |
| Details | 729 | — | First details heading at y 729 (peeking 25px above the footer). |
| Footer | 754 | 844 | Fill `--surface-floating` over the content (clips the details). Previous button at x 12, Next at right ending x 378, each 44 tall at y 760, padding 12, Lucide chevron 18 + label 15/20 500; muted if disabled. The home indicator is a 134×5 `--text` bar, radius 3, centred at y 830. |

Build the slide content (figure stage → details) inside a container clipped at y 201–754, so the storyboard can offset it horizontally.

## 4. Figure files (paste the markup)
Directory: `/Users/indi256/Documents/kuuki/kuuki/.scratch/sheet-anatomy/figures/`

| Sheet | Dark file | Light file | Size |
|---|---|---|---|
| Clock (rest) | `clock-0020-dark.svg` | `clock-0020-light.svg` | 206×160 |
| Clock (tapped 21) | `clock-2100-dark.svg` | — | 206×160 |
| Rhythm | `cal-march-dark.svg` | — | 190×160 |
| Rankings | `rankings-final.svg` | — | 300×160 |
| Routes | `pass-dark.svg` | — | 236×160 |
| Crossings | `crossings-final.svg` | — | 300×160 |
| Records | `map-doh-nrt-dark.svg` | — | 249×160 |
| Makers | `makers-final.svg` | — | 300×160 |

All are 160 tall, so each sits in the stage at y 209–369, centred horizontally: x = 195 − width/2.

## 5. Chart drawing rules
- Ordinary marks are `--mark-ghost`; the **reading** mark is `--accent`. There is exactly one reading per chart, except Crossings, where all 7 reached columns are accent (stated below).
- Vertical bars: bar max height 128 (leaving 24 at the top of the plot for the value label), bottoms on y 681, corner radius 2 on top. Value label only on the reading bar and the tallest bar.
- Horizontal rows (rank lists): 5 rows, each 24 tall with 8 gaps, starting y 533. Columns: rank (mono 13/18 muted, x 24, width 20) · label (x 48, 15/20, single line, ellipsis) · bar (from x 196 to max x 330, height 8, radius 4, vertically centred) · count (right-aligned at x 366, 13/18 600 tabular). For the reading row the label is 600 `--text`, the bar `--accent` and the count `--text`; for the others, label 400 `--text`, bar `--mark-ghost`, count muted.
- No axis lines and no gridlines.

## 6. Artboards and placement on the page

Row 1 at y = 0. Row 2 at y = 1100. Leave 60px between artboards.

| # | Artboard name | Size | Position (x, y) |
|---|---|---|---|
| 00 | `00 Template — anatomy` | 860 × 900 | 0, 0 |
| 01 | `01 Clock — dark` | 390 × 844 | 920, 0 |
| 01b | `01b Clock — tapped 21:00` | 390 × 844 | 1370, 0 |
| 02 | `02 Rhythm — dark` | 390 × 844 | 1820, 0 |
| 03 | `03 Rankings — dark` | 390 × 844 | 2270, 0 |
| 04 | `04 Routes — dark` | 390 × 844 | 2720, 0 |
| 05 | `05 Crossings — dark` | 390 × 844 | 3170, 0 |
| 06 | `06 Records — dark` | 390 × 844 | 3620, 0 |
| 07 | `07 Makers — dark` | 390 × 844 | 4070, 0 |
| 08 | `08 Swipe storyboard — Clock → Crossings` | 1760 × 1000 | 0, 1100 |
| 09 | `09 Clock — light` | 390 × 844 | 1820, 1100 |
| 10 | `10 Desktop — chapter panel` | 1440 × 900 | 2270, 1100 |

Section order used in the drawings (positions): Rankings 1, Routes 2, Records 3, **Clock 4, Crossings 5**, Rhythm 6, Aircraft 7. Footer neighbours follow this order. Rankings has Previous disabled, and Aircraft has Next disabled.

## 7. Per-artboard content

### 00 Template — anatomy (860 × 900, fill `#292827`)
- At (24, 28), draw a 390×844 dark phone with all bands from §3, with generic placeholder content. Figure stage: a dashed 1px `#4c9deb` outline of the 300×160 figure box, the text "FIGURE · live part glows · aria-hidden" centred in muted 13/18, and a 1px dashed floor line across the stage at y 369. Hero: value "Value" with unit "unit", caption "What it is · evidence · one more fact" (two lines). Chart: caption "Chart caption", segmented control "View A | View B", 12 ghost bars with bar 4 accent, axis labels. Details: heading "Details" and two lines of muted text.
- To the right (x 440–836), add annotations, each a mono 11/14 `#4c9deb` label aligned to its band, joined to the band's edge by a 1px dashed horizontal guide, with a vertical bracket showing height:
  - `HANDLE 28 · drag-to-dismiss only here`
  - `HEADER 52 · title + position · text shifts 24px on swipe`
  - `PAGER 22 · indicator follows the finger 1:1`
  - `FILTER ROW 44 · always present · scope chip · chrome, does not move`
  - `FIGURE STAGE 176 · box 300×160 · floor y 369 · parallax 0.8× + fade`
  - `HERO 96 · value 40/44 · caption reserves 2 lines · moves 1:1`
  - `CHART STAGE 216 · header 32 · plot 152 · axis 24 · moves 1:1`
  - `DETAILS · scrolls · narrator at the foot`
  - `FOOTER 56 + safe area 34 · Previous / Next`
- At the bottom right (x 440, y 760, width 396), a text block in `--text` 13/20 titled **"One reading, three places"** (600), then muted: "The figure's live part, the hero and one accent chart mark always show the same datum. Tap any of them and the other two follow. At rest it is the headline."

### 01 Clock — dark (rest)
- Header "Clock" · "4 of 7"; pager segment 4 active. Filter chip "All flights".
- Figure: `clock-0020-dark.svg`.
- Hero: value `00:20`, no unit. Caption: "Earliest departure · ICN → DOH · busiest hour 21:00" (route in mono).
- Chart header: caption "Local departure time"; segmented "Departures | Arrivals" with Departures selected.
- Plot: first a night band rect from hour 22 to the end and from 00 to hour 06 (`--surface-inset`, full plot height, radius 4), with "night" mono 12/16 muted at the top-left of the 22–24 band. Then 24 bars, 9 wide with 4 gaps, starting x 41 (centred in 342). Counts, 00→23: `1,0,0,0,1,3,5,4,3,2,3,2,2,3,2,3,2,3,4,4,5,7,4,2` (max 7 → 128px). Bar 00 is the **reading** (accent) with label "00:20" above it. Bar 21 (tallest) is ghost with label "21" above. Zero bars are a 2px ghost stub.
- Axis labels (mono 12/16 muted) under hours 00, 06, 12, 18, 23.
- Details: heading "When you leave" at y 729 (the rest is clipped by the footer).
- Footer: "‹ Records" | "Crossings ›".

### 01b Clock — tapped 21:00
Same as 01 except:
- Figure: `clock-2100-dark.svg`.
- Hero: value `21:00`; caption "Busiest hour · 7 flights · late enough to count as a lifestyle". "Only" chip on the right of the value line: "Only 21:00" (32 tall, Lucide `filter` 14).
- Chart: bar 21 is the **reading** (accent, label "21:00"); bar 00 goes back to ghost.
- Add a small annotation overlay (mono 11/14 `#4c9deb`) to the right of the chart caption, below the control: "tap 21 → clock + hero follow", with a 1px dashed `#4c9deb` arrow from bar 21 up to the figure.

### 02 Rhythm — dark
- "Rhythm" · "6 of 7"; pager 6. Figure `cal-march-dark.svg`.
- Hero: `March`; caption "Busiest month · longest gap 13 months, which the passport took personally".
- Chart: caption "Flights by month · all years"; segmented "Calendar | Over time" with Calendar selected. 12 bars, 20 wide with 8 gaps (12·20 + 11·8 = 328, start x 31). Counts J→D: `6,2,11,6,3,2,5,0,5,6,4,7` (max 11 → 128). March is the reading (accent, label "11"). Axis: single letters J F M A M J J A S O N D under each bar, mono 12/16.
- Details heading "Every month, every year".
- Footer "‹ Crossings" | "Aircraft ›".

### 03 Rankings — dark
- "Rankings" · "1 of 7"; pager 1. Figure `rankings-final.svg`.
- Hero: `Pegasus`; caption "Top airline · 4 flights, tied with Qatar Airways, who dispute the order".
- Chart: caption "Top airlines · flights"; segmented "Airlines | Airports | Routes" with Airlines selected. Rows: 1 Pegasus 4 (**reading**), 2 Qatar Airways 4, 3 3F 3, 4 Aeroflot 2, 5 Turkish Airlines 1. Bar length = count/4 × 134. Axis band: empty.
- Details heading "Airports and routes".
- Footer "‹ Previous" (disabled, muted at 40% via the button, not the text colour) | "Routes ›".

### 04 Routes — dark
- "Routes" · "2 of 7"; pager 2. Figure `pass-dark.svg`.
- Hero: value `32`, unit "routes"; caption "74% repeats · ROV ↔ VKO ×9. Commuter, with extra steps" (codes mono).
- Chart: caption "Most-flown routes"; no control. Rows (labels mono 14/20): 1 ROV ↔ VKO 9 (**reading**), 2 DOH ↔ ICN 4, 3 DOH ↔ NRT 3, 4 ROV ↔ IST 2, 5 VKO ↔ TBS 2. Bar = count/9 × 134.
- Details heading "Commuter or explorer".
- Footer "‹ Rankings" | "Records ›".

### 05 Crossings — dark
- "Crossings" · "5 of 7"; pager 5. Figure `crossings-final.svg`. This contextual sleep metaphor stays static when an offset is selected; chart and hero carry the numerical reading. No glow, lost-sleep measure or medication encoding.
- Hero: value `82`, unit "h"; caption "Clocks shifted · 39 forward, 43 back · 7 of 24 hourly offsets".
- Chart: caption "UTC offsets reached"; no control.
  - Split bar at plot top (y 533): 6 tall, radius 3, across x 24–366, forward part (39/82 of the width) `--accent`, back part `--mark-ghost`, with a 2px gap between. Labels under it at y 543 (mono 12/16 muted): "+39 h forward" left, "−43 h back" right.
  - Strip: 24 columns, 13 wide with 1 gap (24·13 + 23·1 = 335, start x 27), bottoms at y 681, max height 96. Offsets −11 … +12. Reached offsets and counts: +0:2, +1:3, +2:4, +3:12, +4:6, +5:2, +9:5 (max 12 → 96). Reached columns are all `--accent` (the set reading). Unreached columns are a 4px `--mark-ghost` stub.
  - Axis labels (mono 12/16 muted) under −11, −6, 0, +6, +12.
- Details heading "Equator and Arctic Circle".
- Footer "‹ Clock" | "Rhythm ›".

### 06 Records — dark
- "Records" · "3 of 7"; pager 3. Figure `map-doh-nrt-dark.svg`.
- Hero: value `8,298`, unit "km"; caption "Longest flight · DOH → NRT. Long enough to rewatch the safety video for fun".
- Chart: caption "Longest flights · km"; no control. Rows (mono route labels): 1 DOH → NRT 8,298 (**reading**), 2 ICN → DOH 6,900, 3 DOH → IST 3,700, 4 VKO → DOH 3,600, 5 ROV → IST 1,100. Bar = km/8298 × 134. Counts are formatted with thousands separators.
- Details heading "The record cabinet".
- Footer "‹ Routes" | "Clock ›".

### 07 Makers — dark
- "Aircraft" · "7 of 7"; pager 7. Figure `makers-final.svg`.
- Hero: value `59%`; caption "Airbus · Boeing 31% · based on 96 of 100 flights with an aircraft".
- Chart: caption "Share of flights"; segmented "Makers | Fleet" with Makers selected. 4 rows (same row grid as §5, but with a 12×12 maker square (radius 2.4) at x 24 instead of the rank): Airbus 59% (**reading**: label 600, bar in coral at 100%), Boeing 31% (bar muted at45% opacity), Other 10% (Other colour at 45%), Unknown 4 flights (Unknown colour at 45%; count text "4 flights" muted). Bar = share/59 × 134. Final selection uses coral for the selected maker swatch and bar; others remain muted.
- Details heading "Flights, distance or time".
- Footer "‹ Rhythm" | "Next ›" (disabled).

### 08 Swipe storyboard — Clock → Crossings (1760 × 1000, fill `#292827`)
Four phone frames 390×844 at x = 24, 458, 892, 1326, all at y = 56, built from the 01 Clock and 05 Crossings content. Under each, at y910, a caption: title18/24 600 `#f1efeb` and two lines14/20 `#c4beb7`.

Each frame's slide area (y 201–754) is a clipped viewport. Inside it, the Clock slide content and the Crossings slide content are placed side by side, 390 apart. The figure in each slide gets an additional offset and opacity from the parallax rule: figure x shift = −0.2 × (slide's x offset); opacity = 1 − 0.75 × |p|; scale remains 1 (the final storyboard has no scaling), where p = slide offset / 390.

| Frame | Clock slide x | Crossings slide x | Clock figure (centre x, opacity, scale) | Crossings figure (centre x, opacity, scale) | Header | Pager indicator | Footer labels |
|---|---|---|---|---|---|---|---|
| S1 Rest | 0 | 390 (off) | 195, 1, 1 | — | "Clock · 4 of 7" | segment 4 | "‹ Records" / "Crossings ›" |
| S2 40% drag | −156 | 234 | 70, 0.70, 1 | 382, 0.55, 1 | "Clock · 4 of 7" remains anchored during the drag | between 4 and 5: x offset 0.4 × 49.43 = 20px right of segment 4 | unchanged |
| S3 60%, release beyond threshold | −234 | 156 | 8, 0.55, 1 | 320, 0.70, 1 | "Crossings · 5 of 7" after committed release | 0.6 → 30px right of segment 4 | "‹ Clock" / "Rhythm ›" |
| S4 Settled | −390 (off) | 0 | — | 195, 1, 1 | "Crossings · 5 of 7" | segment 5 | "‹ Clock" / "Rhythm ›" |

- Figures that fall partly outside the 390 viewport are clipped by it.
- Finger marker on S2 and S3: a 44px circle filled `rgba(241,239,235,.14)` with a 1px `rgba(241,239,235,.4)` ring, centred at (300 − drag, 600), so x 144 in S2 and 66 in S3. A dashed `#4c9deb` arrow points left from x 300 to the circle.
- S1 marker: the circle at (300, 600) with the note "touch-down".
- S4: a small `#4c9deb` annotation near the mask: "settled · sleep metaphor stays still".
- Captions:
  - S1 "Rest": "Clock is open. Stages: figure 176 · hero 96 · chart 216."
  - S2 "40% drag": "Hero, chart and details glued to the finger (1:1). Figure lags at 0.8× and fades: depth, not decoration."
  - S3 "Past half": "Release commits at 25% distance or 0.45px/ms after16px. Title and labels switch after release."
  - S4 "Settled": "Critically damped settle ≈330ms. A new drag captures the current pose. Reduced motion snaps immediately."
- Across the top of the board (y 0–20, mono 11/14 `#4c9deb`): "RATIOS · chrome 0 · title/labels switch on committed release · hero/chart/details 1.0 · figure 0.8 + fade · pager 1.0".

### 09 Clock — light
The 01 content in light tokens: sheet `#ffffff`, page `#fbfaf8` under a 40% scrim, `--surface-inset` `#f2f0ed`, mark ghost `#978c7f`, accent `#c23417`, figure `clock-0020-light.svg`. Same layout and copy as 01.

### 10 Desktop — chapter panel (1440 × 900)
- Background: page `#292827` with a dimmed hint of the bento (two columns of `#353331` cards, radius 14, at x 24–776, no content needed beyond a title line each), under scrim `rgba(0,0,0,.6)`.
- Panel: x 800–1440, full height, fill `#3c3a37`, left corners radius 20, inner ring.
  - Header y 0–64, padding 24: chevron buttons ‹ › (44×44 each) at the left, then "Clock" 22/28 600 + "4 of 7" muted, then options + close at the right.
  - Pager y 64–86 (segments across x 824–1416). Filter row y 86–130 (chip "All flights").
  - Row A, y 138–346 (208 tall): figure stage at x 824–1124 (300 wide) with `clock-0020-dark.svg` bottom-aligned at y 330; hero at x 1148–1416: value `00:20` at 48/52 600, caption 15/24 muted up to 3 lines: "Earliest departure · ICN → DOH · busiest hour 21:00".
  - Row B, y 362–626 (264 tall): chart header 32 (caption "Local departure time" + segmented "Departures | Arrivals"), plot 200 (24 bars spread across 592: 18 wide with 7 gaps, same counts, max 168), axis 24.
  - Details from y 650: heading "When you leave" and two muted lines ("41% departures before noon", "9 red-eyes · 22:00–06:00").
  - Keyboard hint at the panel bottom (y 860, muted 13/20): "← → to change chapter · trackpad swipe · drag".
- An annotation at the top left of the board (outside the panel, `#4c9deb` mono 11/14): "PROPOSED · right panel 640 · figure beside hero · chart full width".

Current motion specification supersedes native-snap/arrival-beat instructions above: design.md §4–5 defines transform-only updates, pointer ownership, commit/settle/interruption, edge resistance and reduced motion. No implementation has been changed. Aircraft alternatives are separate review studies; do not imply example types are recorded personal flights.

## Final drawing review decisions

Routes is explicitly user-approved and preserved. Sol wingtip, blueprint, blueprint+detail, standalone mask and pedestal aircraft studies were rejected and removed from active page. Main Rankings/Crossings/Makers now use refined Gemini figures, corrected for readable plaque labels and factual maker share. Maker printing contains no serial, factory, type, delivery or certification assertions. The selected maker bar/swatch use coral, matching the figure badge. All three figures are native300×160 in the fixed176px stage. Canonical sources: figures/rankings-final.svg, crossings-final.svg, makers-final.svg. Crossings is a contextual sleep metaphor; UTC selections affect hero/chart only. Quiet idle and gesture physics remain drawing proposals, never claimed tested.
