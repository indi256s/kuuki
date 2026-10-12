# Figure redraw (2026-10-12)

User rejected the calendar (Rhythm), trophy (Rankings), sleep mask (Crossings) and maker plate (Aircraft). Two ideas each, built on the app iso kernel (`figures.ts`, render with `pnpm exec tsx .scratch/figure-redraw/render.ts`). Paper: page "Sheet anatomy", artboard "11 Figure redraw — 2 ideas each".

- Rhythm: A passport stamps · B baggage carousel (bags sized by month)
- Rankings: A tail fins on a rail · B airsick bags
- Crossings: A world-time dial (24 offsets, 7 reached) · B "Do not disturb" hanger
- Aircraft: A safety cards · B ten seats (6/3/1)

Round 2 (`figures2.ts`, artboard "12 Figure redraw — round 2"); user called round 1 "a good start" and asked for more:

- Rhythm: C window shades (raised by month) · D date stamper (MAR band)
- Rankings: C loyalty cards in a wallet · D cup stacks (one cup per flight)
- Crossings: C reception world clocks · D time-zone slide rule
- Aircraft: C seat-belt buckle · D hangars (floor area by share)

Round 3 (`figures3.ts`, artboard "13 Figure redraw — round 3"). User approved Rhythm D stamper; hangars assumed approved (attached without comment). Asked one more run on loyalty cards and on Crossings:

- Rankings: C2 stepped wallet (wider steps) · C3 fanned hand
- Crossings: E key rack (new; hook per offset, keys on reached) · F rule, cleaner · G reception clocks, cleaner

Contact sheet: `python3 -I sheet.py out '<regex>' out/sheet.png`.

Next, after the user picks: implement the new sheet cards with fluid figure + chart swaps on the existing ui/sheet (uiarc bottom-sheet).

## Round 4: Crossings metric swap → Continents (`figures4.ts`, artboard "14 Continents — Crossings metric swap")

User asked to replace the Crossings metric; chose continents only. Hangars polished as `makers-d2-hangars` (round 3 board, Aircraft row).

- A sticker suitcase (sticker per continent flown, dashed patches for the rest) · B jigsaw tray (real 110m coastlines merged per continent; flown = raised pieces, rest = empty sockets)
- Illustrative numbers: richest local test user (local miniflare D1, read-only): Europe 36, Asia 27, Africa 3 of 52 flights; 14 intercontinental; Africa first 2024.
- Data catch: `packages/data/src/countries.json` has RU, TR, GE, AM, KZ as `asia` and Americas as one `americas`. Count per airport: RU 19°–60°E → Europe, KZ west of 51.5°E → Europe, TR Thrace (lon < 29.1, lat > 40.4) → Europe, EG east of 32.6°E → Asia, Americas by `subregion`, overseas European territories by location.

## Decisions and handoff (2026-10-12)

- Chosen: Rhythm `rhythm-d-stamper`, Aircraft `makers-d2-hangars`, Continents `continents-b-puzzle` (user: "B is great"). Rankings: open — the user removed both loyalty-card takes (C2, C3) from the board. Crossings G clocks: parked, since Continents replaced the metric.
- The chosen builders take selection options with defaults that reproduce the approved SVGs byte for byte: `stamper(k, {month, flights, press, ink, printed})`, `hangars2(k, lit)`, `puzzle(k, {lit, lift, socket})`.
- `figures5.ts`: motion keyframes (`kf-*`) at each rest pose's k and viewBox, so frames overlay exactly. Render with `pnpm exec tsx .scratch/figure-redraw/render.ts kf-`.
- Paper briefs for the Sonnet drawing workers: `paper-briefs.md` (W1 Rhythm sheet + labels + fonts, W2 Arc component pass, W3 swipe storyboard, W4 motion board, W5 notes and layout).
- Written spec: `.scratch/sheet-anatomy/design.md` (2026-10-12 update: figures, Continents counting rules, pick motion table, built scroll-snap swipe with view-timeline figure parallax).
