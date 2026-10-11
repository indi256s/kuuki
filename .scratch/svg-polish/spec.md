# SVG polish: sign-in plane field and Overview iso figures

Status: resolved
Date: 2026-10-11

Sources: two audits per area (GPT-6.1 Sol, then Opus 5.5 high, which verified Sol and audited on its own). Evidence and renders: `/tmp/opus-audit-auth/` and `/tmp/opus-audit-overview/` (galleries, `shots/`, simulation scripts `analyze*.js`, `density.py`, `render.ts`, `gallery.ts`, `proto.ts`, `mapprobe.ts`). Finding numbers below (A1, O9…) refer to those Opus reports.

Work in place on the root checkout (detached HEAD, large uncommitted WIP that the audits were run against). Do not commit, stash, reset or reformat unrelated files.

## Owner decisions (2026-10-11)

1. **No auto-wink on phones.** Tiles render only under `useMobile()` (≤700px), where `(hover: hover) and (pointer: fine)` never matches, so no tile hover plays. Instead, a tile shows its hover pose while pressed: `.ov3-tile:active` inside `@media (hover: none) and (prefers-reduced-motion: no-preference)`, in over `--dur-press` `--ease-out`, out over `--dur-fast`. The pose must end when a long-press reorder drag starts (the drag ghost lifts). Confirm `:active` fires on iOS (the tile has a pointerdown handler).
2. **Fleet tile draws a three-plane podium** (amended 2026-10-11, replacing the one-hero-plane tile): the top three types stand on a podium, 1st in the centre on the tallest block, 2nd and 3rd lower on either side, one shared true scale; only 1st is lit (accent) and takes the hover lift and windows. Fewer than three types → fewer blocks. The desktop section head keeps its lineup unless the owner asks for the podium there too.
3. **Plane field WCAG 2.2.2:** accept the residual risk. The drift pauses while focus is inside the auth form (`focusin` anywhere in the card's form column, not per input, so tabbing between fields does not resume it for a frame) and resumes when focus leaves the card. Instant pause is fine at 14.9 px/s. Existing offscreen/hidden pause and reduced-motion stillness stay.
4. **Create step morphs** instead of fading the whole step: the status line grows in place (`grid-template-rows: 0fr → 1fr`) over `--dur-base` with `--ease-in-out`; inputs and the button stay put; the reverse (Change / editing email) collapses the same way. Update DESIGN.md line ~179 ("The create step slides in place").

Motion tokens (apps/next/src/app/styles.css ~100–110): `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--dur-press` 120, `--dur-fast` 150, `--dur-base` 200, `--dur-sheet` 300. Use tokens, not new literals, unless a value below says otherwise.

## Batch 1: sign-in card (`apps/next/src/client/auth-card/`, `apps/next/src/app/styles.css`, DESIGN.md)

- **A1 P1 watermark cut on short phones** (`plane-field.css` mobile `.auth-watermark`, ~line 103): `top:52px; bottom:0;` (row centres itself), `font-size: clamp(80px, 100dvh - 560px, 104px); line-height: 1`. Check 390×640 shows all of くうき clear of the sheet, and 390×844 is unchanged.
- **A2/A3/A9 P1 mobile field is a fixed 390px island sliced at y=249 and at x=390** (`plane-field.css` ~117, `plane-field.tsx` MOBILE): `.auth-planes-mobile { left:50%; top:auto; bottom:0; translate:-50% 0 }`; re-author MOBILE as 700×302: the existing 14 board planes map to (x+155, y−15) so the 390×844 frozen frame is unchanged; add about 8 planes in the side margins (x<155 and x>545) with the same size mix. Planes then enter from behind the sheet edge and leave inside the masked header.
- **A4 P2 planes cross the header icons:** replace both mobile mask declarations with `linear-gradient(to bottom, transparent 48px, #000 80px)` (`-webkit-` too).
- **A5 P2 outlines merge over time:** group planes whose flight lanes are closer than `HW[a] + HW[b] + 2`, with `HW = { s: 5.4, m: 7.2, l: 9.9 }` px and `lane = 0.8944·x + 0.4472·y` (transitive grouping). All planes in a group share one loop length, the largest in the group; each keeps its own start offset. Run per layout (desktop, mobile). Prove with a simulation (reuse `/tmp/opus-audit-auth/analyze*.js`): 0 overlapping visible pairs over 3600 s for both layouts, frozen frame unchanged.
- **A6 P2 desktop field fixed at 620px tall while the card grows to ~704px:** author DESKTOP as 420×720 (add 4–5 planes with y in 620–720, same size mix), keep `top:0` so the card edge clips. Re-run the A5 grouping with the new planes.
- **A7 P2 desktop watermark off-centre** (`plane-field.css:11` `left:128px`): `left:0; right:0`.
- **A8 P2 dark→light ("dawn") hides the toggle's sunrise** (`styles.css` ~552–560 view transition): `:root[data-theme-switching='dawn'] .auth-horizon { view-transition-name: auth-horizon }` plus `::view-transition-old(auth-horizon){ animation:none; opacity:0 } ::view-transition-new(auth-horizon){ animation:none }`. Name the button, not the svg.
- **A10 create step (decision 4):** always render a status-line wrapper: `display:grid; grid-template-rows:0fr; margin-top:<−measured gap>; opacity:0` → `1fr; 0; 1` on `[data-step='create']` (and `creating`). Transitions: `grid-template-rows` and `margin-top` `var(--dur-base) var(--ease-in-out)`, `opacity var(--dur-fast)`. Inner child `min-height:0; overflow:hidden`. Make it `inert` and `aria-hidden` while collapsed, keep the live-region behaviour the status line has today. Drop `auth-step-in`. Reduced motion: no transition. Measure the gap (Opus measured ~28px) rather than trusting it.
- **A11 P3 tagline moves with the step** (`auth-card.tsx` ~293–298, comment in `taglines.tsx:19` says it never animates): render `<Tagline>` after the `.auth-step` div, same conditions.
- **A12 P3 horizon icon blur:** `auth-card.css` ~121/128 `translate: 0 -0.5px` → `0 -1px`; dark `0 -4.5px` → `0 -4px`.
- **A13 P3 mobile watermark shifted ~2px left:** mobile `letter-spacing:0; gap:0.04em`.
- **Decision 3 focus pause:** extend the field's existing pause condition (it already pauses offscreen and when the page is hidden) with "focus is inside the auth form". Implement with `focusin`/`focusout` on the card's form column (check `relatedTarget` so moving between fields does not toggle).
- DESIGN.md: update the create-step line and note the focus pause next to the plane-field description.

Rejected, do not do: thicker non-scaling strokes on small planes (Sol P5); animating only `.auth-status-line` (Sol P6, causes 30–40px jumps).

## Batch 2: shared iso renderer (`overview/iso/scene.ts`, `iso-figure.tsx`, `iso.css`, tokens)

- **O1 P2 rounded walls one tone** (`scene.ts:292`): fill the outline `front` without stroke, then one merged polygon over contiguous visible facets (outward normal nx+ny>0) that face more along x than y, filled `side`; then the outline stroke, then the top. Drop the seam line. Prototype: `/tmp/opus-audit-overview/proto.ts`, `shots/proto-rbox.png`.
- **O2 P2 base and top share a tone:** clock base wall `side`, top `front` (`clock.ts:59`); tape hook front `front` (`tape.ts:90`).
- **O4 P3 glow blur fixed px:** multiply blur by `this.k` inside `glow` and retune the base values so the current section-size look is kept; consider light `--iso-glow` 0.3.
- **O5 P3 filter region 4000×4000** (`iso-figure.tsx:144`): viewBox + motion travel + 3×blur.
- Add: optional `width` on polygon nodes (renderer passes it as strokeWidth); paint `accent-side` = `color-mix(in oklab, var(--accent) 80%, black)`; token `--iso-shadow` (light `rgb(48 45 42 / 14%)`, dark `rgb(0 0 0 / 35%)`).

## Batch 3: fleet (`fleet.ts`, `fleet.css`, callers)

- **O9 P1 hover darkens the plane in light:** resting window strip `detail`, no glow; each `window` group carries the accent line plus its glow, so the stagger lights windows nose→tail in both themes.
- **O13 P2 windows render as a bar:** below k≈1.5 draw one continuous band 0.8 wide, no dashes.
- **O15 P3 exit keeps stagger:** base `transition-delay:0`; stagger only in the active rule.
- **O11 P2 lift invisible, no shadow:** `LIFT = 5 / k` m; add a `shadow` part: fuselage hull + wing and stab outlines flattened to the plinth top, fill `--iso-shadow`, drawn after the plinth top; on hover shadow opacity .55 and scale .92 about its centre; move the stand rod into the plane group or extend it by LIFT so the plane never leaves its rod.
- **Decision 2 / O10 (amended):** `fleet()` takes `podium` for the tile and `lineup` for the section head. The tile shows the top three types at one common scale, ordered 2nd/1st/3rd, on 12/16/9px blocks with 8px rank numerals; its figure fits within 148px width and 125px height. The section head keeps three-up with per-aircraft plinths (`length + 8`, `span + 1`, stacked placement, one common scale).
- **O14 P3 plinth gaps read as divider lines:** plinth stroke `detail`; gaps ≥6 or one shared slab.
- **O12 P2 level of detail:** below k≈1 interior strokes 0.6, silhouette 1; skip parts under 1.5px (cockpit glass, pylons, spinner, flap/rudder/crown lines).
- **O16 P3 stand-ins:** keep the stand-in airframe lit; widebody stand-ins drop the borrowed engines (`engines: []`), regional and turboprop stand-ins keep them (all twins; amended 10-11).

## Batch 4: tape (`tape.ts`, `tape.css`)

- **O26 P2 blade exits through the wall:** move the slot to z 0.8–4 (BZ stays 2.6), inside the flat wall span y 10–30.
- **O27 P2 hub competes:** hub `side` fill, `line` ring, `detail` centre screw dot, no glow.
- **O29 P2 tag floats and repeats the value:** stand it on the blade's far edge (plane y=10, bottom z=BZ); drop the tag text below k 0.9.
- **O28 P2 case reads as a box:** slim prism extruded along y (depth ≈24), rounded-square x–z profile (r≈12, larger top-back), facets shaded by facing; small thumb-lock box on the top-front edge. A prism helper may go in `scene.ts`.
- **O30 P3:** retraction 160ms `cubic-bezier(.55,0,1,.45)` (sprung snap home); payout keeps the hover-in timing.

## Batch 5: map (`map.ts`, `map.css`)

- **O18 P2 fold kink:** cut z = `zAt(fx) + (a[2] − zAt(a[0]))` (verify with `/tmp/opus-audit-overview/mapprobe.ts`). Do this first.
- **O17 P2 coasts read as cracks:** 2–3 closed land polygons, clipped per panel (Sutherland–Hodgman against each fold x), fill `land` (`--iso-detail` ≈35%), outline `detail`.
- **O19 P2 route:** rest `muted`, hover accent; the plane glyph stays `ink`.
- **O20 P3 pin heads flat:** facing tones with `accent` / `accent-side`.
- **O21 P3:** paper thickness strip on the visible x=184 end.

## Batch 6: clock (`clock.ts`, `clock.css`)

- **O22 P2 dip invisible:** dip 2.0; on hover raise the display backlight: wrap lit glows in a part with `--glow-boost`, glow opacity 0.4→0.7 (light), 0.75→1 (dark).
- **O23 P3 press sinks into a solid top:** slot rim: rounded rect 1 unit outside the bar at z=45 with an inner `side` wall strip 1 unit deep, drawn before the bar.
- **O24 P3 placeholder:** `DIGIT['-'] = 'g'`; colon inside `lit-both` so it glows with the digits.
- **O25 P3 display recess, section size only:** plane y 55, rim at 56.

## Batch 7: motion family, focus, touch (iso CSS, `overview/mobile/`, `cookie.css`, DESIGN.md)

- **O7 one timing family** for all four figures: hover-in 60ms delay + `var(--dur-base) var(--ease-out)`; out `var(--dur-fast)` no delay; staggers fit inside 160ms (tape retraction keeps O30).
- **O6 focus parity:** `.ov3-tile:focus-visible` (and the clock toggle) join the hover selectors with `transition: none`; under reduced motion lit end-states (windows, route) swap instantly.
- **O8 figures shrink by up to 12%:** pass a width to `tape()` / `clock()` like `fleet()` and build at container width; drop the `max-width:100%` / 148px override shrink.
- **Decision 1:** touch press pose (see above).
- DESIGN.md: one paragraph on Overview figure motion (family timings, press pose on touch, focus parity).

## Verification (every batch)

- `pnpm --filter @kuuki/next typecheck`, `pnpm --filter @kuuki/next lint`, `pnpm --filter @kuuki/next test` (fleet: `sections/fleet/*.test.tsx`; clock: `sections/clock/section.test.tsx`; tiles: `mobile/tiles.test.ts`).
- Visual: re-render with the audit galleries (`npx tsx /tmp/opus-audit-overview/gallery.ts`, adapt the copy under /tmp, never in the repo) or a fresh isolated page for the auth card; read screenshots after `sips -Z 1200`. Light and dark, rest and full hover, 1× and 4×.
- Never start, stop or kill a server you did not start; never `pkill` by pattern; do not run `pnpm next:build` (other sessions share build output).
- Final: one Opus-high visual review across all batches; Sol-high code review only when the whole feature is ready to ship.

## Completion (2026-10-11)

All seven batches, the owner's podium amendment, and the final review's eleven fixes are implemented. Final fixes and verification are recorded in [08-final-polish.md](issues/08-final-polish.md). Real-device iOS touch behavior remains a separate verification task in [09-ios-touch-verification.md](issues/09-ios-touch-verification.md).
