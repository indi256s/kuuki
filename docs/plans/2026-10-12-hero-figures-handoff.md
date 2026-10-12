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
- [x] DESIGN.md (Illustration table, Overview hero, Motion) and docs/README entry points at `7a0c9609`; mobile value floor corrected to 28px on resumption.
- [x] Gates at `ab9e72b7`: typecheck, lint, `pnpm test` (1418), `format:check`, `next:build`, `test:next:navigation` (44) all pass.
- [x] Owner substituted Sonnet for the UI/SVG/motion review; four findings fixed at `9fb65b2e`. Final GPT-6.1-Sol high code review completed with no blocking findings.
- [x] Land locally on main by CAS from `af6195b7` to the finalization commit containing this handoff. The containing feature/main merge is `6c0a036b`; the root checkout index and files are untouched.

## Checks so far

- `vitest run src/client/overview/narrator src/client/overview/hero/records.test.ts`: pass (corpus lint covers the new triples; snapshot gained only hero/heroSmall winners).
- `tsc --noEmit`, `oxlint src/client/overview`: clean. Pre-commit (lint, typecheck): pass at `b665fe2d`.

## Resumption and final review

- Recovered the completed final review (`hero-figures-final-review-r1`). No Critical or Should-fix findings.
- Corrected the below-threshold footer fixture: a nonzero three-flight journal with no passport countries, below all five bars, must have no footer.
- Added one closing/reopen regression through the real pointer handlers. It passes with cancellation and fails when the old close timer is left active (mutation log: `/tmp/hero-reopen-regression.log`, checkout-local).
- Latest main (`af6195b7`) merged; the only conflict was docs/README.md. Preserved main's new navigation entry points and this feature's Overview entry points.
- Optional unused aggregate-field cleanup is outside this feature's finalization; follow-up recorded under `.scratch/hero-figures/issues/`.
- Updated stale navigation journeys brought in from main: manual capture now uses date tiles and From/To airport search; the private-profile journey checks the current passport copy and absence of Statistics.
- One full-suite context assertion timed out waiting for a cold lazy import; its test, complete file and full 1,449-test rerun pass without changing production or weakening the assertion.
- Browser animation interruption and physical touch/narrow-screen visual checks remain unverified. The automated navigation suite is the required journey gate.

## Final checks (merged main + final source)

- `pnpm typecheck`: pass. `pnpm lint`: pass, one inherited React Hook Form incompatible-library warning in capture/flight-form.tsx.
- `pnpm format:check`: pass; changed docs/tests also checked after final edits. `git diff --check`: pass.
- `pnpm next:build`: pass. Log: `/tmp/hero-final-build.log` (checkout-local).
- API/shared: 67 files, 809 tests pass (`/tmp/hero-final-test.log`). Next: 165 files, 1,449 tests pass on full rerun (`/tmp/hero-final-next-unit-rerun.log`).
- Navigation: full suite passes 43 journeys; its sole remaining stale capture assertion repaired and the complete capture retry/edit/delete journey passes in isolation on port 8817 (`/tmp/hero-capture-final-rerun.log`). Combined coverage: all 44 journeys. The other server occupying 8800 was not stopped.
- Final code review: GPT-6.1-Sol high, no blocking findings. Review's two test gaps addressed; optional aggregate cleanup tracked locally.

## Next action

Feature complete and landed on local main. No deployment or remote publication. Any production release remains separately authorized through deploy-kuuki.
