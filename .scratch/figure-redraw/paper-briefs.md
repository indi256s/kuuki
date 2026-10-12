# Paper worker briefs — Overview chapter sheets (2026-10-12)

File `01M48F4SHK61AZS2FH5P5JPRY7`, page `p-3-0` "Sheet anatomy". Every brief is mechanical: exact nodes, text and styles. Do not redesign, add elements, or change anything not listed.

## Common rules (every worker)

- Load Paper tools with ToolSearch (`select:mcp__paper__get_guide,mcp__paper__get_basic_info,mcp__paper__get_tree_summary,mcp__paper__get_children,mcp__paper__get_node_info,mcp__paper__get_computed_styles,mcp__paper__get_jsx,mcp__paper__get_screenshot,mcp__paper__write_html,mcp__paper__update_styles,mcp__paper__set_text_content,mcp__paper__duplicate_nodes,mcp__paper__delete_nodes,mcp__paper__move_nodes,mcp__paper__rename_nodes,mcp__paper__find_nodes,mcp__paper__create_artboard,mcp__paper__finish_working_on_nodes,mcp__paper__get_font_family_info`), then call `get_guide({topic:"paper-mcp-instructions"})` once and `get_font_family_info(["Commissioner","Paper Mono"])` before styling text.
- Always pass `fileId`. Touch only the artboards your brief names.
- Fonts: UI text `'Commissioner', system-ui, sans-serif`; mono (codes, times, axis ticks, timings) `'Paper Mono', 'Commissioner', ui-monospace, monospace`.
- Colour tokens (dark): ink `var(--color-journal-dark-ink)` #F1EFEB · muted `var(--color-journal-dark-muted)` #C4BEB7 · accent `var(--color-journal-dark-shu)` #EA846F · control `var(--color-journal-dark-control)` #958B82 · outline `var(--color-journal-dark-outline)` #554F4A · inset `var(--color-journal-dark-inset)` #403D3A · bar `var(--color-journal-dark-mark-ghost)` #897E70 · stub `var(--color-journal-dark-mark-rest)` #6B645E · paper #292827 · surface #3C3A37.
- No divider lines between rows. No emoji. Images: `<img src="paper-asset:///ABS/PATH.svg">`.
- Figure SVGs live in `/Users/indi256/Documents/kuuki/kuuki/.scratch/figure-redraw/out/`.
- Write small: one visual group per `write_html` call.
- Verify: one `get_screenshot` per artboard you changed at the end (scale 1), fix what it shows (clipped or overlapping text, wrong order), screenshot once more at most. Then `finish_working_on_nodes` with your artboard IDs.
- Report: per artboard, what changed, any step you could not do and why, and the final screenshot verdict. Stop after that. Do not start the next brief.

## W1 — Rhythm sheet, Continents labels, fonts

### W1.1 Rhythm sheet

Superseded: the first copy was removed from the canvas. Rhythm is now W6, built after the Arc pass.

### W1.2 Continents in Clock footers

In `MUQ-0`, `MZ4-0` and `ODN-0`, find the text `Crossings` (`find_nodes` with `nodeId` = the artboard, `textValue: "Crossings"`) and set it to `Continents`. Do not touch `P0G-0`.

### W1.3 Fonts across the page

1. `find_nodes` with `pageId: "p-3-0"`, filter `font-family` = `*JetBrains*`. Set `fontFamily: "'Paper Mono', 'Commissioner', ui-monospace, monospace"` on all of them (batch update).
2. `find_nodes` with `pageId: "p-3-0"`, filter `font-family` = `*Onest*`. Set `fontFamily: "'Commissioner', system-ui, sans-serif"` on all of them.
3. Screenshot `OIQ-0`, `MUQ-0`, `NJT-0`, `NYJ-0`, `OV5-0`, `S99-0` and report any text that now overflows or overlaps (do not fix layout beyond widening a clipped text box to `width: max-content`).

Artboards for `finish_working_on_nodes`: `SFO-0, MUQ-0, MZ4-0, ODN-0, OIQ-0, NJT-0, NYJ-0, OV5-0, P0G-0, S5X-0, S7Q-0, S99-0, SD4-0, O6L-0`.

## Arc snippets (real components, values from `ui/ui.css` and `app/styles.css`)

**SNIPPET-SEG-DARK** — `SegmentedControl` (`ui/segmented-control.tsx`), 2 options, 256×50, left-aligned like the built Clock section:

```html
<div layer-name="Segmented control" style="width:256px;height:50px;flex-shrink:0;padding:3px;border-radius:14px;background-color:var(--color-journal-dark-inset);display:flex;gap:2px;">
  <div layer-name="Segment · selected" style="flex:1;height:44px;border-radius:10px;background-color:var(--color-journal-dark-surface);box-shadow:0 0 0 1px var(--color-journal-dark-outline);display:flex;align-items:center;justify-content:center;"><div style="font-family:'Commissioner',system-ui,sans-serif;font-size:15px;line-height:20px;font-weight:500;color:var(--color-journal-dark-ink);white-space:nowrap;">LABEL_A</div></div>
  <div layer-name="Segment" style="flex:1;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;"><div style="font-family:'Commissioner',system-ui,sans-serif;font-size:15px;line-height:20px;font-weight:500;color:var(--color-journal-dark-muted);white-space:nowrap;">LABEL_B</div></div>
</div>
```

**SNIPPET-SEG-LIGHT** — the same with light tokens: track `var(--color-journal-inset)`, thumb `var(--color-journal-surface)` with `box-shadow:0 0 0 1px var(--color-journal-outline)`, selected label `var(--color-journal-ink)`, other label `var(--color-journal-muted)`.

**Chart header with a toggle** (replaces the 32px caption + pill row): the header frame is 342×50 at left 24, top 0, a flex row with `justify-content: space-between; align-items: center`; first child the segmented control, second child the caption text (13px/18px 600, muted, `text-align: right`, short label from the table). The plot below starts at top 58 and is 134 tall; the axis stays at top 192.

