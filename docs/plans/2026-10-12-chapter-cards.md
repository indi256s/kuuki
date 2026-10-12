Plan contract: wave-plan/v1

# Overview chapter cards Implementation Plan

Goal: Ship the redesigned Overview chapter cards from Paper "Sheet anatomy": one card anatomy (figure stage, hero, chart stage, details) used by the mobile chapter sheet and by full desktop cards in the two-lane masonry. Seven chapters: Rankings, Routes, Records, Continents (in Crossings' slot), Rhythm, Clock and Aircraft. Picks select and light the figure; "Only …" applies the filter.
Architecture: A shared `ChapterCard` body (`overview/layout/chapter-card.tsx`) owns the band geometry, the hero (SlotText roll on picks), the "Only …" slot, the chart stage with the dense view toggle, Details (a `Disclosure` on mobile, columns up front on desktop), and the loading and empty states. Each `sections/<chapter>/section.tsx` keeps owning its data and composes the card. Shared stage charts (`charts/stage-columns.tsx`, `charts/stage-rows.tsx`) sit on `KuukiChart`, which gains a `selected` state distinct from `applied`. New figures live in `overview/iso/`, as ports of the approved scratch builders. New shared data goes in `packages/shared/src/overview` (a continents builder, the top-5 longest records).
Success: At 390 and 1440, in light and dark, with Shu and one other accent, each chapter matches its Paper board's intent under the v1 color rules. A chart pick or a figure tap updates the hero and lights the figure. "Only …" applies the matching facet, and the filter row shows it as a removable `Chip`. Nothing animates on load. Reduced motion swaps instantly. `tokens.test.ts`, typecheck, lint and the Overview unit tests pass. The Next build and the navigation suite pass.
Out of scope:

- The globe, the hero band, Next up and the filter panel (except where the filter row reuses them).
- A month-of-year facet and a continent facet.
- A per-flight facet.
- Renaming the `crossings` SectionId.
- Pushing, deploying, or writing to remote D1.
- Paper edits.
  Constraints:
- AGENTS.md, CODING_STANDARDS.md and DESIGN.md.
- Tokens only, with no raw hex or rgb in components or CSS; the `kuuki/design-tokens` lint rule enforces this.
- No content divider lines.
- Motion: only semantic motion. Transform and opacity only. The existing tokens. No ease-in, no bounce, no load or entrance animation, no loops, no count-up. Interruptible. Reduced motion swaps instantly.
- EN and RU for every string, with real plurals and «вы».
- Never touch the root checkout `/Users/indi256/Documents/kuuki/kuuki`.
- Subagents stop only the server PID they started.
- No Claude or AI attribution anywhere.
- Execution preference: the Opus orchestrator plans, decides, debugs and accepts. Sonnet workers implement self-contained tasks. Parallel workers only on disjoint files. There are no per-wave reviewers.
- One UI/design/motion review on Opus at high effort, and one final code review on GPT-6.1-Sol at high reasoning via `delegate_task`.
  Planning basis:
- Specs: `.scratch/sheet-anatomy/design.md` (§1–§6), `.scratch/sheet-anatomy/arc-scout.md`, `.scratch/figure-redraw/paper-briefs.md` (card shell, compact toggle, Arc pass 2 A–E, desktop full chapters), and `.scratch/figure-redraw/figures2-5.ts`.
- Paper file `01M48F4SHK61AZS2FH5P5JPRY7`, page `p-3-0`. Boards:
  - Mobile sheets: `NJT-0` Routes, `NYJ-0` Records, `SD4-0` Continents, `TAZ-0` Rhythm, `MUQ-0` Clock dark, `MZ4-0` Clock tapped, `ODN-0` Clock light, `O6L-0` Aircraft.
  - `TU7-0`: states.
  - `TZ6-0`: desktop loading and empty.
  - `UEY-0`: desktop full chapters.
  - Board 15 "Motion" is no longer in the file, so the timings come from design.md §4 and paper-briefs W4.
- Code read: the Overview `layout/`, `mobile/`, `sections/`, `charts/`, `iso/`, `store/` and `ui/` folders, plus `packages/shared/src/overview/*` (a researcher's map, 2026-10-12).
- Baseline on `a531c0f9`: typecheck 0, lint 0. Unit tests: 4 pre-existing failures, all in `src/client/account/recovery.test.tsx` (unrelated).
  Execution profile: primary=runtime-selected; workers=runtime-selected; reviewers=independent-runtime-selected; exact-profile-attestation=not-requested
  Authority evidence: User request 2026-10-12 (implement the Overview chapter cards; stay on `feat/chapter-cards`; no push, deploy or remote D1). AskUserQuestion answers on 2026-10-12:
- Continents: hide "Only …".
- Picks select and "Only …" filters.
- Rankings: draw a figure now.

## Decisions (recorded, not re-opened)

| Topic              | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Why                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Pick model         | Click, Enter or a touch tap on a stage mark (or the figure button) selects the reading. The hero rolls and the figure lights. "Only …" (`Button dense` secondary, filter icon) applies the facet. The applied filter is a `Chip` with ×. The tooltip's "Add filter" action stays.                                                                                                                                                                                                                                                                                       | User answer                                                                          |
| "Only …" facets    | Clock: `depHours`/`arrHours`. Routes: `routes`. Records: `routes` (undirected key of the record's route; no per-flight facet exists). Aircraft Makers: `makers`. Aircraft Fleet: `aircraft`. Rankings: `airlines`/`airports`/`routes`. Rhythm Over time: `period {years:[y]}`. **Hidden:** Continents (user) and Rhythm Calendar (no month-of-year facet; confirm with the user when the Rankings figure is chosen).                                                                                                                                                    | Facets that exist today (`model.ts:9-26`)                                            |
| Continents id      | Keep SectionId `crossings` (prefs, server schema, goals and narrator keys unchanged). The registry title becomes Continents/Континенты, and the gate becomes the new continents gate (3 flights with a placed airport, unit `flights`). The time-zone counters move into its Details ("Lines you crossed").                                                                                                                                                                                                                                                             | A rename needs a prefs migration and a strict-schema change for no user-visible gain |
| Below gate         | Leaving the grid is decided on the **unfiltered** scope (`all`). A visible chapter whose **filtered** scope is below its gate renders `EmptyState` in place of the hero and chart. Filtered zero (0 flights) keeps the built page-level line.                                                                                                                                                                                                                                                                                                                           | Spec §2.5b, board 11                                                                 |
| Bar colors (v1)    | The stage's ordinary marks are `--mark-rest`, never `--mark-ghost` (that role is baseline strokes, and it measures about 2.85:1 on the dark floating sheet). The selected reading is `--accent` with its value label 13/18 600 `--text`. Hover, focus and pin are the v1 2px `--text` contour, never a recolor. An applied filter is the v1 filtered contour plus a ✓ before the row or bar label. A known zero is a 2px or 4px stub in `--zero`, with the value "—". No opacity on data. Aircraft makers use `--cat-maker-*` swatches and an Unknown outline with «?». | DESIGN.md Data color; Paper is intent                                                |
| Skeleton           | Add `--skeleton: var(--hairline)` (its own neutral role, like `--zero`). Use it in `ui/skeleton.tsx`. `tokens.test.ts` asserts ≥1.3:1 against `--surface` and `--surface-floating` in both modes.                                                                                                                                                                                                                                                                                                                                                                       | The known Paper gap: inset on floating is about 1.05:1                               |
| Narrator           | Stays built: 15/24 `--text-muted` at the card or slide foot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | DESIGN.md (Paper drew ink)                                                           |
| Figure hover poses | The new chapter figures have no hover pose; only pick motions are animated. Existing hover-pose CSS stays only for the tiles.                                                                                                                                                                                                                                                                                                                                                                                                                                           | Every animation must be semantic                                                     |
| Figure taps        | One transparent ≥44px button per figure ("Show next …") steps through the chart's readings in order (Clock: earliest → latest → busiest).                                                                                                                                                                                                                                                                                                                                                                                                                               | Spec §3; uniform                                                                     |
| Tiles              | Each mobile tile switches to its chapter's new figure and headline (the Rankings flap board and the Crossings globe were rejected).                                                                                                                                                                                                                                                                                                                                                                                                                                     | Coherence with the sheet                                                             |
| Rankings figure    | An Opus designer draws two candidates in `.scratch/figure-redraw/figures6.ts` (bag-tag printer, lit gate sign). The user picks one; W3 ports it.                                                                                                                                                                                                                                                                                                                                                                                                                        | User answer: draw now                                                                |

## Execution map

| Wave | Outcome                                                                                                                                                          | Depends on              | Writes (active owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Reads / validates                      | Parallel-safe with                                | Material risk → primary proof                                                                               | Acceptance owner |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------- |
| W1   | Shared foundations: dense toggle, skeleton token, chart selection and stage charts, card anatomy and states, sheet and desktop shells, figure ports, shared data | —                       | `ui/segmented-control.tsx`, `ui/ui.css`, `ui/skeleton.tsx`, `app/styles.css`, `app/tokens.test.ts`, `packages/shared/src/theme/palette.ts` (T1); `charts/kuuki-chart.tsx`, `charts/chart-theme.css`, `charts/stage-*.tsx` (T2); `iso/*` new files, `scripts/generate-continent-pieces.ts` (T3); `packages/shared/src/overview/{continents,records,figures,compute,goals}.ts` + tests (T4); `layout/*`, `mobile/section-sheet.tsx`, `mobile/mobile.css`, `page/overview-page.tsx` (T5) | DESIGN.md, Paper boards                | T1 ∥ T2 ∥ T3 ∥ T4; T5 after T1+T2                 | Selection breaks existing chart filtering → `kuuki-chart.test.tsx`; gate change hides chapters → page tests | primary          |
| W2   | Six chapters on the anatomy: Routes, Records, Continents, Rhythm, Clock, Aircraft (section, tile, CSS, tests)                                                    | W1                      | `sections/<chapter>/*` per task; `sections/registry.ts` (Continents task only)                                                                                                                                                                                                                                                                                                                                                                                                        | Paper sheet + `UEY-0` card per chapter | chapters pairwise disjoint; max 3 workers at once | Pick/Only wiring wrong → per-chapter section tests                                                          | primary          |
| W3   | Rankings with the chosen figure; RU/EN copy pass (glados-copy); narrator triggers for Continents; DESIGN.md and spec status                                      | W2 + user's figure pick | `sections/rankings/*`, `iso/<rankings figure>.ts`; `narrator/*`, `copy.ts`; `DESIGN.md`                                                                                                                                                                                                                                                                                                                                                                                               | glados-copy skill, PHRASES.md          | Rankings ∥ copy (disjoint)                        | Copy facts wrong → narrator corpus tests                                                                    | primary          |
| W4   | Visual QA at 390/1440 light/dark × 2 accents; Opus UI/motion review; Sol code review; fixes                                                                      | W3                      | any file a fix needs (primary assigns one owner per fix)                                                                                                                                                                                                                                                                                                                                                                                                                              | `dev-kuuki`, `agent-browser`           | —                                                 | Visual drift → screenshots against boards                                                                   | primary          |

## W1: Shared foundations

Objective: Every chapter can be written as data plus composition.

Owned writes: as in the map. Paths are relative to `apps/next/src/client/` unless rooted.

Implementation:

- **T1 `SegmentedControl dense`, skeleton token**
  - Add `dense?: boolean`, copying `Button dense` (`ui/button.tsx:20`, `ui.css:94-117`). `data-dense` on the root.
  - Visual: 32px tall, 1px `--control-border`, `--radius-sm`, 2px padding. Options are 26px tall with 12px inline padding, 13/18 500. The selected pill is radius 8, `--surface-inset`, in `--text`; the others are `--text-muted`. Cells size to content (no 104px minimum).
  - Hit area: an `::after` hit area to 44px on coarse pointers.
  - Motion: keep the built thumb timing (200ms `--ease-in-out`), and the reduced-motion rules.
  - Add `--skeleton` in `styles.css` `:root`, mirrored in `palette.ts` if the drift test demands it. `Skeleton` uses it.
  - `tokens.test.ts` adds:
    - `--skeleton` ≥1.3:1 against `--surface` and `--surface-floating`, both modes.
    - `--mark-rest`, `--accent` and `--control-border` ≥3:1 against `--surface-floating`, all accents and both modes. These marks now sit on the sheet; if one fails, stop and report.
- **T2 Chart selection, stage charts**
  - `KuukiChart` gains:
    - `selected?: (point) => boolean`, rendering `data-picked` plus `aria-current="true"`.
    - `tapPicks?: boolean`: a touch tap calls `onPick` instead of pinning. A long press or the context menu still pins the actions.
    - Enter or click calls `onPick` as now. The callers decide what a pick does.
  - `chart-theme.css`: `[data-picked]` fill comes from the caller (accent). The contour rules are unchanged.
  - `stage-columns.tsx`: the Clock 24 and Rhythm 12 and year columns. Count-driven natural width, left-aligned:
    - mobile: plot 152 + axis 24;
    - desktop: plot 182 + axis 24, 17px bars at a 25px pitch (board `UTO-0`);
    - optional background bands (the night band in `--surface-inset`, with a 12px mono label);
    - a reading label above the picked bar;
    - axis ticks 12/16 mono `--text-muted`.
  - `stage-rows.tsx`: ≤7 rows at a 24px pitch (board `SD4-0`):
    - label 15/20, 160px wide; 600 and `--text` on the picked row, 400 and `--text` on flown rows, `--text-muted` on zero rows;
    - an 8px bar, radius 4, from x=196 mobile, stretching to the content width minus the value;
    - value 13/18 600 tabular, right-aligned;
    - an optional leading swatch (makers) or mono label (codes).
  - Both:
    - render through `KuukiChart` (tooltip, table, keyboard, contour states);
    - selected fill crossfades over `--dur-fast`;
    - a view-toggle change morphs bars over `--dur-sheet` `--ease-out` with transform only (scaleY/scaleX from the baseline);
    - no animation on first render or when `inView` is false.
- **T3 Figure ports**
  - Move the shared helpers that `figures2-4.ts` take from `figures.ts` into `iso/flat.ts`.
  - Port `stamper` to `iso/stamper.ts`. Take `{month, flights, label}` with localized month abbreviations; no hardcoded English.
  - Port `hangars2` to `iso/hangars.ts`. Take `{sheds: {name, share}[], lit}` so the floor area follows the real shares (top 2 named makers + Other).
  - Port `puzzle` to `iso/puzzle.ts`. Take `{flown: Record<ContinentId, boolean>, lit, label}`.
  - Continent geometry: precompute into `iso/continents.generated.ts` with a Node script, `scripts/generate-continent-pieces.ts`. It reuses the scratch simplification and is run with `pnpm exec tsx`.
  - Replace the off-kernel paint `'mark'` with a kernel role.
  - Parity: renders at the default inputs must match the approved `out/*.svg` geometry (path data equal, colors via roles).
  - Each part that moves on a pick has a stable `data-part` key so CSS can transition it.
- **T4 Shared data**
  - `continents.ts`: `Gate<Continents>`.
    - Seven ids: europe, asia, africa, north-america, south-america, oceania, antarctica.
    - Per continent: `flights` (weighted, counting each flight once per continent it touches, per airport endpoint, honouring `suppressed`) and `firstYear`.
    - Also `flown` count and `unplaced` (endpoints that cannot be placed).
    - Placement: `refs.airports[code]` gives the country and lat/lon. `refs.regions` gives the base continent. Overrides from `figures4.ts:88-98`: RU 19°–60°E → Europe; KZ west of 51.5°E → Europe; TR Thrace (lon < 29.1, lat > 40.4) → Europe; EG east of 32.6°E → Asia. Americas: a static South America country list, the rest North America.
    - Gate: below 3 placed flights.
  - `records.ts`: add `longest5`, the top 5 distinct directed routes by great-circle km, with their counts.
  - Wire into `OverviewScope`, `compute.ts` and `goals.ts` (`SECTION_GATES.crossings` → `scope.continents`). Golden and unit tests.
- **T5 Anatomy, shells, states**
  - `layout/chapter-card.tsx`: `ChapterCard`, with props `{ figure, figureButton?, hero:{value, unit?, caption, only?}, chart:{caption, toggle?, plot}, details, coverage?, state: 'ready'|'loading'|'empty', empty?: {title, line, action} }` and `span: 'full'|'sheet'`.
  - Fixed band geometry:
    - sheet: figure 176 (box 300×160, centered), hero 96 (value 40/44 600 −0.03em tabular; unit 22/28 500 `--text-muted`; caption 15/24 muted with 2 reserved lines), gap 16, chart stage 216 (header 32, gap 8, plot 152, axis 24);
    - desktop: Row A 192 with the figure 300×176 beside the hero (48/52 value, 3-line caption), chart stage 246 (plot 182);
    - the "Only …" slot is absolutely positioned on the value line, so nothing reflows.
  - Hero value: `SlotText`, rolling only when the reading changes after mount. It is static on mount and on a swipe; when the chapter is left or the filter changes, the reading resets without animating.
  - Details:
    - sheet: `Disclosure` (collapsed);
    - desktop: up front, as a heading, three columns (22/28 600 value, 13/20 muted label), the coverage line, collapsed `Disclosure` rows, then the narrator.
  - Spacing groups the content; there are no dividers.
  - `layout/use-reading.ts`: `useReading(keys, headline)` returns `{reading, pick, next, reset}`. It resets when the open chapter changes (via a `ChapterContext {span, active}` from the sheet; always active on desktop) or when `keys` no longer contains the reading. A new pick retargets.
  - Loading: `Skeleton` per band at the final size; the chrome, the chart caption and the toggle stay live.
  - Empty: `EmptyState` replaces the hero and chart; the figure stays at rest and unlit.
  - `SectionFrame`: header 44 (H2 18/24 600 −0.01em, ⋯ ghost 44), padding 20/24. The grip shows on hover or focus only.
  - Sheet (`section-sheet.tsx`, `mobile.css`):
    - remove `.ov3-sheet-scope` and add an always-present 44px filter row: `Chip` "All flights" with the sliders icon (opens the filter panel), or the applied chips with ×;
    - figure stage parallax via `view-timeline: --chapter inline` (`translateX(-20%) → none → 20%`, opacity `.25 → 1 → .25`, `animation-range: cover`), behind the pager's `@supports` gate, and off under reduced motion.
  - Page: `locked` uses `all`.

Dependencies: Existing contracts only. T5 consumes T1 (dense, skeleton) and T2 (stage chart props).

Focused proof:

- T1: `vitest run src/client/ui/segmented-control.test.tsx src/app/tokens.test.ts`.
- T2: `kuuki-chart.test.tsx` plus one new test pinning that `tapPicks` calls `onPick` and does not pin.
- T3: the parity script output.
- T4: `pnpm --filter @kuuki/shared test` or the repo's shared test command (verify it), with a continents test pinning the RU/KZ/Thrace/Sinai/Americas splits.
- T5: `use-reading` tests (reset on leave and on a stale key); the page test that a filtered below-gate chapter stays visible with `EmptyState`.
- All: `pnpm --filter @kuuki/next typecheck` and `pnpm --filter @kuuki/next lint`.

Accept when: the primary has read every diff; the checks are green except the 4 baseline failures; and a scratch chapter (Clock) renders on the new card in the dev server at 390 and 1440.

## W2: Six chapters

Objective: Routes, Records, Continents, Rhythm, Clock and Aircraft render on `ChapterCard`, with picks, figure links and the "Only …" offers per the Decisions table, matching their Paper board and the `UEY-0` card.

Owned writes: `sections/routes/*`, `sections/records/*`, `sections/crossings/*` (Continents), `sections/rhythm/*`, `sections/clock/*`, and `sections/aircraft/*` plus `sections/manufacturers/*` plus `sections/fleet/*`. Each belongs to its task only; `sections/registry.ts` belongs to the Continents task.

Implementation (per chapter: hero, chart, figure link, motion, Details; spec §3 and §4):

- **Routes** (`NJT-0`)
  - Hero: distinct routes + repeat share.
  - Chart: `stage-rows`, top 5 routes from `scope.rankings.routes`, mono codes.
  - Figure: `passStack`; the picked route is dealt to the top (lift 6px, 200ms `--ease-out`).
  - Details: profile, home share, then a Disclosure with "Flights and new routes per year".
- **Records** (`NYJ-0`)
  - Hero: longest km.
  - Chart: `stage-rows` from `longest5`.
  - Figure: folded map re-pins (old pins drop 120ms, new pins rise 160ms, route redraw with the built 160ms stagger).
  - Details: the record cabinet, then a Disclosure with "Witnesses and provenance". The open-flight action stays.
- **Continents** (`SD4-0`)
  - Registry title. Hero "N of 7 continents". Toggle Flights | Firsts.
  - Figure: puzzle. The picked piece lifts 4px (120ms `--ease-out`) and seats (200ms `--ease-out`); fills crossfade 150ms; the lifted piece paints last. An unflown pick outlines its socket in the accent and the hero reads 0 flights.
  - Details "Lines you crossed": the built crossings counters (gated by `scope.crossings`) plus a Disclosure with "Clock shift by year".
  - No "Only …".
- **Rhythm** (`TAZ-0`)
  - Toggle Calendar | Over time.
  - Calendar: 12 month columns summed across years.
  - Over time: year columns, with the reading being the busiest year.
  - Stamper: the band rolls to the month (200ms `--ease-in-out`), the head presses 3px (100ms) and returns (150ms) while the impression inks in by opacity. Total 450ms. Rapid picks retarget the band and press once, after the last pick.
  - Details: busiest month, longest gap, then Disclosures for the heat grid with its metric control and for daily activity.
  - The Over time Brush stays the page's period control inside its Disclosure.
- **Clock** (`MUQ-0`, `MZ4-0`, `ODN-0`, `UTO-0`)
  - The polar dial becomes `stage-columns`: 24 bars, the night band 22–06, the tallest labelled.
  - The clock figure digits always equal the hero.
  - The figure button cycles earliest → latest → busiest.
  - Toggle Departures | Arrivals.
  - Details: before-noon share, red-eyes, the picked hour's count, and coverage.
- **Aircraft** (`O6L-0`)
  - Toggle Makers | Fleet.
  - Makers: `stage-rows` with maker swatches, Unknown as an outline with «?».
  - Figure: hangars from the real shares; the picked maker's doors, name and stand marking crossfade to the accent over 150ms `--ease-out` (lighting only).
  - Fleet: top 5 types as rows; the figure lights the type's maker.
  - Details: Flights/Distance/Time; coverage; Disclosures for "Manufacturers and types" and the ridgelines.

Every chapter:

- tile updated (new figure at tile width, headline);
- copy in EN and RU;
- reduced motion keeps the lighting only;
- no hover poses;
- section tests updated so pick ≠ filter and "Only …" applies the facet.

Dependencies: W1.

Focused proof: per chapter, `vitest run src/client/overview/sections/<chapter>`, plus the Next typecheck and lint.

Accept when: the primary has read each diff and seen each chapter at 390 and 1440 in the dev server (functional check; the full visual pass is W4).

## W3: Rankings, copy, docs

Objective: Rankings ships with the chosen figure. Copy is factual and keeps its edge in EN and RU. DESIGN.md records what was built.

Owned writes: `sections/rankings/*`, `iso/<figure>.ts`; `narrator/{triggers,corpus}.ts` + snapshots, `docs/skills/glados-copy/PHRASES.md`; `DESIGN.md`; `.scratch/sheet-anatomy/design.md` status line.

Implementation:

- Rankings (`UPS-0`):
  - Toggle Airlines | Airports | Routes.
  - Hero "N flights · on X, your top airline".
  - Rows, top 5.
  - The figure's live part carries the picked leader's code, with one semantic pick motion.
  - Details: Head to head; Disclosures "Rank by year" and "Airline shares".
- Copy pass with the `glados-copy` skill: hero captions, `EmptyState` lines, "Only …" labels, the Continents narrator triggers (`crossings` slot; the facts come from params only).
- DESIGN.md updates:
  - Overview redesign (the card anatomy, Continents in Crossings' slot, the pick model);
  - Motion (pick motions, the SlotText scope extension, the parallax);
  - Primitives (SegmentedControl dense);
  - Token roles (`--skeleton`);
  - Illustration (stamper, hangars, puzzle, the Rankings figure).

Dependencies: W2; the user's figure pick.

Focused proof: `vitest run src/client/overview/narrator src/client/overview/sections/rankings`; typecheck; lint.

Accept when: the primary has read the diff and the copy review against data facts is done.

## W4: Visual QA, reviews, fixes

Objective: Evidence that the build matches the boards, plus independent reviews resolved.

Implementation:

- Browser pass with the `dev-kuuki` skill and `agent-browser`:
  - Viewports 390×844 and 1440×900; light and dark; accents shu and ai, plus matcha on the charts.
  - Fixture: the dev fixture owner with at least 3 continents.
  - Scenarios: open each sheet; pick a bar; tap the figure; tap "Only …" and remove the Chip; swipe between chapters; loading (throttled); empty (filter to below the gate); reduced motion (emulated).
  - Screenshots go to `.scratch/chapter-cards/qa/`, downscaled with `sips -Z 1200`.
- One Opus (effort high) UI, design and motion review of the diff plus the screenshots.
- One GPT-6.1-Sol code review via `delegate_task` (providerInstanceId `codex`, model `gpt-6.1-sol`, `target.options {"reasoningEffort":"high"}`).
- Fix the accepted findings; the primary reads the full diff.

Accept when: the review findings are resolved or explicitly declined with a reason, and the final gate passes.

## Final evidence gate

Identity: final lanes validate the same immutable scoped patch identity: base `a531c0f9` plus the branch commits on `feat/chapter-cards` (record the head SHA and `git status --porcelain` empty).

| Lane       | Proves                      | Command or scenario                   | Success signal                                             | Parallel-safe                      |
| ---------- | --------------------------- | ------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| format     | formatting                  | `pnpm format:check`                   | exit 0                                                     | yes                                |
| types      | Next types                  | `pnpm --filter @kuuki/next typecheck` | exit 0                                                     | yes                                |
| lint       | tokens and transition rules | `pnpm --filter @kuuki/next lint`      | exit 0 (no new warnings)                                   | yes                                |
| unit       | behavior and contrast       | `pnpm test`                           | only the 4 baseline `recovery.test.tsx` failures, or fewer | yes                                |
| build      | Next build                  | `pnpm next:build`                     | exit 0                                                     | no (shares `.wrangler/next-build`) |
| navigation | shared controls in journeys | `pnpm test:next:navigation`           | exit 0                                                     | no (after build)                   |
| visual     | board match                 | the W4 browser scenarios              | screenshots reviewed                                       | no                                 |

Final acceptance (primary, serial):

- Every Decisions row is implemented or explicitly deferred to the user.
- No raw color literals in the new components or CSS.
- No load or idle animation.
- Reduced motion verified.
- Then report to the user and offer the CAS landing on `main`. No push or deploy.
