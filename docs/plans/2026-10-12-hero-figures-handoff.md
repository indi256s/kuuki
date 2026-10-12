# Hero figures takeover: handoff

- **Branch:** `feat/hero-figures-takeover` (worktree `~/.t3/worktrees/kuuki/feat-hero-figures-takeover`), from `db5ce6b4`.
- **Spec:** `.scratch/hero-figures/spec.md` (owner-approved 2026-10-12; untracked in the root checkout, copied into this worktree's `.scratch/`). Paper file `01M48F4SHK61AZS2FH5P5JPRY7`, page p-3-0: "Hero figures · hover takeover · states · dark", "Globe v2 · Desktop · Dark · hero takeover (km)", "Hero figures · iso concepts".
- **Not deployed.** Production needs separate owner approval through `deploy-kuuki`.

## Owner decisions taken during the build

1. **Resting card matches the board** (asked 2026-10-12): the hero is the five rows plus the footer line on desktop and mobile. The year strip, sparklines, deltas/share, the "to review" link, "Flights since", the km caveat and On this day leave the hero.
2. **Replay rule** (asked 2026-10-12): the takeover is off only while Replay plays after the user pressed Play in this visit; the default autoplay doesn't block it. (The board's "never starts automatically" belongs to the separate Globe v2 proposal.)
3. **Accessibility:** lint has no `no-static-element-interactions` rule, so rows stay `<dl>` entries with unchanged semantics; the takeover is an `aria-hidden` presentation layer driven by delegated pointer events. No keyboard path (owner's call in the spec).

## Interpretations (reversible)

- **Footer = a new `hero` narrator slot**, not `globe`: the globe slot has an always-on fallback, so "no trigger, no footer" could never hold there. Triggers carry a `record`; below its bar a record's takeover reads its `heroSmall` triple. Bars: flights ≥ 25, km ≥ one equator (≥ 100,000 km gets the timing-belt line), air ≥ one week, countries ≥ 10, airports ≥ 10.
- **Rotation:** an opening's line is `(hash variant + openings) % 3`, so the first opening of the record that won the footer reads the footer's line (as on the board).
- **Stickers:** up to four of the most-visited countries' most-used airports, ordered by first visit; the newest country replaces the fourth when it is not already among them, so the lit sticker always exists.
- **Hero stays right of the globe**; the board's left placement is Globe v2.
- **Durations at full size** ("≈216h 42m", as on the board): the old half-size unit span is gone.
- **UI bus snapshot** gained `replayStarted`; `overview-context.test.tsx` pins the new initial snapshot.

## Progress

- [x] `iso/solids.ts` (shared round parts, slabs, shadows) and `.scratch/hero-figures/preview.mts` (dark/light, rest/posed, 1×/4× PNGs).
- [x] Five figures, each one live part and one pose (CSS beside it): `spike.ts` (`top-stub` lifts), `odometer.ts` (`last-drum` ticks), `cabin-window.ts` (`shade` rises), `suitcase.ts` (`handle` extends), `carousel.ts` (`incoming` pushes through). Checked at 4× in both themes.
- [x] `iso/hero-glyphs.ts`: five 26–30px glyphs, line-only, no glow.
- [x] `hero/records.ts` + tests: stub buckets, odometer digits, sticker pick, tag, rail values (k/M/h; тыс./млн/ч).
- [x] Narrator `hero`/`heroSmall` triggers, EN/RU triples (glados-copy), `recordLine` rotation in `pick.ts`.
- [x] Hero card rewrite + takeover (timers, glide, pose, touch, scroll-out, Replay, mobile height lock) at `ab9e72b7`. Year strip, sparklines, On this day and `ArcSparkline` deleted (no other users).
- [ ] DESIGN.md (Illustration table, Overview hero, Motion) and docs/README entry points.
- [x] Gates at `ab9e72b7`: typecheck, lint, `pnpm test` (1418), `format:check`, `next:build`, `test:next:navigation` (44) all pass.
- [ ] Opus-high UI/SVG/motion review; then the single Sol-high code review.
- [ ] Land on main by CAS.

## Checks so far

- `vitest run src/client/overview/narrator src/client/overview/hero/records.test.ts`: pass (corpus lint covers the new triples; snapshot gained only hero/heroSmall winners).
- `tsc --noEmit`, `oxlint src/client/overview`: clean. Pre-commit (lint, typecheck): pass at `b665fe2d`.

## Next action

Docs (DESIGN.md, docs/README) and the Opus-high UI/motion review are running; apply its fixes, then the Sol-high code review, then land by CAS.