## W2 — Arc fidelity pass on the drawn sheets

Apply the real component styles. Artboards: `MUQ-0` Clock dark, `MZ4-0` Clock tapped, `ODN-0` Clock **light** (use light tokens), `NJT-0` Routes, `NYJ-0` Records, `SD4-0` Continents, `O6L-0` Aircraft. (`OV5-0` desktop belongs to the desktop adaptation, not this pass.) Find nodes by layer name inside each artboard (`get_tree_summary` depth 4).

1. **Sheet surface** (layer `Sheet`): `backgroundColor` dark `var(--color-journal-dark-floating)` (#3C3A37), light `#FFFFFF`; `borderTopLeftRadius`/`borderTopRightRadius` 20px, bottom radii 0; `boxShadow: 0 0 0 1px rgb(255 255 255 / 8%)` (dark only).
2. **Footer buttons** (`Previous label`, `Next label`): `fontWeight: 600`, 15px/20px, ink. Chevron SVGs stay 18px. Aircraft `O6L-0` has no next chapter: set its `Next` frame `opacity: 0.4` and its label colour muted.
3. **Close button** icon: 16×16 X, stroke 1.75, ink, centred in the 44×44 frame (replace the SVG child with `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-journal-dark-ink)" stroke-width="1.75" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`; light uses `var(--color-journal-ink)`. Paper renders `currentColor` as black, so never use it).
4. **Filter chip** (`Filter chip`, the anatomy's proposed scope chip drawn as the real `Chip`): `height: 32px; padding: 4px 12px; gap: 8px; border: 1px solid var(--color-journal-dark-control); border-radius: 10px; background: var(--color-journal-dark-floating); box-shadow: 0 0 0 1px rgb(255 255 255 / 8%)`; its text 13px/20px weight 400 ink; keep the 16px icon; `top: 155px` so it stays centred in the 149–193 row. Light: border `var(--color-journal-control)`, background `#FFFFFF`, no ring.
5. **Chart headers with a toggle** — in `MUQ-0`, `MZ4-0`, `ODN-0`, `SD4-0`, `O6L-0`: rebuild the `Chart header` as described in "Chart header with a toggle" (replace the old `Segmented control` node with SNIPPET-SEG-DARK/LIGHT, move the caption after it, set the caption text):

   | Artboard | LABEL_A (selected) | LABEL_B | caption |
   |---|---|---|---|
   | `MUQ-0`, `MZ4-0`, `ODN-0` | Departures | Arrivals | Local time |
   | `SD4-0` | Flights | Firsts | Per airport |
   | `O6L-0` | Makers | Fleet | % of flights |

6. **Plots under those headers**:
   - Clock (`MUQ-0`, `MZ4-0`, `ODN-0`): `Plot` → `top: 58px; height: 134px`; both night bands → `height: 134px`; every bar in `Histogram marks` → `height = round(old × 0.875)` (keep 2px stubs at 2px); `Tallest label` top stays; `Reading label` → `top = 134 − (its bar's new height) − 22`.
   - Continents `SD4-0`: rows `Continent Europe … Continent Antarctica` → `top: 62, 84, 106, 128, 150, 172, 194` and `height: 22px`.
   - Aircraft `O6L-0`: rows `Maker Airbus, Maker Boeing, Maker Other, Maker Unknown` → `top: 62, 94, 126, 158`.

Verify: one screenshot per artboard. Check the control sits inside the chart stage without touching the plot, the caption fits on one line at the right, and bars do not cross their labels.

Artboards for `finish_working_on_nodes`: all seven above.

## W3 — Swipe storyboard `P0G-0`: Clock → Continents

The four phone frames are `P0H-0` Rest, `P4K-0` 40% drag, `P8N-0` Past half, `PCQ-0` Settled. Each has a clipped viewport holding the outgoing Clock slide and an incoming slide. Replace each incoming slide with a clone of the Continents slide content `SDF-0` (from artboard `SD4-0`), keeping the parallax numbers below.

1. For each row: `write_html` mode `replace` on the old incoming node with `<x-paper-clone node-id="SDF-0" layer-name="Incoming Continents content" style="position:absolute;left:LEFTpx;top:0px;width:390px;height:553px;overflow:visible;" />`. Then `get_children` of the new node, find the child named `Figure · jigsaw tray`, and `update_styles` its `left` and `opacity`.

   | Frame | old incoming node | LEFT | figure left | figure opacity |
   |---|---|---|---|---|
   | Rest | `PJE-0` | 390 | -33px | 0.25 |
   | 40% drag | `PNB-0` | 234 | -1.8px | 0.55 |
   | Past half | `PR8-0` | 156 | 13.8px | 0.7 |
   | Settled | `PV5-0` | 0 | 45px | 1 |

1b. The outgoing Clock slides predate the Arc pass. Replace each outgoing `Slide content` node the same way with `<x-paper-clone node-id="MW2-0" layer-name="Slide content" style="position:absolute;left:LEFTpx;top:0px;width:390px;height:553px;overflow:visible;" />` (the updated Clock slide from `MUQ-0`), then set its child `Figure` `left`/`opacity`:

   | Frame | old outgoing node | LEFT | figure left | figure opacity |
   |---|---|---|---|---|
   | Rest | `PGU-0` | 0 | 92px | 1 |
   | 40% drag | `PKR-0` | -156 | 123.2px | 0.7 |
   | Past half | `POO-0` | -234 | 138.8px | 0.55 |
   | Settled | `PSL-0` | -390 | 170px | 0.25 |

   Keep each frame's `Gesture annotation` above the slides (move it to the last child of its phone frame if a clone covers it).
2. Text inside `P0G-0`: `find_nodes` (`nodeId: "P0G-0"`, `textValue: "*Crossings*"`). Set every text that is exactly `Crossings` to `Continents`, and `Clock → Crossings` to `Clock → Continents`.
3. `QNE-0` → `Saved chapter order · all frames 390×844 · built pager: native scroll-snap`.
4. Captions (keep each caption's two lines; set exactly):
   - `QNI-0` → `The browser owns the swipe: native scroll-snap (built)` + newline + `with its own tracking, momentum, axis lock and bounce.`
   - `QNL-0` → `02 · Drag 40%`
   - `QNM-0` → `Hero, chart and details move 1:1. The figure lags 0.8×` + newline + `and fades, driven by its slide's view timeline (CSS).`
   - `QNP-0` → `03 · Past halfway`
   - `QNQ-0` → `Title and footer labels switch at halfway and slide 24px.` + newline + `Android ticks once when the release will change chapter.`
   - `QNU-0` → `snap-stop: one chapter per flick. Settling opens Continents` + newline + `on its headline. Reduced motion: no parallax or fade.`
5. Rename `P0G-0` → `08 Swipe — Clock to Continents`.
6. Screenshot `P0G-0` once. Check: incoming jigsaw tray visible at the four offsets, no "Crossings" left, captions on two lines without clipping. If a caption clips, set that text node's width to 400px.

Artboards for `finish_working_on_nodes`: `P0G-0`.

## W5 — Template notes and the remaining idea board

The owner is arranging the canvas: do not move any artboard. Boards 13 and 14 were removed by the owner; skip them.

1. Template `OIQ-0`: `find_nodes` (`nodeId: "OIQ-0"`, `textValue: "*sleep imagery*"`) and replace that line's text so it reads `Continents lifts the picked piece; empty sockets still answer.` (keep the other lines of that text node unchanged). Set `OP8-0` → `FIGURE STAGE 176 · box 300×160` + newline + `Floor y369 · 0.8× parallax + fade (view timeline)`.
2. Board `S5X-0`: `S5Z-0` → `Rhythm · chosen`; `S60-0` → `Date stamper, picked from round 2. Drawn into the Rhythm sheet; its motion is on board 15.` Set `S5X-0` width `688px`.
3. Screenshot `S5X-0` and `OIQ-0` once. If content clips at the new width, set the artboard width to fit instead.

Artboards for `finish_working_on_nodes`: `OIQ-0, S5X-0`.

## W4 — Motion board "15 Motion — swipes and picks" (new artboard)

Create with `create_artboard` on page `p-3-0`: name `15 Motion — swipes and picks`, styles `{width:"1760px", height:"1600px", backgroundColor:"#292827", display:"flex", flexDirection:"column", gap:"56px", paddingTop:"64px", paddingBottom:"72px", paddingLeft:"64px", paddingRight:"64px"}` (let Paper place it). At the end set `height: "fit-content"`.

Type styles (use exactly):
- **H1**: Commissioner 40px/44px 600, letter-spacing -0.02em, ink.
- **Lede**: Commissioner 17px/26px 400, muted, max-width 820px.
- **H2**: Commissioner 22px/28px 600, ink.
- **Name**: Commissioner 17px/24px 600, ink. **Trigger**: Commissioner 13px/18px 400, muted. **Total**: mono 12px/16px 400, muted.
- **Cell label**: mono 12px/16px 400, muted (the time) — text like `0 ms · rest`.
- **Lane label**: mono 11px/14px 500, inside the lane bar, 8px left padding, single line.
- **Rule label**: Commissioner 13px/18px 600, muted, fixed width 140px, flex-shrink 0. **Rule text**: Commissioner 15px/22px 400, ink.
- **Note**: Commissioner 13px/18px 400, muted, max-width 1000px.

### 1. Header (one flex column, gap 12)
H1 `Motion`. Lede `One moment per chapter: a chart pick moves the figure's live part, and nothing else plays. The swipe stays the browser's; the figure only lags behind it.`

### 2. Picks (flex column, gap 40)
H2 `Picks`. Then one row per chapter, in this order. A row is a flex row (gap 32, align-items flex-start) of: a label block (flex column gap 4, width 200, flex-shrink 0: Name, Trigger, Total) and a content block (flex column gap 12) holding the keyframe strip, the lanes and an optional Note.

**Keyframe strip**: flex row gap 12. Each cell is a flex column gap 8: a 300×160 frame (`background:#3C3A37; border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden`) holding the image at its native size, then a Cell label.

**Lanes**: a frame `position:relative; width:1080px; height: (lanes × 26 + 18)px`. First a scale row at top 0: mono 11px muted labels `0`, `100`, `200`, `300`, `400 ms` at left 0, 240, 480, 720, 960. Then each lane bar at `top: 18 + i×26 px`, `left: start×2.4 px`, `width: duration×2.4 px`, `height:20px; border-radius:6px; display:flex; align-items:center; overflow:hidden; white-space:nowrap`. Figure-part lanes: background `#473631`, label colour accent. Other lanes: background `#403D3A`, label colour muted.

| Chapter (Name) | Trigger | Total | Keyframes (image file in `out/`, native size → Cell label) | Lanes (start ms, duration ms, kind, label) | Note |
|---|---|---|---|---|---|
| Continents | Tap a continent row or piece | 320 ms | `kf-continents-0-rest.svg` 267×160 → `0 ms · Europe`; `kf-continents-1-lift.svg` → `120 ms · Asia lifted`; `kf-continents-2-set.svg` → `320 ms · seated`; `kf-continents-3-empty.svg` → `empty socket · Oceania` | 0,120,figure,`piece lifts 4px · --dur-press · --ease-out`; 120,200,figure,`seats · --dur-base · --ease-out`; 0,150,other,`fills crossfade · --dur-fast`; 0,200,other,`hero rolls · SlotText` | `An empty continent has no piece to lift: its socket outline turns coral and the hero reads 0 flights. The lifted piece paints last so it passes over its neighbours.` |
| Rhythm | Tap a month | 450 ms | `kf-rhythm-0-rest.svg` 199×160 → `0 ms · MAR`; `kf-rhythm-1-roll.svg` → `200 ms · band at OCT`; `kf-rhythm-2-press.svg` → `300 ms · pressed`; `kf-rhythm-3-set.svg` → `450 ms · re-stamped` | 0,200,figure,`band rolls · --ease-in-out`; 200,100,figure,`head presses 3px · --ease-out`; 300,150,figure,`head returns · --dur-fast · --ease-out`; 300,150,other,`new impression inks in · opacity`; 0,200,other,`hero rolls · SlotText` | `Total is --dur-moment. Rapid picks retarget the band from where it is and press once, after the last pick.` |
| Aircraft | Tap a maker | 150 ms | `kf-aircraft-0-rest.svg` 246×160 → `0 ms · Airbus`; `kf-aircraft-1-boeing.svg` → `150 ms · Boeing` | 0,150,figure,`door, name and stand mark crossfade · --dur-fast · --ease-out`; 0,200,other,`hero rolls · SlotText` | `Lighting only: the hangars never move, so reduced motion looks the same.` |
| Clock | Tap an hour bar | 200 ms (built) | clone of Clock figure from `MUQ-0` → `0 ms · 00:20`; clone of Clock figure from `MZ4-0` → `200 ms · 21:00` | 0,200,figure,`segments morph · --dur-base · --ease-out` | — |
| Routes | Tap a route | 200 ms | clone of Routes figure from `NJT-0` → `0 ms · ROV ↔ VKO` | 0,200,figure,`pass lifts 6px and deals to the top · --ease-out` | — |
| Records | Tap a record | 280 ms | clone of Records figure from `NYJ-0` → `0 ms · DOH → NRT` | 0,120,figure,`old pins drop · --ease-out`; 120,160,figure,`new pins rise · --ease-out`; 120,160,other,`route redraws, origin first · 160ms stagger` | — |
| Rankings | — | — | none | none | `Figure open: both loyalty-card takes were removed from the board. Until one is chosen, the chart and hero follow the shared rules.` |

For the clones: in each source artboard find the figure frame inside `Slide content` (`get_tree_summary` depth 3; it is the ~300×160 or 206×160 frame named "Figure" or similar, not Hero or Chart stage) and insert `<x-paper-clone node-id="ID" style="position:relative;left:0;top:0;" />` into the 300×160 cell.

### 3. Swipe and shared rules (flex row, gap 80, align-items flex-start)
Two columns, each a flex column gap 14, width 760. Each rule is a flex row gap 16: Rule label + Rule text.

Column A: H2 `Swipe`, then rules:
- `Owner` · `Native scroll-snap track, built. snap-stop: always, so a flick moves one chapter.`
- `Hero, chart` · `Move 1:1 with the slide.`
- `Figure` · `Lags at 0.8× and fades to 0.25 one width away. Each slide's view timeline drives it, behind the pager's @supports gate; without it the figure moves 1:1.`
- `Pager` · `Scroll timeline, built.`
- `Title, footer` · `Fade and slide 24px, switch at halfway, built.`
- `Settle` · `The chapter opens on its headline. Off-screen figures reset without animating.`
- `Reduced motion` · `The figure moves 1:1 with no fade. Previous and Next fade 150ms linear, built.`
Then one mono 12px/18px muted line: `at 40%: outgoing content −156 · figure −124.8 · 0.70  |  incoming +234 · +187.2 · 0.55`.

Column B: H2 `Shared pick rules`, then rules:
- `Tap` · `A chart mark or the figure's live part, under 8px of movement. Press 120ms.`
- `Chart` · `The selected fill crossfades over --dur-fast. View toggles slide the segmented thumb over --dur-base --ease-in-out; bars morph over --dur-sheet --ease-out.`
- `Hero` · `The value rolls per character with Arc SlotText (200ms --ease-out, direction follows the change); the caption swaps in place. Static on first render and on swipe. Proposed: Overview numbers are immediate today.`
- `Interrupt` · `A new pick retargets from the current pose. Nothing queues.`
- `Never` · `Idle loops, arrival animations, glow, count-up from zero.`
- `Reduced motion` · `Lighting only: fills swap at once; no lift, roll, press or morph.`

Verify with one screenshot of the whole board (scale 1) and one of the Picks section (scale 1). Check lane labels fit inside their bars (if one clips, shorten nothing: set that bar's width to `max-content` with 8px right padding instead) and that cells align in one row.

Artboards for `finish_working_on_nodes`: the new board.


## W6 — Rhythm sheet (after W2)

Build it in one run so the canvas never shows a stray copy.

1. `duplicate_nodes` on `O6L-0` (Aircraft, already updated by W2). Keep the returned `descendantIdMap`: every ID below is an **original** Aircraft ID; use the map to get the copy's ID. Rename the new artboard `06 Rhythm — dark` immediately.
2. Text: title `OAB-0` → `Rhythm`; position `OAA-0` → `6 of 7`; previous label `O6T-0` → `Continents`; next label `O6R-0` → `Aircraft`, colour ink, and set the copy of `O6O-0` (Next frame) to `opacity: 1`.
3. Pager (`O9R-0`, children in order 1–7: `O9Y-0, O9X-0, O9W-0, O9V-0, O9U-0, O9T-0, O9S-0`): all `var(--color-journal-dark-control)`, the 6th (`O9T-0`'s copy) `var(--color-journal-dark-shu)`; rename the 6th `Active segment` and the 4th `Rectangle`.
4. Figure: `write_html` mode `replace` on the copy of `SD1-0` with
   `<div layer-name="Figure · date stamper" style="position:absolute;left:45px;top:8px;width:300px;height:160px;display:flex;align-items:center;justify-content:center;"><img layer-name="Stamper · MAR" src="paper-asset:///Users/indi256/Documents/kuuki/kuuki/.scratch/figure-redraw/out/rhythm-d-stamper.svg" style="width:199px;height:160px;flex-shrink:0;" /></div>`
5. Hero: value (the text inside the copy of `OCL-0`) → `March`; insert after it in that row `<div layer-name="unit" style="font-family:'Commissioner',system-ui,sans-serif;font-size:22px;line-height:28px;font-weight:500;color:var(--color-journal-dark-muted);">11 flights</div>`. Caption `OCN-0` → `Busiest month · longest gap 13 months,` + newline + `which the passport took personally.`
6. Chart header (copy of `OCR-0`, already the W2 layout): segment labels → `Calendar` (selected) and `Over time`; caption → `All years`.
7. Delete the copies of the four maker rows `OCZ-0, OD5-0, ODB-0, ODH-0`.
8. Into the copy of chart stage `OCP-0` insert `<div layer-name="Plot" style="position:absolute;left:0;top:58px;width:390px;height:134px;"></div>` with 12 bars, each `position:absolute; bottom:0; width:20px; border-top-left-radius:2px; border-top-right-radius:2px;`, `layer-name` = month:

   | Month | left | height | colour |
   |---|---|---|---|
   | Jan | 26 | 61 | bar |
   | Feb | 55 | 20 | bar |
   | Mar | 84 | 112 | accent |
   | Apr | 113 | 61 | bar |
   | May | 142 | 31 | bar |
   | Jun | 171 | 20 | bar |
   | Jul | 200 | 51 | bar |
   | Aug | 229 | 2 | stub |
   | Sep | 258 | 51 | bar |
   | Oct | 287 | 61 | bar |
   | Nov | 316 | 41 | bar |
   | Dec | 345 | 71 | bar |

   Reading label inside Plot: `<div layer-name="Reading label" style="position:absolute;left:74px;top:0px;width:40px;text-align:center;font-family:'Commissioner',system-ui,sans-serif;font-size:13px;line-height:18px;font-weight:600;font-feature-settings:'tnum';color:var(--color-journal-dark-ink);">11</div>`
9. Axis: into the chart stage copy insert `<div layer-name="Axis" style="position:absolute;left:0;top:192px;width:390px;height:24px;"></div>` with 12 letters J F M A M J J A S O N D, each `position:absolute; top:4px; width:20px; text-align:center;` at its bar's `left`, mono 12px/16px 400, muted except March's `M` in ink.
10. Details heading `O6X-0` → `Year by month`.
11. Screenshot once; check the bars sit under the control without touching it, the `11` label clears the March bar, and the footer reads `‹ Continents` / `Aircraft ›`.

Artboards for `finish_working_on_nodes`: the new Rhythm artboard.

## P — Parallel mobile pass (four Sonnet workers at once)

Four workers run at the same time on the same Paper page, each owning only its artboards. Extra rules for this pass:
- Touch only your own artboards. Never run `find_nodes` on the whole page; always pass `nodeId` = one of your artboards.
- Call `finish_working_on_nodes` **only with your own artboard IDs** (never with no arguments: that would release the other workers' boards).
- Do not move, delete or rename any artboard you do not own. The desktop panel `OV5-0` and the storyboard `P0G-0` belong to other work.
- Clean-up inside your artboards: rename layers whose names contradict their content (for example a pager bar named `Active segment` that is not the active one, or a figure frame still named after an old figure). Do not delete nodes except where your steps say so.

| Worker | Artboards | Steps |
|---|---|---|
| **P1 Clock** | `MUQ-0`, `MZ4-0`, `ODN-0` (light) | W2 steps 1–6 for these three. Then rename the artboards: `MUQ-0` → `04 Clock — dark`, `MZ4-0` → `04b Clock — tapped 21:00`, `ODN-0` → `04c Clock — light`. |
| **P2 Routes, Records** | `NJT-0`, `NYJ-0` | W2 steps 1–4 (they have no view toggle). Rename `NJT-0` → `02 Routes — dark`, `NYJ-0` → `03 Records — dark`. |
| **P3 Continents, Aircraft, Rhythm** | `SD4-0`, `O6L-0`, then the new Rhythm artboard | W2 steps 1–6 for `SD4-0` and `O6L-0`; when both are verified, W6 (Rhythm, duplicated from the updated `O6L-0`). |
| **P4 Template, stamper board** | `OIQ-0`, `S5X-0` | The template steps below, then W5 steps 1–3. |

**P4 template steps** (phone frame `OJG-0` inside `OIQ-0`):
1. W2 steps 1–4 on the phone: `Sheet` `OJR-0`, footer labels in `ONA-0`/`ONE-0`, the close button `OK2-0`, the filter chip `OKE-0`.
2. Chart stage `ONU-0`: rebuild its chart header per "Chart header with a toggle" with SNIPPET-SEG-DARK labels `View A` (selected) / `View B` and caption `Short caption`; its plot → `top: 58px; height: 134px`, every bar `height = round(old × 0.875)`; the axis stays at top 192.
3. Annotations: `OPI-0` → `CHART STAGE 216 · toggle 50 + gap 8` + newline + `Plot 134 (152 without a toggle) · axis 24`; `OP3-0` → `FILTER ROW 44 · always present` + newline + `Scope chip = Arc Chip 32 · chrome stays still`; `OPD-0` → `HERO 96 · value 40/44` + newline + `Caption 2 lines · value rolls (SlotText)`.

Each worker: one screenshot per owned artboard at the end, one fix round at most, then report per artboard (what changed, node IDs created, anything skipped and why, one-line verdict).

## Revision 2026-10-12: compact view toggle (the 50px SegmentedControl is rejected)

The owner rejected the 256×50 boxed control. Every chart header is back to a 32px row: the caption on the left, and the compact toggle on the right. Plots are back to `top: 40px; height: 152px` with their original bar heights, and rows are back to their original tops. This is what is now drawn on the template, the three Clock sheets, Continents, Aircraft and Rhythm.

**SNIPPET-TOGGLE-DARK** (32px visual; the 44px hit area is the build's job). The hexes are the dark tokens `--control-border`, `--surface-inset`, `--text` and `--text-muted`:

```html
<div layer-name="View toggle · compact 32" style="display:flex;align-items:center;height:32px;padding:2px;border:1px solid #958B82;border-radius:10px;flex-shrink:0;">
  <div layer-name="Option · selected" style="display:flex;align-items:center;height:26px;padding:0 12px;border-radius:8px;background-color:#403D3A;"><div style="font-family:'Commissioner',system-ui,sans-serif;font-size:13px;line-height:18px;font-weight:500;color:#F1EFEB;white-space:nowrap;">LABEL_A</div></div>
  <div layer-name="Option" style="display:flex;align-items:center;height:26px;padding:0 12px;"><div style="font-family:'Commissioner',system-ui,sans-serif;font-size:13px;line-height:18px;font-weight:500;color:#C4BEB7;white-space:nowrap;">LABEL_B</div></div>
</div>
```

**Light** (`ODN-0`): the same structure on the light tokens (`var(--color-journal-*)`).

**Header:** 342×32, flex row with `justify-content: space-between; align-items: center`. The caption comes first (13/18 600, muted, left-aligned) and the toggle second.

| Sheet | Caption | Options |
|---|---|---|
| Clock (dark, tapped, light) | Local departure time | Departures \| Arrivals |
| Continents | Flights by continent | Flights \| Firsts |
| Aircraft | Share of flights | Makers \| Fleet |
| Rhythm | Flights by month · all years | Calendar \| Over time |
| Template | Chart caption | View A \| View B |

## Arc pass 2 (2026-10-12): Disclosure, dense button, SlotText notes, loading and empty

Owner approved the Arc scout (`.scratch/sheet-anatomy/arc-scout.md`). Every spec below was read from `apps/next/src/client/ui/`. Dark tokens: `--color-journal-dark-*`; light tokens: `--color-journal-*`. Each worker owns only its listed artboards.

### A. Mobile Details row becomes `Disclosure` (`ui/disclosure.tsx`, `ui.css:764-818`)

On each mobile sheet, the text layer named `Details heading` (inside `Slide content`, 15/24 600 ink, normally at left 24, top 528) becomes a 44px trigger. Use `write_html` mode `replace` on the heading:

```html
<div layer-name="Details · Disclosure (collapsed)" style="position:absolute;left:20px;top:TOPpx;height:44px;padding:8px 4px;display:flex;align-items:center;gap:8px;border-radius:10px;">
  <div layer-name="Summary" style="font-family:'Commissioner',system-ui,sans-serif;font-size:15px;line-height:24px;font-weight:600;color:var(--color-journal-dark-ink);white-space:nowrap;">SAME COPY AS THE OLD HEADING</div>
  <svg layer-name="Chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><path d="M6 9 L12 15 L18 9" stroke="var(--color-journal-dark-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
</div>
```

- **TOP:** `heading top − 10`. If that puts the trigger's bottom past the `Slide content` height (normally 553), use `553 − 44 = 509` instead. Check that the trigger clears the bottom of `Chart stage` by at least 4px.
- **Light sheet:** use `var(--color-journal-ink)` for the summary and `var(--color-journal-muted)` for the chevron.
- **Stroke colour:** use the literal `var(...)` stroke. Never `currentColor`; it renders black in Paper.

### B. "Only …" becomes `Button dense` secondary (`ui/button.tsx`, `ui.css:11-30, 94-116`)

The spec makes "Only …" an offer to filter (`design.md` §2.6), so it is a button, not a removable chip. Replace the whole chip frame (the parent of the `Only …` text) with:

```html
<div layer-name="Only … · Button dense" style="position:absolute;left:SAMEpx;top:SAMEpx;height:32px;padding:4px 12px;display:flex;align-items:center;gap:8px;border:1px solid var(--color-journal-dark-control);border-radius:10px;background-color:var(--color-journal-dark-surface);">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5L3 5z" stroke="var(--color-journal-dark-ink)" stroke-width="2" stroke-linejoin="round"/></svg>
  <div style="font-family:'Commissioner',system-ui,sans-serif;font-size:13px;line-height:20px;font-weight:600;color:var(--color-journal-dark-ink);white-space:nowrap;">Only 21:00</div>
</div>
```

Keep the old frame's position. If it was flex-placed and not absolute, drop `position/left/top` and keep its slot.

### C. Picked-state SlotText note

Wherever a board annotates a pick, add one line: `Hero value rolls with SlotText: per character ±0.6em, 200ms --ease-out; static on first render; reduced motion swaps at once.`

### D. Mobile states board (new artboard)

`create_artboard` named `11 States — loading, empty, filtered`, 1410×1004, at world left 0, top 3300, background `#292827`. Put a title text at left 60, top 32: `Loading, empty and filtered` (Commissioner 20/28 600 `#F1EFEB`).

Three sheets at top 100, at lefts 60, 510 and 960. Each is `<x-paper-clone node-id="SOURCE" style="position:absolute;left:Lpx;top:100px;" />`, then edit inside the clone. If a clone's Details row is still the plain heading, convert it with A. Under each sheet, put a note at top 952 (Paper Mono 11/16 `#7FA3D9`, max width 390).

1. **Loading · Clock** (clone `MUQ-0`, rename `Loading · Clock`)
   - **Unchanged:** status bar, scrim, sheet, handle, header, pager, filter chip, chart header (caption and toggle), Details trigger and footer.
   - **Figure, hero and plot:** delete the figure's contents, the hero's contents, the plot bars, the reading labels and the night bands. Put one skeleton in each place: `background-color:var(--color-journal-dark-inset);border-radius:14px`.
     - Figure: 300×160, same box.
     - Hero: 342×96, same box.
     - Plot and axis: 342×176, at the plot's top.
     - Delete the axis tick labels.
   - **Note:** `LOADING · ui Skeleton per band at its final height (figure 300×160 · hero 96 · plot 176). Static, no pulse. Chrome, chip, toggle and footer stay live; nothing jumps when data lands.`
2. **Empty · Aircraft** (clone `O6L-0`, rename `Empty · Aircraft`)
   - **Figure:** replace the image inside the figure with `<img layer-name="Hangars · nothing lit" src="paper-asset:///Users/indi256/Documents/kuuki/kuuki/.scratch/figure-redraw/out/kf-aircraft-2-empty.svg" style="width:246px;height:160px;flex-shrink:0;" />`.
   - **Remove:** the hero contents, the whole chart stage (header, toggle and rows) and the Details trigger.
   - **EmptyState:** in their place, add a frame at left 24, top = the old hero top + 24, width 342. Use a flex column, centred, with padding 32px 20px and text-align center:
     - Title `No aircraft on file`: 17/24 500 ink.
     - Description, 4px below, max width 302: `Your flights flew on something. Add the type and the hangars open.` 15/24 muted.
     - Action, 20px below: a regular `Button` secondary `Open Journal`. Height 44, padding 10px 18px, 1px dark control border, radius 10, background dark surface, label 15/20 600 ink.
   - **Footer:** unchanged (`‹ Rhythm`, Next at 0.4).
   - **Note:** `EMPTY · ui EmptyState: title, one line, one action. No icon tile, no motion. The figure stays at rest with nothing lit; stands read —.`
3. **Filtered · Departure hour 21:00** (clone `MZ4-0`, rename `Filtered · 21:00`)
   - **Filter chip:** replace `All flights` with the real `Chip` (`ui/chip.tsx`, `ui.css:1025-1089`). The outer box is 32 tall, 1px dark control border, radius 10, `background-color:var(--color-journal-dark-floating)` and `box-shadow:0 0 0 1px rgb(255 255 255 / 8%)`. It holds two children:
     - **Body:** padding 4px 8px 4px 12px, label `Departure hour · 21:00` at 13/20 400 ink.
     - **Remove button:** 32×30, centred X, 14px, stroke 2, ink: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="var(--color-journal-dark-ink)" stroke-width="2" stroke-linecap="round"/></svg>`.
   - **Only chip:** delete it (the reading is now the headline).
   - **Hero:** value `21:00`. Caption `Earliest departure in scope · 7 flights,` / `one hour, every time. A habit.` (2 lines).
   - **Chart:** every hour bar becomes a 2px stub except 21. The 21 bar is the full plot height (`top: 0`), accent fill, with its reading label above. Remove the tap guide annotations.
   - **Note:** `FILTERED · tapping "Only 21:00" applies the Departure hour facet. The filter row shows the real ui Chip: body reopens filters, × removes it (32px, 44px coarse). Counts illustrative.`

Screenshot the board once, fix in one batch, re-screenshot once, then `finish_working_on_nodes` with only your artboard.

### E. Desktop (owner of `OV5-0`, `SNU-0`, `TLA-0`, plus a new board)

1. On `TLA-0`, make the `Only Asia` chip (parent of the `Only Asia` text) a `Button dense` per B: same slot, and the label stays `Only Asia`.
2. Add the C line to the PICK note on `TLA-0`.
3. On every panel, check that the view toggle is the compact control (32px, 1px dark control border, radius 10, 2px padding, 26px radius-8 inset pill). Fix any that differ.
4. Create the board `10d Desktop — loading and empty`, 1500×1080, at world left 1560, top 3300, background `#292827`. It holds two panels at their real size, cloned from the existing panels, side by side with a notes column:
   - **Clock loading:** same treatment as D1. Details columns become one skeleton band at their height.
   - **Aircraft empty:** same treatment as D2 (figure `kf-aircraft-2-empty.svg`, EmptyState in the hero/chart area, details removed). Keep the desktop band geometry.

## Desktop Overview · full chapter cards inline (2026-10-12)

The owner picked full cards inline: no chapter panel on desktop. Each card is the whole chapter in the new anatomy, inside the built two-lane masonry. At a 1440 viewport that is a 28px gutter, two 684px lanes and a 16px gap (`layout/layout.css`, `layout/use-lanes.ts`). The globe band is a labelled placeholder; **the cards are the priority**.

Artboard `14 Desktop — Overview, full chapters` (created by the coordinator) has three frames:
- `Top`
- `Bento · 2 lanes`, holding `Lane A` and `Lane B`. Each lane is a 684-wide flex column with a 16px gap.

DOM order is the default order, with Continents in Crossings' slot: Rankings, Routes, Records, Continents, Rhythm, Clock, Aircraft. Masonry puts each card in the lane that frees up first (`layout/use-lanes.ts`; a tie goes to Lane A). With the drawn heights that gives **Lane A: Rankings, Continents, Clock, Aircraft** and **Lane B: Routes, Records, Rhythm**. The lanes change whenever card heights change.

**Don't call `finish_working_on_nodes`; the coordinator releases the board.** Write only inside the frames you own.

### Card shell (`.ov3-section.ov3-frame`, dark)

```html
<div layer-name="Card · NAME" style="width:684px;display:flex;flex-direction:column;padding:20px 0 24px;border-radius:14px;background-color:var(--color-journal-dark-surface);box-shadow:inset 0 1px 0 rgb(255 255 255 / 5%);">
  <div layer-name="Card header" style="height:44px;display:flex;align-items:center;justify-content:space-between;padding:0 12px 0 24px;">
    <div style="font-family:'Commissioner',system-ui,sans-serif;font-size:18px;line-height:24px;font-weight:600;letter-spacing:-0.01em;color:var(--color-journal-dark-ink);">NAME</div>
    <div layer-name="Options · ghost 44" style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="1.6" fill="var(--color-journal-dark-muted)"/><circle cx="12" cy="12" r="1.6" fill="var(--color-journal-dark-muted)"/><circle cx="19" cy="12" r="1.6" fill="var(--color-journal-dark-muted)"/></svg></div>
  </div>
</div>
```

Below the header: a 16px gap, then the panel's sections cloned in this order:
1. **`Row A · figure + hero`:** `<x-paper-clone>`, then set width 684. The hero inside grows to fill (`flexGrow:1`); it keeps the 24px inline padding.
2. **`Chart stage`:** set width 684.
   - **Row charts** (Continents, Aircraft, Routes, Records, Rankings): the chart header and each row stretch to 636, so values sit on the right edge under the toggle.
   - **Column charts** (Clock, Rhythm): keep their natural 592 plot and axis, left-aligned. DESIGN.md: "count-driven charts keep their natural width".
   - The chart header is always 636 wide.
3. **`Details`:** set width 684; the detail columns stretch to 636. Then insert the **Disclosure rows** listed per card, after `Coverage` and before `Narrator`. Leave 24px above the narrator.
   - Each Disclosure row is 44 tall, padding 8px 4px, at left −4 so the text sits on the content edge, gap 8.
   - Summary: 15/24 600 ink. Chevron: 18px, path `M6 9 L12 15 L18 9`, stroke 2, `var(--color-journal-dark-muted)`, round caps and joins. All are collapsed.

No hairlines anywhere. Copy stays as in the panels unless the card spec below changes it. Counts are illustrative. `write_html` replace ignores left/top; set positions with `update_styles` afterwards.

### Per card

| Card | Source panel | Disclosure rows (collapsed) |
|---|---|---|
| Routes | `SNU-0` › `Chapter panel · Routes` (`SZ4-0`): Row A `T0S-0`, Chart `SZK-0`, Details `SZ5-0` | `Flights and new routes per year` |
| Records | `SNU-0` › `Chapter panel · Records` (`T2V-0`): `T4J-0`, `T3B-0`, `T2W-0` | `Witnesses and provenance` |
| Continents | `SNU-0` › `Chapter panel · Continents` (`SNV-0`): `SPJ-0`, `SOB-0`, `SNW-0` | `Clock shift by year` |
| Rhythm | `SNU-0` › `Chapter panel · Rhythm` (`SRM-0`): `STA-0`, `SS2-0`, `SRN-0` | `Year × month heat grid`, `Daily activity` |
| Aircraft | `SNU-0` › `Chapter panel · Aircraft` (`SVD-0`): `SX1-0`, `SVT-0`, `SVE-0` | none |
| Clock | `OV5-0`: the Clock panel's Row A, Chart stage and Details (find them by layer name) | none. Show the **hover state** on the 21 bar (below). |
| Rankings | built new (below) | `Rank by year`, `Airline shares` |

**Clock hover (desktop fine pointer only):**
- The 21 bar lightens to `var(--color-journal-dark-muted)`.
- Above it sits the chart tooltip `.kc-tooltip`. It is about 196 wide, with `background-color:var(--color-journal-dark-floating)`, a 1px `var(--color-journal-dark-control)` border, radius 14 and padding 12. Its text is 13/20:
  - `21:00 · 7 flights` in 600 ink
  - `Busiest hour` in muted
  - `Click or press Enter to pick` in muted
- Place it so its bottom is 8px above the bar top, clamped inside the card's right edge.

**Rankings (new; the figure is still open):**
- **Row A:** copy the Routes Row A structure. Replace the figure image with a dashed placeholder: 300×160, 1px dashed `#6B645E`, radius 14, with the centred text `Rankings figure · open` at 13/20 muted.
- **Hero:** value `23` with the unit `flights`. Caption, 3 lines: `on Qatar Airways, your top airline.` / `DOH leads airports, ROV ⇄ VKO routes.`
- **Chart stage:** clone the Routes chart stage (`SZK-0`).
  - Caption: `Leaders · by flights`.
  - Add the compact toggle on the right with three options, `Airlines` (selected), `Airports` and `Routes`. Copy the toggle from the Continents chart header (`SPC-0`) and add the third option.
  - The five rows read, in order: Qatar Airways 23 (the reading, accent bar), Aeroflot 19, Pobeda 11, Turkish Airlines 8, Emirates 6. Rank numbers are 1–5; bar lengths are proportional.
- **Details:** heading `Head to head`, with three detail columns:
  - `57 / 31` · `Airbus vs Boeing`
  - `71 / 29` · `short vs long haul`
  - `64 / 36` · `day vs night`
  - Coverage: `Based on 96 of 100 flights with an aircraft`.
  - Disclosures as listed above.
  - Narrator: `Qatar Airways has seen more of you than some relatives.`

### Top (placeholder band, cheap)

`Top` is 1440 wide, a flex column. In order:
- **Header** (56, padding 0 28, flex row space-between, `--background` `#292827`):
  - Left: wordmark `Ku` in `#EA846F` plus `uki` in ink, Commissioner 20/28 700. Then nav links `Overview` (accent `#EA846F` 600, with a 2px accent underline inset 12 at the bottom), `Journal`, `Passport` and `Leaderboard` (15/20 500 ink), each 44 tall with padding 0 12 and a gap of 4.
  - Right: a queue link `3 to review`, 13/20 600 muted. A split Add: accent fill `#EA846F`, 36 tall, radius 10, label `Add flight` 15/20 600 `#292827`, with a 1px divider-less chevron half (36×36) carrying a chevron-down icon. A 40px avatar circle in `#403D3A`.
- **Page head** (padding 40px 28px 16px): H1 `Hi, indi256` at 30/36 600 ink, followed inline by ` · All flights` in muted.
- **Next strip** (44 tall, padding 0 28):
  - An accent-tint pill (`#473631` fill, 24 tall, radius 12, padding 0 10, `IN 3 DAYS` 12/16 600 `#EA846F`).
  - Then `VKO → DOH` in Paper Mono 15/20 ink and `Thu 15 Oct · QR 236` 15/20 muted.
  - On the right, `+1 more ›` 13/20 600 muted.
- **Globe band** (padding 16px 28px 0, gap 16, height 520): two placeholder cards, with surface, radius 14 and the inset highlight.
  - `Globe card` 911×520, background `#403D3A`, centred label `Globe · MapLibre, not drawn here` 13/20 muted.
  - `Figures card` 457×520, centred label `Hero figures · flights, km, time, countries, airports` 13/20 muted.
- **Next up** (margin via padding 16px 28px 0): one placeholder card, 1384×120, label `Next up · up to 4 goals` 13/20 muted.
