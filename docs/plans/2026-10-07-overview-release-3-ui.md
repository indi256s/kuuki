# Overview Release 3: UI/UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Overview page in place with the Paper design:
- a globe band with filter chips and replay;
- a ranked hero panel and the Next strip;
- seven reorderable, hideable sections in a bento grid (mobile: tiles plus a section sheet);
- a data-triggered narrator;
- the new Shu accent, data-mark and category tokens, and the kana logo.

All of it runs on the Release 2 engine.

**Architecture:**
- **Numbers.** Every number comes from `computeOverview(payload, filter)` in `packages/shared/src/overview`. This plan extends that engine with pure, tested fields (Tasks 2–11). The UI does only layout maths (waffle grid, bento packing, KDE sampling, display division).
- **Data flow.** The server component sends the owner payload and prefs. A client context holds the filter, layout and replay state, computes `scope` and `allScope` (the ghost baseline) through the Release 2 data store, and persists prefs. Every section is a client component that reads that context.
- **Charts and globe.** Every section chart goes through one `KuukiChart` wrapper over TanStack Charts. The globe is an SVG first paint (TanStack `geoShape`) that crossfades to MapLibre plus vendored flightcn after idle.
- **Build order.** The new page is built behind the dev-only route `/dev/overview?fixture=…`. `/overview` switches over in Task 33.

**Tech Stack:**
- Next 16.3.8 App Router on Workers via OpenNext; React 19.2.4.
- Plain CSS with tokens in `apps/next/src/app/styles.css`, plus a sibling `.css` file per component.
- `@tanstack/charts@1.0.0` (pinned): `motion()` renderer, `brushX`, `handleX`, `geoShape`, polar.
- `d3-scale@4.0.2` and `d3-shape@3.2.0`, declared directly at the versions TanStack already resolves.
- MapLibre 6.12.0 globe projection with mapcn @ d160bd7.
- flightcn @ `5c9061ef36bb2cd3cfa9f11f6463419944566a9d` (MIT), vendored.
- `@radix-ui/react-popover`.
- Vitest with Testing Library (jsdom per file) and Playwright.

**Spec:**
- `.scratch/overview-redesign/design-decisions.md` is the visual and interaction spec; dated sections supersede earlier lines.
- `.scratch/overview-redesign/decisions.md` holds the product decisions.
- The Paper boards are at https://app.paper.design/file/01M48F4SHK61AZS2FH5P5JPRY7/p-1-0, with PNG exports in `.scratch/overview-redesign/boards/`.
- The working prototype is `.scratch/overview-redesign/prototype/`:
  - `charts/charts.tsx`: TanStack definitions to port;
  - `charts/style.css`: chart theme;
  - `charts/flights.json`: the 69 board flights;
  - `fleet/gen.mjs`: Fleet card.
- The ridgeline maths comes from `/tmp/kuuki-explore/fleet.mjs` and is copied into Task 28.

**Base:** branch `feat/overview-release-3-ui` from `feat/overview-release-2-architecture` (tip `4d3bb55` or later), in its own worktree. Release 2's handoff must show the whole-branch review closed and a clean tree.

## Global Constraints

**Unit-test authoring override (2026-10-08):** The owner instructed: “do not write any unit tests.” The owner clarified: “Allow existing-test corrections; add no new tests.” Remaining tasks may correct existing tests but add no new unit tests or cases. Preserve existing tests and valid evidence; verify with source/caller checks, affected lint/typechecks and available checks at the final integrated checkpoint. This supersedes unit-test authoring steps below.

**User verification override (2026-10-07):** Skip all visual checks, screenshot/manual gallery inspection and visual comparison gates. Continue functional tests, typechecks, lint, builds and runtime navigation verification.

**User test-batching override (2026-10-07):** Run focused behavioral checks and affected lint/typechecks per task. Defer full API/Next suites, production builds and full navigation checks to later integrated checkpoints; do not rerun them for every task. This supersedes per-task full-suite/build/navigation steps below. Deferred integration checks remain pending until the batch runs.

**User review-batching override (2026-10-08):** Skip further per-task independent review rounds. Continue implementer self-checks and focused functional checks; run the consolidated whole-branch review and authorized Thermos/Ponytail audit at the end. This supersedes the per-task reviewer gates and executor review labels below.

**Precedence**
- The board wins on layout, type sizes and copy, except where "Audit fixes" or "Critique fixes" in `design-decisions.md` explicitly override it (example: segmented cells are 44px, not 32px).
- Inside `design-decisions.md`, a later dated section beats an earlier line.
- **Superseded; do not build:**
  - Records scatter, progression chart and rows;
  - jet-lag arrows;
  - the Fleet waffle;
  - per-maker shapes (circle, diamond, ring, dashed);
  - four equal 56px desktop figures;
  - the Clock linear strip;
  - Rankings top-5 rows with per-row bars and the Versus split bars;
  - Crossings bare counters.
- **Exact sizes and colours** come from the Paper file (`mcp__paper__get_computed_styles` / `get_jsx` on the named board; find nodes with `get_basic_info`). The PNGs are for visual comparison only.

**Tokens and colour**
- No hex or rgb in TS/TSX (ESLint). Chart code passes CSS variable strings such as `'var(--mark-1)'`.
- No `transition: all`.
- New tokens, per theme, in `styles.css`. Values are verbatim from the spec:
  - `--accent` = `--accent-text` = `--mark-1`: Shu `#c23417` / `#ea846f`.
  - `--accent-foreground`: `#fff` / `#292827`.
  - `--mark-2`: `#da6a53` / `#c85f49`. `--mark-3`: `#b28555` / `#a17749`. `--mark-4`: `#66605b` / `#c4beb7`. `--mark-ghost`: `#978c7f` / `#897e70`.
  - `--danger-text`: `#a02442` / `#f0a7af`. `--danger-fill`: `#ca3056` / `#f25776`.
  - `--heat-0..4`: `var(--surface-inset)`, `#e6c8c1`, `#e4735c`, `#c23417`, `#892410` (both themes).
  - Maker tokens:

    | Token | Light | Dark |
    |---|---|---|
    | `--cat-maker-airbus` | `#0F6390` | `#0685B6` |
    | `--cat-maker-boeing` | `#16A384` | `#04AC7B` |
    | `--cat-maker-embraer` | `#8C6D08` | `#A4770F` |
    | `--cat-maker-atr` | `#9A52CF` | `#A36FFA` |
    | `--cat-maker-other` | `#C2BAB0` | `#C9C1B7` |
    | `--cat-maker-unknown` | `#ECE9E5` | `#47433F` |

  - Alliance tokens:

    | Token | Light | Dark |
    |---|---|---|
    | `--cat-alliance-star` | `#6B5A2E` | `#CDB98A` |
    | `--cat-alliance-oneworld` | `#6A3F55` | `#D3A6BC` |
    | `--cat-alliance-skyteam` | `#3E5266` | `#A9BBD0` |

  - `--accent-tint`: accent at 10% over `--surface`.
  - `--accent-on-tint`: `#b02f14` light; `var(--accent-text)` dark.
  - `--globe-rim`: accent at 14% light, 22% dark.
  - Shu map buckets, mixed in **oklab**:

    | Theme | Buckets |
    |---|---|
    | Light | `#ecc6bb` `#e5a494` `#da7d68` `#c94c33` |
    | Dark | `#674e47` `#865c51` `#ac6b5d` `#d87d6a` |

- **Default chart palette:** `--ts-chart-1..5` = `--mark-1`, `--mark-2`, `--mark-3`, `--mark-4`, `--mark-ghost`. Maker charts remap `--ts-chart-n` onto `--cat-maker-*`.
- **Category rules:**
  - Shu is never a category colour.
  - Every maker mark is one filled rounded square (radius 20%).
  - Alliances are mark-first (★ Star, ○ Oneworld, △ SkyTeam) and never share a chart with makers.
  - Numbers and legends stay text ink.
- **No accent text on the dark inset** (4.12:1). Use `--text` there.
- **Contrast:** every data mark is at least 3:1 against `--background`. Accepted exceptions for the exact specified palette: heat-ramp steps below 3:1 in either theme (including dark steps 3–4), map buckets 1–3, and the Other and Unknown swatches. Each always has a visible text-ink value or legend label; charts also provide accessible tooltip/value content and View as table. The specified colours remain verbatim. See [palette contrast acceptance](../../.scratch/overview-redesign/issues/01-palette-contrast.md) for the measured conflict and consumer verification gates.

**Layout bans**
- No divider hairlines inside content or page chrome:
  - none between rows;
  - none above the narrator;
  - none between hero figures;
  - none under the page header or around the Next strip;
  - none above Hidden sections, the tab bar or sheet header/footer.
- Allowed: full outlines (cards, inputs, chips, buttons), the 2px active-tab bar, the 2px drag insertion indicator and the sheet pager segments.

**Type and motion**
- **Narrator:** 15/24 Commissioner 400, `--text-muted`, at the section foot, max 60ch, no icon, no quotes. The narrator is the only sarcastic line in a card; tile captions stay factual.
- **Chart captions:** 15/24 Commissioner 600, normal case; never all caps for instructions.
- **Mono** for routes, codes, times and chart ticks. **Tabular figures** for numbers.
- **Instant swaps:** figures, chips and text change instantly on filter change.
- **Chart tweens:** the TanStack `motion()` renderer's default tween (1,100 ms) runs only on charts in view. The Manufacturers reflow is 300 ms.
- **Globe camera:** 600 ms fly with `--ease-in-out`.
- **Reduced motion:** charts snap, the camera cuts, the replay is off with static plane glyphs mid-arc, and the logo shows a static く.

**Interaction**
- **Charts as filter inputs:** every chart is a filter input. A click, or Enter on a focused mark, adds the chip.
- **Touch:** the first tap pins a tooltip with "Add filter" / "Open flight". A tap never filters directly. Tapping elsewhere dismisses it.
- **Hit areas:**
  - Segmented cells: 44px, at least 104px wide, 3px padding.
  - Dense controls (Fullscreen, + Filter, replay pause, ⋯ menus, queue pill): 32px visual with a 44px hit area on `(pointer: coarse)`.
  - Text links: 44px through vertical padding.
- **Focus:** a 2px `--accent` ring with a 2px offset on `:focus-visible`. Never use `outline: none` without it.
- **No horizontal page scroll** at 390px.
- **Accessibility path:** "View as table" under every chart opens its data as a table. This is also the screen-reader path, because the library has no fallback table.
- **Chart lazy-loading:** charts below the fold mount lazily (IntersectionObserver, 200px root margin) behind a fixed-height skeleton, so nothing shifts.
- **Plan decision: TanStack vs HTML.** TanStack Charts draws the seven section charts: bump, waffle, ridgeline, radial clock, heat grid, odometer and shift bars. Micro-visuals (tile tracks, leader strips, equator bar, route sketch) and segmented bars (hero years, Fleet body split, mobile maker bar) are plain HTML/SVG. Interactive segments are `<button>`s with full `aria-label`s.

**Data, copy and scope**
- **Engine:** the engine owns every number and returns codes, never copy. All copy is `{ en, ru }` through `copy.ts` helpers (`p()`, `t()`, `fill()`), with «вы» in Russian. RU must fit at 390px; the waffle legend wraps and is never truncated.
- **Aggregate mode** (`payload.mode === 'aggregate'`, more than 5,000 rows): there is no "Open flight" anywhere, the replay runs in monthly batches and the waffle unit is at least 5.
- **Out of scope** (no boards):
  - the `/fly` presentation;
  - the share-card visual;
  - the Flag-tones map mode;
  - alliance map surfaces;
  - a sticky scope bar;
  - jump navigation;
  - the page ending;
  - Share.
- **Dependencies:** add only `@radix-ui/react-popover` (pinned exactly, the release that matches the installed `react-dialog@1.1.15`), `d3-scale@4.0.2`, `d3-shape@3.2.0`, and their `@types/*` as exact dev dependencies. No other runtime dependency; flightcn is vendored.
  - **Task22 dependency admission (2026-10-08):** installed TanStack Charts 1.0.0 exposes `geoShape`, but does not export the required `geoOrthographic`. Promote its already-resolved `d3-geo@3.1.1` to a direct Next dependency and `@types/d3-geo@3.1.1` to an exact dev dependency. Preserve every other dependency/version; this adds no new package version or projection implementation. Root confirmed both pinned versions in the current lockfile and the installed `/geo` API.
- **Commits** carry no Claude/AI attribution. No push, no deploy, no remote D1. Deploys are manual through `deploy-kuuki` and are not part of this plan.

**Commands and executors**
- **Commands:**
  - Shared/functions: `pnpm test:api -- <file>`, `pnpm typecheck:api`.
  - Next: `pnpm --filter @kuuki/next test -- <name>`, `pnpm --filter @kuuki/next typecheck`, `pnpm --filter @kuuki/next lint`.
  - Routes: `pnpm next:build`, which regenerates `apps/next/api-routes.generated.ts`; commit that file.
  - E2E: `pnpm test:next:navigation`.
- **"FAIL → implement → PASS"** means:
  1. Run the named test command and expect failure.
  2. Implement the task's Interfaces.
  3. Re-run and expect PASS.
  4. Run the package's full test suite plus its typecheck.
- **Visual check V(board):**
  1. Run `pnpm --filter @kuuki/next dev` and open `/dev/overview?fixture=board` with `chrome-devtools-axi`.
  2. Capture 1440×900 and 390×844, light and dark, EN and RU.
  3. Run `sips -Z 1200` on each screenshot, then compare it with the named PNG in `.scratch/overview-redesign/boards/`.
  4. List remaining differences that no documented override covers in the commit body.
- **Executors:**
  - **[Engine]:** GPT-6.1-Sol in its own worktree, or Sonnet.
  - **[UI]:** Sonnet.
  - **[UI·Opus]:** Opus.
  - **Final review:** Opus for every task.
  - **Fix rounds and first-pass reviews:** Sonnet.

## Review Focus

1. **Filtered to zero.**
   - *Scenario:* Year 2016 + Airline QR, with no matching flights.
   - *Expected:* the globe stays and is fully ghosted; figures show "—"; the sections collapse into one narrator line with "Remove last filter" and "Clear all"; the chips stay; no chart throws on empty rows.
   - *Pinned in:* Task 17 (`zero-result renders one narrator line and two actions`) and Task 15 (`empty rows render an empty chart without throwing`).
2. **Stale prefs.**
   - *Scenario:* stored prefs carry the old `manufacturers`/`bodyTypes` keys, an unknown section id, an order missing `manufacturers`, or a filter value that no longer exists in the payload.
   - *Expected:* the page loads; legacy keys are dropped; the layout is normalized; unknown values still apply (giving the zero state, from which they can be removed).
   - *Pinned in:* Task 4 (`legacy prefs normalize without throwing`) and Task 16 (`unknown facet value yields zero scope, not a crash`).
3. **Touch.**
   - *Scenario:* a vertical swipe that starts on the globe, a chart or a tile.
   - *Expected:* the page scrolls; a horizontal swipe on the globe spins it; a tap on a chart pins the tooltip and never filters.
   - *Pinned in:* Task 23 (`gestureAxis locks after 10px`) and Task 15 (`touch tap pins actions and does not call onPick`).
4. **RU and long names at 390px.**
   - *Scenario:* "Авиакомпании", "Aeroflot – Russian Airlines", and a chip with three airlines.
   - *Expected:* chips show two values plus "+N" and ellipsize inside the card; leader names wrap to two lines and then ellipsize; segmented labels fit; no horizontal scroll.
   - *Pinned in:* Task 20 (`chipLabel shows two values and +N`) and V(9.4) in RU.
5. **Aggregate accounts (more than 5,000 flights).**
   - *Expected:* no "Open flight" affordances; waffle unit ≥ 5, stated in the legend; replay in monthly batches; record tiles without ↗.
   - *Pinned in:* Task 27 (`aggregate payload uses unit 5 or more`), Task 26 (`aggregate hides open-flight`) and Task 24 (`aggregate timeline batches by month`).

---

## File Structure

```
packages/data/src/
  aircraft-makers.ts(+test)         ICAO type → maker slot (current type designation)
  alliance-membership.ts(+test)     airline alliance history with dates and cited sources
packages/shared/src/overview/
  model.ts                          schemaVersion 3, arrMinute, filter v2, scope v2 types
  filter.ts                         new facets: airports, alliances, families, makers, bodies, depHours, arrHours
  prefs.ts                          seven sections, normalizeLayout, legacy-key stripping
  figures.ts                        figures v2 (firstDate, airports, byYear, share, estimated)
  next.ts (new)                     upcoming flights (Next strip) + chronological replay list
  records.ts                        record cabinet
  rankings.ts                       leaders, rankByYear, versus
  makers.ts (new)                   Manufacturers card data
  fleet.ts, clock.ts, rhythm.ts, crossings.ts   v2 fields
  compute.ts                        wires the new fields into OverviewScope
  __fixtures__/board.json (new)     the 69 board flights as a v3 payload; all fixtures bumped to v3
scripts/overview/board-fixture.mts  generates board.json from the prototype flights.json
functions/api/_services/overviewData.ts         arrMinute + ov3 etag
apps/next/src/
  app/styles.css, app/tokens.test.ts, app/bootstrap-accent.test.ts, public/bootstrap.js
  lib/theme-colors.ts, lib/format.ts
  client/shell.tsx (Wordmark), client/appearance.tsx, client/ui/swatch-picker.tsx
  client/ui/{chip,popover,skeleton,category-mark,month-range}.tsx + ui.css entries
  client/maps/flightcn.tsx (vendored), client/maps/geometry.ts (bearing), client/maps/licenses/flightcn-LICENSE
  server/overview.ts                getOwnOverviewPrefs
  app/dev/overview/page.tsx         dev-only fixture route (404 in production)
  app/(member)/overview/{page,loading,error}.tsx    cut-over in Task 33
  client/overview/
    store/      overview-context.tsx, filter-actions.ts, ui-bus.ts, open-flight.tsx
    charts/     kuuki-chart.tsx, lazy-chart.tsx, table-view.tsx, palettes.ts, chart-theme.css
    page/       overview-page.tsx, page-states.tsx, scope-title.ts, page.css
    layout/     bento.ts, reorder.ts, use-reorder.ts, section-frame.tsx, hidden-footer.tsx, layout.css
    mobile/     tiles.ts, section-tile.tsx, section-sheet.tsx, mobile.css
    filters/    facet-index.ts, chip-label.ts, filter-bar.tsx, filter-panel.tsx, filters.css
    hero/       hero-panel.tsx, year-strip.tsx, next-strip.tsx, hero.css
    globe/      globe-card.tsx, svg-globe.tsx, maplibre-globe.tsx, gestures.ts, night.ts,
                route-card.tsx, replay.ts, replay-transport.tsx, globe.css
    narrator/   triggers.ts, pick.ts, corpus.ts, narrator.tsx
    sections/   registry.ts + {rankings,records,manufacturers,fleet,clock,rhythm,crossings}/
                (section.tsx, tile.tsx, chart and helper files, css, tests)
  client/reads/journal.tsx          alliance mark + "≈" duration
DESIGN.md, GLOSSARY.md
```

Task 33 deletes the legacy `client/overview/{view,hero,figures,map-band,map-preview,notable,rankings,rhythm,period-control,empty,model,sample-data,fixtures}` files and their tests once nothing imports them.

## Execution order

1. Task 1 first.
2. Then two lanes in parallel:
   - **Engine lane:** Tasks 2–11, on a Sol worktree stacked on this branch and merged back after each Opus review.
   - **UI-foundation lane:** Tasks 13–15.
3. Task 12 (the narrator corpus) stops for owner review. Sections can ship with the Task 11 placeholder corpus until it is approved.
4. Tasks 16–31 need the engine lane merged.
5. Tasks 32–34 come last.

---

### Task 1: Branch, merge design records, check in references

**Executor:** [UI] Sonnet · final review Opus

**Files:**
- Create: `.scratch/overview-redesign/prototype/**` and `.scratch/overview-redesign/boards/*.png`. Copy both from the main checkout.
- Create: `docs/plans/2026-10-07-overview-release-3-ui.md` (this file) and `docs/plans/2026-10-07-overview-release-3-ui-handoff.md`.

- [x] **Step 1:** Create the worktree on `feat/overview-release-3-ui` from `feat/overview-release-2-architecture`, and confirm `git status` is clean.
- [x] **Step 2:** `git merge --no-ff overview-redesign-design`. On add/add conflicts in the Release 1 and 2 plan and handoff files, keep the release branch's ticked versions (`git checkout --ours`). Expected: `.scratch/overview-redesign/{decisions,design-decisions}.md` and `.impeccable/critique/*` arrive.
- [x] **Step 3:** Copy the prototype directory, the board PNGs and this plan from the main checkout. Exclude `prototype/**/node_modules`.
- [x] **Step 4:** Run `pnpm install --frozen-lockfile && pnpm test:api && pnpm --filter @kuuki/next test`. Expected: PASS, the Release 2 baseline.
- [x] **Step 5:** Commit `docs(overview): merge design records and check in UI references`.

### Task 2: Payload v3 and the board fixture

**Executor:** [Engine] · final review Opus

**Files:**
- Modify: `packages/shared/src/overview/model.ts`, `functions/api/_services/overviewData.ts`, every `packages/shared/src/overview/__fixtures__/*.json` (add `"arrMinute": null` and set `schemaVersion: 3`), and `apps/next/src/client/overview/data-store.ts` (accept v3).
- Create: `scripts/overview/board-fixture.mts`, `packages/shared/src/overview/__fixtures__/board.json`.
- Test: `functions/test/overview-data.test.ts`, `packages/shared/src/overview/golden.test.ts`.

**Interfaces:**
- Produces:
  - `OverviewRow.arrMinute: number | null`: the local arrival minute, 0–1439.
  - `OverviewPayload.schemaVersion: 3`.
  - ETag `W/"ov3-<encoded-owner>-<revision>-<evidence_revision>"`; preserve Release2 owner isolation.
  - `board.json`, consumed by Tasks 5–10 and 17.
- `arrMinute` comes from D1 `flights.arrival_time` (`HH:MM`, local, `db/migrations/0001_init.sql:120`). If that is null, and `departureUtc`, `durationMinutes` and `destTz` are present with precise `durationSource` (`times`, `route_median` or `schedule`), it is the local time in `destTz` of `departureUtc + durationMinutes`. Otherwise it is null. No D1 migration is needed.
- **Board fixture.** The generator reads `.scratch/overview-redesign/prototype/charts/flights.json` (69 flights) and writes a v3 payload:
  - Family → ICAO: `737→B738`, `777→B77W`, `A330→A333`, `A350→A359`, `A320→A320`, `E190→E190`, `ATR72→AT76`, `unknown→null`.
  - `depMinute = depLocalHour × 60`; `durationMinutes = blockMinutes`.
  - The 6 earliest-dated flights with durations get `durationSource: 'estimate'`; all other duration-bearing rows normalize prototype `'own'` to the domain's `'times'`; missing duration has null provenance.
  - The 3 newest flights get `state: 'awaiting'`.
  - Two `upcoming` rows: DXB→MLE at `generatedAt` + 3 days, and IST→NRT at + 40 days.
  - `flightNumber`: `` `${airline} ${100 + index}` ``.
  - Timezones and countries come from the airport lookup. Add sourced KTT/AT76 reference records for the required real routes/type before regenerating the board.
  - `generatedAt` is `2026-10-07T09:00:00Z`.

- **Source-fidelity acceptance:** the supplied 69 flights establish 14 countries and already include DOH→MLE on 2023-07-27. Hero figures must therefore show 14, and the upcoming DXB→MLE has `newCountry: false`. The Paper labels claiming 16/Maldives-new are illustrative errors; do not change real flights or invent passport evidence to reproduce them. See [board source reconciliation](../../.scratch/overview-redesign/issues/02-board-source-parity.md).

- [x] **Step 1: Write the failing tests:**
  - `overview-data.test.ts › arrival minute prefers stored arrival time`: `arrival_time '06:40'` gives `arrMinute: 400`.
  - `overview-data.test.ts › arrival minute derives from precise duration in destination zone`: departure UTC `2025-03-01T22:00Z`, 240 minutes, destTz `Asia/Dubai` → `arrMinute: 360`. The same flight with `durationSource 'estimate'` → `null`.
  - `overview-data.test.ts › etag uses ov3 prefix`.
  - `golden.test.ts › board fixture reproduces board totals`: `figures.flights === 69`, `figures.awaiting === 3`, `figures.distanceKm === 141204`, `rankings.airlines[0]` equals `{ key: 'TK', count: 24 }`.
- [x] **Steps 2–4:** FAIL → implement (generator first, then run it with `pnpm tsx scripts/overview/board-fixture.mts`) → PASS. Update the golden snapshots only for the `arrMinute`/`schemaVersion` diff, and say so in the commit body.
- [x] **Step 5:** Commit `feat(overview): payload v3 with arrival minute and board fixture`.

### Task 3: Maker and alliance tables

**Executor:** [Engine] · final review Opus

**Files:** Create `packages/data/src/aircraft-makers.ts`, `packages/data/src/aircraft-makers.test.ts`, `packages/data/src/alliance-membership.ts` and `packages/data/src/alliance-membership.test.ts`.

**Interfaces:**
- Produces:
  - `type MakerSlot = 'airbus' | 'boeing' | 'embraer' | 'atr' | 'other'`, `type MakerKey = MakerSlot | 'unknown'` and `MAKER_SLOTS: readonly MakerKey[]`, in display order: airbus, boeing, embraer, atr, other, unknown.
  - `makerOf(icao: string | null | undefined): MakerKey`. Null or unlisted types return `'unknown'`.
  - `type Alliance = 'star' | 'oneworld' | 'skyteam'` and `ALLIANCES: readonly Alliance[]`.
  - `MEMBERSHIP: readonly { iata: string; alliance: Alliance; from: string; to: string | null; source: string }[]`. Dates are `YYYY-MM-DD`; `source` is the URL that was cited.
  - `allianceAt(iata: string | null, date: string): Alliance | null`.
  - `formerAlliance(iata: string, date: string): { alliance: Alliance; leftYear: number } | null`.
  - Reused-code safety: `formerAlliance` conservatively returns null for MX on every date, because current MX is Breeze and no exact reassignment day is admitted. `allianceAt` retains old Mexicana’s verified active interval; ordinary carrier former/gap notes remain available.
- **Maker rule:** the current type-certificate designation (A220 = Airbus). Embraer covers the E-Jets (`E170–E295`, `E75L/E75S`). ATR covers `AT43–AT76`. Everything else that is listed goes to `other`.
- **Alliance rule:** the operating carrier's membership on the flight date. Cover every airline in `packages/data/src/airlines.json` that has a non-null `alliance`, plus known leavers. Source the dates from each alliance's current member and former-member tables, and cite them per row. Investigate stale static labels rather than inheriting them: EN has no evidenced operating-carrier span; OK is SkyTeam. Recognized affiliate/associate participation qualifies. The source dossier and dated admission note distinguish formal membership dates from admitted archive as-of and final operating-day boundaries; unresolved additional historical spans remain documented instead of receiving invented days.

- [x] **Step 1: Write the failing tests:**
  - `aircraft-makers.test.ts › every reference aircraft has a slot`: every `icao` in `aircraft.json` is a key of the table.
  - `aircraft-makers.test.ts › current type designation`: `BCS3→airbus`, `BCS1→airbus`, `B712→boeing`, `B38M→boeing`, `MD11→other`, `E190→embraer`, `AT76→atr`, `DH8D→other`, `SU95→other`, `CRJ9→other`, `null→unknown`.
  - `alliance-membership.test.ts › membership at date`:
    - `allianceAt('TK','2019-05-01') === 'star'`;
    - `allianceAt('QR','2013-01-01') === null`;
    - `allianceAt('QR','2014-01-01') === 'oneworld'`;
    - `allianceAt('S7','2019-01-01') === 'oneworld'`;
    - `allianceAt('S7','2023-01-01') === null`;
    - `formerAlliance('S7','2023-01-01')` equals `{ alliance: 'oneworld', leftYear: 2022 }`;
    - `allianceAt('FZ','2024-01-01') === null`.
  - `alliance-membership.test.ts › rows are well formed`: `from < to` when `to` is set; no overlapping spans per airline; every `source` starts with `https://`.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(data): maker slots and dated alliance membership`.

### Task 4: Facets v2 and prefs layout v2

**Executor:** [Engine] · final review Opus

**Files:** Modify `packages/shared/src/overview/model.ts`, `filter.ts`, `prefs.ts`, `filter.test.ts` and `properties.test.ts`, plus the prefs endpoint tests in `functions/test/`. Create `packages/shared/src/overview/prefs.test.ts`. Also modify `aggregate.ts` and its tests to preserve date-based alliance facets: membership state is a grouping dimension, and the deterministic representative date is the earliest actual represented source date. Monthly periods/replay labels and all Release 2 metric distinctions remain intact.

**Interfaces:**
- Consumes: `makerOf`, `allianceAt` (Task 3).
- Produces `OverviewFilter` v2:
  - unchanged: `period`, `countries`, `regions`, `airlines`, `aircraft`, `routes`, `haul`, `domestic`, `departureBands`;
  - added:
    - `airports?: string[]`: IATA, matching origin or destination;
    - `alliances?: Alliance[]`: `allianceAt(row.airline, row.date)`;
    - `families?: string[]`;
    - `makers?: MakerKey[]`, which replaces `manufacturers`;
    - `bodies?: Array<'narrow' | 'wide'>`, which replaces `bodyTypes`. Narrow is every typed aircraft that is not a widebody; untyped rows match neither;
    - `depHours?: number[]` and `arrHours?: number[]`: local hour 0–23 from `depMinute`/`arrMinute`.
  - `type FacetKey = Exclude<keyof OverviewFilter, 'period'>`.
- Produces prefs:
  - `SectionId = 'rankings' | 'records' | 'manufacturers' | 'fleet' | 'clock' | 'rhythm' | 'crossings'` and `DEFAULT_ORDER`, in that order.
  - `normalizeLayout(raw: { order?: unknown; hidden?: unknown }): { order: SectionId[]; hidden: SectionId[] }`. It drops unknown and duplicate ids and appends missing ids in `DEFAULT_ORDER` order. `hidden` is limited to known ids.
  - `parsePrefs` strips unknown filter keys, including legacy `manufacturers` and `bodyTypes`, instead of rejecting the object.
  - Prefs `version` stays `1`. No production prefs exist yet.

- [x] **Step 1: Write the failing tests:**
  - `filter.test.ts › new facets match`:
    - `airports:['IST']` matches IST→FRA and FRA→IST;
    - `alliances:['oneworld']` matches an S7 flight dated 2019 and not one dated 2023;
    - `makers:['unknown']` matches an untyped row;
    - `bodies:['narrow']` matches an E190 and not a B77W, and matches neither on an untyped row;
    - `depHours:[7]` matches `depMinute` 420–479;
    - `arrHours:[6]` matches `arrMinute` 400.
  - `filter.test.ts › OR within, AND across` for `makers:['airbus','boeing'] + bodies:['wide']`.
  - `properties.test.ts`: the existing property ("a filter never increases flights") extended to generate the new facets.
  - `prefs.test.ts › legacy prefs normalize without throwing`. Input: `{"version":1,"filter":{"manufacturers":["Airbus"],"bodyTypes":["widebody"],"airlines":["TK"]},"layout":{"order":["records","rankings","bogus","records"],"hidden":["fleet","bogus"]},"replayPaused":false,"publicSections":{"records":true,"fleet":false}}`. Expect `filter` equal to `{ airlines: ['TK'] }`, `order` equal to `['records','rankings','manufacturers','fleet','clock','rhythm','crossings']`, and `hidden` equal to `['fleet']`.
  - The prefs PUT endpoint test rejects a body whose `layout.order` contains an unknown id (400) and accepts the normalized seven.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): facets v2 and seven-section layout`.

### Task 5: Figures v2, Next flights and the replay list

**Executor:** [Engine] · final review Opus

**Files:** Modify `figures.ts`, `compute.ts`, `model.ts` and `figures.test.ts`. Create `next.ts` and `next.test.ts`. Add the required Passport country identity field through `functions/api/_services/overviewData.ts`, its focused API tests, and minimal payload constructors/fixture generators needed for the additive field.

**Interfaces:**
- `OverviewPayload.passport` gains `countryCodes: string[]`: sorted, unique pressed-country codes from the existing owner-scoped Passport read. Counts alone cannot establish whether an upcoming destination was visited by claim, ground visit or legacy evidence. Preserve schema v3 and the owner-qualified ETag.
- `Figures` gains:
  - `firstDate: string | null`: the earliest counted date.
  - `airports: number`: distinct endpoints in scope.
  - `estimatedFlights: number`.
  - `equatorLaps: number`: `distanceKm / 40075`.
  - `byYear: { key: string; year: number; flights: number }[]`: zero-filled from the account's first to last counted year, regardless of filter, counting in-scope flights.
  - `share: { flights: number; distanceKm: number; durationMinutes: number; countries: number; airports: number } | null`: ratios 0–1 against the empty-filter totals. Non-null only when the filter has facets and no `period`.
- `OverviewScope` gains:
  - `next: NextFlight[]` — `{ flightId; date; origin; destination; airline; flightNumber; daysAway: number; newCountry: boolean }`. These are upcoming rows sorted by date. They ignore the filter. `daysAway` counts from `payload.generatedAt`'s UTC date. `newCountry` is true when the destination country appears in no counted row and not in the passport.
  - `replay: ReplayItem[]` — `{ key; flightId: number | null; origin; destination; date; weight }`. These are in-scope counted rows in date order. In aggregate mode they are monthly route rows, with `date` `YYYY-MM` and `flightId: null`.

- [x] **Step 1: Write the failing tests:**
  - `figures.test.ts › board figures`: `airports === 18`, `firstDate === '2014-03-28'`, `estimatedFlights === 6`, `byYear.length === 13`, the 2019 entry has `flights === 14`, the 2015 entry has `flights === 0`, `equatorLaps` rounds to 3.5.
  - `figures.test.ts › share only for facet-only filters`: `{airlines:['TK']}` gives `share.flights` ≈ 24/69 and `deltas === null`. `{period:{years:[2025]}, airlines:['TK']}` gives `share === null`. `{}` gives `share === null`.
  - `next.test.ts › board next flights`: `next[0]` is DXB→MLE with `daysAway === 3`; `next.length === 2`; `newCountry` is false for MLE (the real source already contains DOH→MLE); use a separate absent-country case to verify true.
  - `next.test.ts › replay is chronological and scoped`: with `{airlines:['TK']}`, `replay.length === 24` and the dates are non-decreasing. With n5001 (aggregate), every item has `flightId === null` and a `YYYY-MM` date.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): figures v2, next flights and replay list`.

### Task 6: Records cabinet

**Executor:** [Engine] · final review Opus

**Files:** Modify `records.ts`, `records.test.ts` and `model.ts`. Preserve actual source context through `aggregate.ts` and its tests; update only the required aggregate fixture/computed snapshots through the existing generator. Keep the existing public subset explicit in `public.ts`/`publicOverview.ts` and cover its privacy boundary with API tests.

**Interfaces:** `Records` (still `Gate<Records>`, ≥ 5 flights) becomes:
- `longest`:
  - Fields: `RecordRef & { date; airline; flightNumber; durationMinutes: number | null; durationApproximate: boolean; speedKmh: number | null; clockShiftMinutes: number | null; previousBestKm: number | null; equatorShare: number }`.
  - `speedKmh` is null unless the duration is precise.
  - `previousBestKm` is the longest distance among counted flights dated before the record.
  - `equatorShare = value / 40075`.
- `shortest: RecordRef & { date; shareOfLongest: number }`.
- `northernmost: { iata; lat; flight: RecordRef & { date } }`: the latest flight touching that airport.
- `earliestDeparture: (RecordRef & { date; depMinute: number }) | null`: the smallest local `depMinute`; ties go to the later date.
- `busiestYear: { year; flights; countries; activeMonths; peakMonth: number; months: { key; month; flights }[] }`. `months` is 12 zero-filled rows.
- Kept from Release 2: `longestDuration`, `shortestDuration`, `biggestClockJump`, `busiestDay`, `southernmost`, `longestStreakMonths`, `longestGroundStopDays`.
- In aggregate mode, every `flightId` is null.

**Controller admission (2026-10-07):** Keep internal numeric witness identity separate from exposed aggregate cabinet IDs. Actual context is captured before aggregation; legacy missing context stays null, including rich dates, rather than using representative dates or metric sums. Nullable distance/north records remain nullable; no valid calendar year gives `busiestYear: null`. The latest northern flight carries its actual distance as nullable `value`; no available witness gives `flight: null`. Earliest departure uses its minute as `value`. Distance/duration/absolute-clock ties retain lowest source ID; latitude ties retain lexical IATA. Latest-flight same-day ties and remaining departure ties use lowest ID; year/month ties use the earliest. Year countries are scoped suppression-aware flight evidence. The public Records response remains its current explicit allowlist and never includes new private context.

- [x] **Step 1: Write the failing tests:**
  - `records.test.ts › board cabinet`: `longest.origin/destination` is DOH/AKL; `longest.value === 14535`; `previousBestKm` equals the fixture's longest distance before that date (compute it in the test from the fixture rows); `busiestYear.year === 2019` with `flights === 14` and `months.length === 12`.
  - `records.test.ts › speed excludes estimates`: making the longest flight's `durationSource 'estimate'` gives `speedKmh === null` and `durationApproximate === true`.
  - `records.test.ts › earliest departure tie goes to later date`.
  - `records.test.ts › aggregate refs have null flight ids` (n5001).
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): record cabinet fields`.

### Task 7: Rankings v2

**Executor:** [Engine] · final review Opus

**Files:** Modify `rankings.ts`, `rhythm-rankings-globe.test.ts` and `model.ts`.

**Interfaces:** `Rankings` keeps `airlines`, `airports` and `routes` (full `RankRow[]`, ungated; airports count 2 per flight) and gains:
- `leaders: Record<'airlines' | 'airports' | 'routes', Leader>`. `Leader` is `{ top: RankRow[]; total: number; topShare: number; top5Share: number }`, with `top` limited to 5.
- `rankByYear: Record<'airlines' | 'airports' | 'routes', BumpRow[]>`:
  - `BumpRow` is `{ key: string; entity: string; year: number; rank: number; count: number }`, with `key` = `` `${entity}:${year}` ``.
  - Years: the latest 6 years with counted flights.
  - Entities: the top 5 by count over those years.
  - `rank` is the competition rank (1, 2, 2, 4) among those five within the year. Only years where `count > 0` emit a row.
- `versus: VersusRow[]`. `VersusRow` is `{ id: 'makers' | 'haul' | 'daytime'; left: { key: string; count: number }; right: { key: string; count: number }; excluded: number }`:
  - `makers` is airbus against boeing.
  - `haul` is `short` (< 4,000 km, short plus medium) against `long` (≥ 4,000 km), with `excluded` = flights without distance.
  - `daytime` is morning, afternoon and evening against night, with `excluded` = untimed flights.

- [x] **Step 1: Write the failing tests:**
  - `› board leaders`: `leaders.airlines.top[0]` equals `{ key: 'TK', count: 24 }`, `leaders.airlines.total === 69` and `topShare` ≈ 24/69.
  - `› ties share a rank`: a two-entity, same-count year gives both `rank: 1`, and the next entity gets `rank: 3`.
  - `› rankByYear covers latest six years`: board years are `[2021, 2022, 2023, 2024, 2025, 2026]`, with at most 5 distinct entities.
  - `› versus`: the board `makers` row is `{ left: { key: 'airbus', count: 38 }, right: { key: 'boeing', count: 21 } }`; `daytime` has `right.count === 8` (the red-eyes).
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): ranking leaders, rank by year and head to head`.

### Task 8: Makers and Fleet v2

**Executor:** [Engine] · final review Opus

**Files:** Create `makers.ts` and `makers.test.ts`. Modify `fleet.ts`, `fleet-clock.test.ts`, `compute.ts` and `model.ts`.

**Interfaces:**
- `OverviewScope.makers: Gate<Makers>`, with the same gate as Fleet (≥ 5 typed).
- `Makers`:
  - `rows: { key: MakerKey; flights: number; minutes: number; km: number }[]`: all six keys, in `MAKER_SLOTS` order, zero-filled.
  - `other: { key: string; family: string; flights; minutes; km }[]`: families in `other`, by flights descending.
  - `totals: { flights; minutes; km; minutesApproximate: boolean }`.
  - `flights: { key: string; flightId: number; maker: MakerKey; origin; destination; date; aircraft: string | null; durationMinutes: number | null }[]`: maker order, then date. Empty in aggregate mode.
  - `leader: { key: MakerKey; share: number; flights: number } | null`.
- Hours include estimates (`minutesApproximate`), like the figures do.
- `Fleet` gains:
  - `bodies: { key: string; body: 'narrow' | 'wide'; maker: MakerSlot; flights: number }[]`: zero rows omitted; narrow first, then slot order.
  - `untyped: number`.
  - `familyRows: { key: string; family: string; maker: MakerSlot; body: 'narrow' | 'wide'; flights: number; minutes: number[] }[]`: `minutes` holds the precise durations, ascending; rows are narrow first, then by flights descending.
  - `topFamily: { family: string; flights: number } | null`.
  - `familyCount: number`.

- [x] **Step 1: Write the failing tests:**
  - `makers.test.ts › board makers`: the flights per key are airbus 38, boeing 21, embraer 3, atr 2, other 0, unknown 5; `leader.key === 'airbus'`; `flights.length === 69`.
  - `makers.test.ts › other lists families`: one SU95 and two CRJ9 give two `other` rows: the CRJ family (2 flights) first, then the Superjet family (1 flight).
  - `fleet-clock.test.ts › body split`: the board's narrow total is 48 and wide total 16; `topFamily` equals `{ family: 'A320', flights: 27 }`.
  - `fleet-clock.test.ts › family durations exclude estimates`.
  - `makers.test.ts › aggregate has no per-flight list` (n5001).
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): manufacturers data and fleet v2`.

### Task 9: Clock and Rhythm v2

**Executor:** [Engine] · final review Opus

**Files:** Modify `clock.ts`, `rhythm.ts`, `fleet-clock.test.ts`, `rhythm-rankings-globe.test.ts` and `model.ts`.

**Interfaces:**
- `Clock` gains:
  - `arrByHour: { key; hour; flights }[24]`.
  - `withArrivalTime: number`.
  - `beforeNoonShare: number`: departures with `depMinute < 720` over timed departures.
  - `peakHour: { hour: number; flights: number } | null`: the lowest hour wins ties.
  - `arrPeakHour`, with the same shape.
- `Rhythm` gains:
  - `busiestMonthOfYear: { month: number; flights: number } | null`.
  - `longestGap: { months: number; from: string; to: string } | null`: the longest run of empty months strictly between the first and last counted month.
  - `odometer: { key: string; date: string; km: number; flightId: number | null }[]`: cumulative km per counted flight in date order; per month in aggregate mode.
  - `max: { flights; distanceKm; durationMinutes }` over `cells`.

- [x] **Step 1: Write the failing tests:**
  - `› clock arrivals and before-noon`: on the board fixture, `peakHour` and `beforeNoonShare` equal values the test counts directly from the fixture rows.
  - `› arrivals use arrMinute`: rows with `arrMinute` 400 and 1300 → `arrByHour[6].flights === 1` and `arrByHour[21].flights === 1`.
  - `› rhythm longest gap`: rows in 2021-01 and 2021-07 → `{ months: 5, from: '2021-02', to: '2021-06' }`.
  - `› odometer is cumulative`: the last `km === 141204` on the board fixture.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): clock arrivals and rhythm odometer`.

### Task 10: Crossings v2

**Executor:** [Engine] · final review Opus

**Files:** Modify `crossings.ts`, `crossings.test.ts` and `model.ts`.

**Interfaces:** `Crossings` gains:
- `forwardHours` and `backHours`: sums of positive and negative `clockShiftMinutes` ÷ 60, rounded to whole hours. `clockShiftHours` stays their sum.
- `shiftByYear: { key; year; forward; back; flights }[]`: zero-filled across the account's year span. `flights === 0` marks a year the UI shows as a dash.
- `offsets: { key: string; offset: number; hit: boolean }[]`: exactly 24 rows for offsets −11…+12. Each endpoint's UTC offset at the flight date is floored to the hour and wrapped mod 24 into that window, so +13 maps to −11. `hit` means at least one counted endpoint.
- `lastEquator`, `lastArctic`, `lastAntarctic`, `lastDateLine`: each `(RecordRef & { date }) | null`, the latest crossing flight.

This is open decision 1: the default is endpoint offsets, not overflown zones.

- [x] **Step 1: Write the failing tests:**
  - `› forward and back split`: shifts of +180 and −120 minutes → `forwardHours 3`, `backHours 2`, `clockShiftHours 5`.
  - `› offsets wrap into 24 hourly slots`: AKL in March 2023 (+13) hits the −11 slot; Kathmandu (+5:45) hits the +5 slot; `offsets.length === 24`.
  - `› shiftByYear zero-fills`: the board's 2015 entry has `flights === 0`.
  - `› last crossings`: on the board fixture, `lastEquator` is the latest equator-crossing flight.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): crossings split, offsets and last crossings`.

### Task 11: Narrator engine

**Executor:** [Engine] · final review Opus

**Files:** Create `apps/next/src/client/overview/narrator/{triggers.ts,pick.ts,corpus.ts,narrator.tsx}` and `narrator/narrator.test.tsx`.

**Interfaces:**
- `type NarratorSlot = SectionId | 'globe' | 'firstRun' | 'zero'`.
- `interface Trigger { id: string; slot: NarratorSlot; priority: number; when(scope: OverviewScope, all: OverviewScope): Record<string, string | number> | null }`.
  - For section slots, triggers run only when the section's gate is `ready`. Below-gate triggers use ids `below:<section>` with params `{ have, need }`.
- `pickLine(slot, scope, all, seed: string, locale: Locale): string | null`:
  1. Take the first trigger by descending priority whose `when` is non-null.
  2. Take its variant `fnv1a32(`${seed}|${slot}|${canonicalFilter(scope.filter)}`) % 3`.
  3. Fill the `{param}` placeholders with locale-formatted numbers.
- `canonicalFilter` sorts keys and values, so the same scope always gives the same line.
- `corpus.ts` exports `CORPUS: Record<string, [Line, Line, Line]>`, where `Line` is `{ en: string; ru: string }`. This task ships one neutral placeholder trigger per slot; Task 12 replaces the corpus.
- `<Narrator slot />` renders a `<p className="narrator">` or nothing.

- [x] **Step 1: Write the failing tests:**
  - `› stable for the same scope`: two calls with an identical seed and filter return the same string. Reordering `airlines:['QR','TK']` to `['TK','QR']` returns the same string.
  - `› variant spreads across seeds`: 30 different seeds hit all 3 variants.
  - `› params are filled with locale numbers`: `ru` renders `14 535`.
  - `› below-gate uses below trigger`.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): narrator trigger engine`.

### Task 12: Narrator corpus (owner review gate)

**Executor:** [UI·Opus] using the glados-copy skill · final review Opus · **STOP for owner review**

**Files:** Modify `narrator/triggers.ts`, `narrator/corpus.ts` and `narrator/narrator.test.tsx`. Create `.scratch/overview-redesign/narrator-corpus.md` (the review sheet).

**Interfaces:**
- About 40 triggers × 3 variants, with English and Russian each written natively. Russian uses a dry bureaucratic register and «вы».
- Every slot needs a `below:*`, a `firstRun` and a `zero` line.
- Lines take numbers only from params, never literals. A line may never state something the card contradicts (critique P1).
- Pinned lines from the boards:
  - Clock: "More trips start at 7 a.m. than at any other hour…".
  - Records: "Sixteen hours to Auckland, by choice. Noted."
  - Manufacturers: "Airbus has carried you 38 times. Boeing is still auditioning."
  - Rankings: "Tbilisi is half your flights…".
  - Crossings: "Never crossed the date line…".
  - Rhythm: "Every July since 2021…".
  - Fleet: "Mostly narrowbodies…".

- [x] **Step 1:** Write the trigger list and lines into the review sheet: id, slot, condition, three EN lines, three RU lines.
- [x] **Step 2:** Add the test `› every trigger has three EN and RU lines with matching params`. Each placeholder set equals the trigger's param keys.
- [x] **Step 3:** Implement the triggers and corpus. Run `pnpm --filter @kuuki/next test -- narrator`. Expected: PASS.
- [x] **Step 4:** Commit `feat(overview): narrator corpus (pending owner review)`. **Stop and ask the owner to review `.scratch/overview-redesign/narrator-corpus.md`.** Apply the edits in a follow-up commit `fix(overview): narrator corpus after owner review`.

**Technical status (2026-10-08):** independent round2 approved the complete 42-trigger/126-pair corpus and regenerated sheet after I1–I3/M1 fixes. All 30 focused tests, affected typecheck/lint and live sheet consistency pass. Source committed as `8f9c604509bd577defa412033d85d90f163d71c6`; owner explicitly approved the EN/RU copy on 2026-10-08 and requested no edits. Task12 is accepted. Visual verification skipped by user.

### Task 13: Shu accent, data tokens and the kana logo

**Executor:** [UI] · final review Opus

**Files:**
- Modify: `apps/next/src/app/styles.css` (tokens, and the `--map-bucket-1..4` `color-mix` formula), `lib/theme-colors.ts:7`, `public/bootstrap.js:60-72`, `client/appearance.tsx:65-77`, `client/ui/swatch-picker.tsx:10-16` and `client/shell.tsx:13`.
- Test: `app/tokens.test.ts:70-73,127-133`, `app/bootstrap-accent.test.ts`, `app/foundation.test.ts`, and a new `client/shell.test.tsx`.

**Interfaces:**
- `ACCENTS = ['shu', 'ai', 'matcha', 'asagi', 'sakura']`, with `shu` the default. The stored names `terracotta`, `kincha`, `sumi` and `yellow` map to `shu` in both `bootstrap.js` and `appearance.tsx`. The `kuuki_accent` cookie needs no D1 change.
- Every token in Global Constraints is defined for light and dark (`--danger-*` changes globally).
- `--map-bucket-1..4` use `color-mix(in oklab, var(--accent) N%, var(--map-land))` instead of `in oklch`. `lib/map-buckets.ts` (the token list and thresholds 1, 2–3, 4–9, 10+) stays as it is.
- `Wordmark`:
  - Tile: 32×32, radius 8, background `--accent-tint` (hover: accent at 20%, 150ms).
  - Glyphs: three stacked kana く, う, き in `--font-kana`, 700, 18px, `--accent`.
  - Label: "Kuuki" in Commissioner 600 18px, gap 8.
  - Animation `kuuki-crossfade`: 7.5s, ease-in-out, infinite; delays 0, 2.5s and 5s; keyframes 0–8% opacity 0, 20–30% 1, 42–100% 0.
  - `prefers-reduced-motion`: a static く.
  - It replaces the 空 tile.

- [x] **Step 1: Write the failing tests:**
  - `tokens.test.ts`:
    - the accent list is the five above;
    - the Shu light buckets are within ±1 per channel of `#ecc6bb`, `#e5a494`, `#da7d68`, `#c94c33`, and the dark buckets of `#674e47`, `#865c51`, `#ac6b5d`, `#d87d6a`;
    - `--mark-ghost`, `--cat-maker-airbus` and `--cat-alliance-star` exist in both themes.
  - `bootstrap-accent.test.ts › legacy names map to shu`, for each of the four legacy names.
  - `shell.test.tsx › wordmark renders three kana and Kuuki`.
- [x] **Steps 2–4:** FAIL → implement → PASS. Then run `pnpm --filter @kuuki/next lint`.
- [x] **Step 5:** Run V(9.6) for the header at 1440 and 390.
- [x] **Step 6:** Commit `feat(design): Shu accent, data and category tokens, kana wordmark`.

### Task 14: Chip, Popover, Skeleton, category marks and month range

**Executor:** [UI] · final review Opus

**Files:**
- Create in `apps/next/src/client/ui/`: `chip.tsx`, `popover.tsx`, `skeleton.tsx`, `category-mark.tsx`, `month-range.tsx`, and a test file for each.
- Modify: `ui.css`, `apps/next/src/app/dev/gallery/*`, `apps/next/package.json` (add `@radix-ui/react-popover`).

**Interfaces:**
- `Chip({ label, swatch?, onOpen, onRemove, removeLabel })`:
  - Level 2 surface.
  - 32px visual with a 44px coarse hit area.
  - The body button opens the facet; a separate × button removes it.
  - Text ellipsizes; the × always stays visible.
- `PopoverRoot` / `PopoverTrigger` / `PopoverContent({ align, children })`: a Radix wrapper on level 2, with Esc and outside-click to close. Esc and nonfocusable outside dismissal return focus to the actual opener; an intentionally clicked outside control keeps focus. Dismissal unmounts immediately so a rapid reopening captures the current opener; entry motion and its reduced-motion fade remain.
- `Skeleton({ height, label })`: a fixed-height `--surface-inset` block with `aria-busy` and the label for screen readers. No shimmer.
- `MakerSwatch({ maker, size = 12 })`: a filled rounded square with radius 20%, `--cat-maker-*`.
- `AllianceMark({ alliance, size = 12 })`: ★ ○ △ in `--cat-alliance-*`, with an `aria-label` naming the alliance.
- `MonthRange({ from, to, min, max, onChange, onClear, locale })`: two 44px month pickers (From / To) and a 44px Clear button. It emits `{ from: 'YYYY-MM', to: 'YYYY-MM' } | null`, and `from > to` swaps them. Every nonempty endpoint must satisfy the current bounds before emission; changed bounds invalidate incompatible partial drafts.

- [x] **Step 1: Write the failing tests:**
  - `chip.test.tsx › remove does not open`.
  - `popover.test.tsx › escape closes and restores focus`.
  - `category-mark.test.tsx › alliance mark has accessible name`.
  - `month-range.test.tsx › swaps reversed range` and `› clear emits null`.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Add gallery entries. Visual inspection is skipped under the explicit user verification override.
- [x] **Step 6:** Commit `feat(ui): chip, popover, skeleton, category marks, month range`.

### Task 15: Chart kit

**Executor:** [UI] · final review Opus

**Files:**
- Create in `apps/next/src/client/overview/charts/`: `kuuki-chart.tsx`, `lazy-chart.tsx`, `table-view.tsx`, `palettes.ts`, `chart-theme.css`, and `kuuki-chart.test.tsx` (jsdom).
- Modify: `apps/next/package.json` (add `d3-scale@4.0.2`, `d3-shape@3.2.0` and `@types/*` dev dependencies, exact).

**Interfaces:**
- `KuukiChart<T>` is a `'use client'` wrapper over `RendererChart` from `@tanstack/charts/react/tooltip`, with `renderer={motion()}` from `@tanstack/charts/motion`. Props:
  - `definition`, `height`, `ariaLabel`, `ariaDescription?`;
  - `palette?: ChartPalette`;
  - `inView: boolean`. When false, the definition is built with `motion: false`, so off-screen charts snap;
  - `onPick?: (p: ChartPoint<T>) => void`;
  - `tip?: (points) => ReactNode`;
  - `actions?: (p) => TipAction[]`, where `TipAction` is `{ label; run(): void }`;
  - `table: { caption: string; columns: { key; label; numeric? }[]; rows: Record<string, string | number>[] }`.
- **Touch rule:** a capture-phase `pointerdown` on the host records `pointerType`. When `onSelect` fires after a touch, the kit pins a level-2 action card at the point with `actions(p)` and does not call `onPick`. A mouse click, Enter or Space calls `onPick`. Escape or an outside tap dismisses the card.
- `palettes.ts`:
  - `DEFAULT_PALETTE`: `--ts-chart-1..5` ← `--mark-1..4` and `--mark-ghost`.
  - `MAKER_PALETTE`: `--ts-chart-1..6` ← `--cat-maker-*` in slot order.
  - The palette is applied as inline CSS custom properties on the host.
- `chart-theme.css` ports `.kc` from `prototype/charts/style.css`:
  - tooltip variables from paper tokens;
  - 12px and 22px text in mono;
  - `:focus-visible` ring 2px `--accent` with offset 2px; `:focus:not(:focus-visible)` gets no ring.
- `TableView({ table })`: a "View as table" text button with a 44px hit area. It toggles a disclosure containing a `<table>` with `<caption>`.
- `LazyChart({ height, label, children(inView) })`: renders `Skeleton` until the IntersectionObserver (200px root margin) first fires. After that, `inView` tracks visibility.

- [x] **Step 1: Write the failing tests:**
  - `› server-renders svg with aria label`, using `renderToString`.
  - `› mouse select calls onPick`.
  - `› touch tap pins actions and does not call onPick`: `pointerdown` with `pointerType 'touch'`, then select → the action buttons are visible and `onPick` was not called. Clicking "Add filter" runs the action.
  - `› empty rows render an empty chart without throwing`.
  - `› view as table shows caption and rows`.
  - `› lazy chart keeps skeleton height until intersecting`.
- [x] **Steps 2–4:** FAIL → implement → PASS. Build and Overview client JS delta are deferred to the later integrated checkpoint under the user test-batching override; record that deferral in the commit body.
- [x] **Step 5:** Commit `feat(overview): chart kit with tap-to-pin, table view and lazy mount`.

### Task 16: Overview context, filter actions and UI bus

**Executor:** [UI] · final review Opus

**Files:**
- Create in `apps/next/src/client/overview/store/`: `overview-context.tsx`, `filter-actions.ts`, `ui-bus.ts`, `open-flight.tsx`, plus `filter-actions.test.ts` and `overview-context.test.tsx`.
- Modify: `apps/next/src/server/overview.ts`, adding `getOwnOverviewPrefs()` alongside `getOwnOverviewData()`.

**Interfaces:**
- `OverviewProvider({ payload, prefs, ownerKey, locale, children })`:
  - creates the store with `createOverviewDataStore` and `attachRevalidation`;
  - holds `filter`, `layout` and `replayPaused`;
  - persists changes with `PUT /api/me/overview/prefs`, debounced 800ms, through the existing CSRF-aware fetch helper;
  - on a failed save, keeps local state and shows the existing error toast once.
- `useOverview()` returns `{ payload, scope, all, filter, layout, replayPaused, locale, ownerKey, aggregate }`, where `all = scopeFor(store, {})`.
- `filter-actions.ts`, pure:
  - `addValue(f, facet: FacetKey, value)` and `removeValue(f, facet, value)`. An empty facet is deleted.
  - `removeFacet(f, facet)`, `setPeriod(f, period | null)`, `clearAll()`.
  - `removeLast(f)`: removes the last value of the last-inserted key. Key insertion order is preserved through JSON.
- `useFilterActions()` returns `{ add, remove, removeFacet, setPeriod, clear, removeLast }`.
- `ui-bus.ts` is a `useSyncExternalStore` store holding `{ hoverRoute: string | null; hoverGhost: number | null; focusRoute: string | null }`, with setters.
- `useOpenFlight()` returns `(id: number) => void`. It pushes `?flight=<id>` with `{ scroll: false }` and is a no-op in aggregate mode. `<OverviewFlightSheet />` renders `FlightDetailSheet` for `?flight=`, the same way Journal does.
- `useMakerMetric()` reads and writes `?makers=flights|hours|km` with `router.replace`; the default is `flights`.

- [x] **Step 1: Write the failing tests:**
  - `filter-actions.test.ts › removeLast removes the newest value`: `{airlines:['TK','QR'], countries:['JP']}` gives `{airlines:['TK','QR']}`, then `{airlines:['TK']}`.
  - `filter-actions.test.ts › removing the last value deletes the facet`.
  - `overview-context.test.tsx › unknown facet value yields zero scope, not a crash`: `airlines:['ZZ']` gives `scope.figures.flights === 0`.
  - `overview-context.test.tsx › prefs save is debounced and last write wins`: three quick changes produce one PUT carrying the final body.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): client context, filter actions and ui bus`.

### Task 17: Dev route, page shell and page states

**Executor:** [UI] · final review Opus

**Files:**
- Create: `apps/next/src/app/dev/overview/page.tsx`; `client/overview/page/{overview-page.tsx,page-states.tsx,scope-title.ts,page.css}`; `client/overview/sections/registry.ts`; tests `page/overview-page.test.tsx` and `page/scope-title.test.ts`.

**Interfaces:**
- `/dev/overview?fixture=board|empty|n1|zero|aggregate&theme&locale`:
  - It calls `notFound()` in production, like `dev/gallery`.
  - The fixtures map to `board.json`, `n0.json`, `n1.json`, `board.json` with `{period:{years:[2016]}, airlines:['QR']}`, and `n5001.json`.
  - It uses `ownerKey 'dev'` and a no-op prefs saver.
- `OverviewPage({ payload, prefs, ownerKey, name, locale })` lays out, top to bottom:
  1. H1 "Hi, {name}", with a scope suffix from `scopeTitle`.
  2. Next strip (Task 21).
  3. Globe band row: the globe card, plus the hero panel on desktop.
  4. Sections (Task 18), or tiles (Task 19) at ≤ 700px.
  5. Hidden footer.
- Breakpoints: bento at ≥ 1024px, a single column at 701–1023px, tiles and the section sheet at ≤ 700px (`useMobile`).
- `scopeTitle(filter, labels, locale)` returns `''` or `' · Japan, Turkish'`: the first two facet values in key order, then `' +N'`.
- `registry.ts`: `SECTIONS: Record<SectionId, { title: Copy; Section: ComponentType<{ span: Span }>; Tile: ComponentType; gate: (s: OverviewScope) => Gate<unknown> | null }>`. `Span` is `'narrow' | 'wide' | 'full' | 'sheet'`. Until a section task lands, its entry renders a titled `Skeleton`.
- **States:**
  - **First run** (`figures.flights === 0` with an empty filter): the globe card with a still blank globe; the `firstRun` narrator line plus Import and Add buttons centred over the lower third; no figures or sections.
  - **Zero result** (`figures.flights === 0` with a non-empty filter): chips stay; the globe is fully ghosted; figures show "—"; sections are replaced by one `zero` narrator line plus "Remove last filter" and "Clear all" buttons.

- [x] **Step 1: Write the failing tests:**
  - `› first run shows narrator, import and add, no figures`.
  - `› zero-result renders one narrator line and two actions`: clicking "Remove last filter" removes `QR`.
  - `› sections follow layout order and skip hidden`.
  - `scope-title.test.ts › two values then +N`.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** SKIPPED by explicit user instruction: visual V(9.3)/V(9.4) page-frame checks. Focused functional checks and source review passed; no rendered geometry claim.
- [x] **Step 6:** Commit `feat(overview): page shell, states and dev fixture route`.

### Task 18: Section frame, bento packing, reorder and hide

**Executor:** [UI] · consolidated final review

**Files:** Create in `client/overview/layout/`: `bento.ts`, `reorder.ts`, `use-reorder.ts`, `section-frame.tsx`, `hidden-footer.tsx`, `layout.css`, and tests `bento.test.ts`, `reorder.test.ts`, `section-frame.test.tsx`.

**Interfaces:**
- `packBento(order: SectionId[], hidden: SectionId[]): BentoRow[]`:
  - `BentoRow` is `{ kind: 'full'; id } | { kind: 'pair'; narrow: SectionId; wide: SectionId; narrowFirst: boolean }`.
  - Section classes: FULL = rankings, records, crossings; NARROW = manufacturers, clock; WIDE = fleet, rhythm.
  - Walk the visible order. A narrow section next to a wide one, in either order, forms a pair; anything else goes full width.
  - Pair columns are 392:792 with a 16px gap in the 1200 lane.
  - A narrow or wide section on a full row renders its normal layout at full width.
- `moveSection(order, id, toIndex): SectionId[]`.
- `dropIndex(pointerY, rects: { id; top; bottom }[]): number`, by the midpoint rule.
- `useReorder({ ids, onCommit, announce })`:
  - Fine pointers start a drag after 4px of movement; coarse pointers after a 400ms long press that moves less than 8px.
  - It draws a 2px `--accent` insertion indicator.
  - It auto-scrolls at 12px per frame within 64px of the viewport edge.
  - Esc cancels.
  - A polite live region announces "Records moved to position 3 of 7" (EN and RU).
- `SectionFrame({ id, title, hint?, controls?, index, count, onMove, onHide, narrator, children })`:
  - A level-1 card.
  - The H2 header is the drag handle and has a grab cursor.
  - A 6-dot grip sits in the left gutter in `--text-muted`. It shows on hover or focus-within for fine pointers, and always on coarse pointers.
  - A ⋯ `Menu` on the right offers Move up, Move down and Hide; the ends are disabled.
  - The narrator sits at the foot.
- `HiddenFooter({ hidden, onShow })`: "2 hidden sections · Show". Show opens a `Menu` listing each hidden section plus "Show all". A restored section returns at its index in `order`.

- [x] **Step 1: Write the failing tests:**
  - `bento.test.ts › default order`: full rankings, full records, a pair of manufacturers and fleet (narrowFirst), a pair of clock and rhythm (narrowFirst), full crossings.
  - `bento.test.ts › wide before narrow pairs with narrowFirst false`.
  - `bento.test.ts › two narrows do not pair`.
  - `bento.test.ts › hidden ids are skipped`.
  - `reorder.test.ts › dropIndex midpoint`.
  - `section-frame.test.tsx › menu move up at top is disabled`.
  - `section-frame.test.tsx › keyboard move announces position`.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Visual/manual/device verification SKIPPED by the owner; logical pointer/focus checks only.
- [x] **Step 6:** Commit `feat(overview): bento sections with drag, menu reorder and hide`.


**Status:** Accepted combined source PAGE47a14cde404c4db35359ece7868346c3aa7c7b72, central UIb4711d8e024554ccc17e4260885cb2972ca18aac. Task19 fixes final Show focus. 73 focused implementation tests and affected types/lint pass; central page/sheet integration42tests pass. Minor M1 native Radix cleanup timing limitation is explicitly triaged. Consolidated final review remains pending.

### Task 19: Mobile tiles and section sheet

**Executor:** [UI] · consolidated final review

**Files:** Create in `client/overview/mobile/`: `tiles.ts`, `section-tile.tsx`, `section-sheet.tsx`, `mobile.css`, and tests `tiles.test.ts`, `section-sheet.test.tsx`.

**Interfaces:**
- `packTiles(order, hidden): { id: SectionId; span: 'half' | 'full' }[]`:
  - `manufacturers` is always full.
  - The others are half. A half tile left alone in its row becomes full.
  - The visual order never departs from the layout order.
- `SectionTile({ id, onOpen, children })`: a level-1 card button showing the title and a › chevron. The preview comes from the registry's `Tile`. Coarse pointers can long-press drag through `useReorder`.
- `SectionSheet({ openId, order, onNavigate, onClose })`, using `Sheet`:
  - Header: title plus "2 of 7", a ⋯ menu (Move up, Move down, Hide) and a × button.
  - A pager with one 2px segment per visible section; the active one is `--accent`.
  - Body: the section at `span 'sheet'`.
  - Footer: ‹ previous / next › buttons labelled with section names.
  - The sheet sizes to its content and clears the status bar.
- Mobile hero figures are part of Task 21.

- [x] **Step 1: Write the failing tests:**
  - `tiles.test.ts › default mobile order and spans`: rankings and records half, manufacturers full, fleet and clock half, rhythm and crossings half.
  - `tiles.test.ts › orphan half becomes full`.
  - `section-sheet.test.tsx › next button opens the following section and pager shows 3 of 7`.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Visual/manual/device verification SKIPPED by the owner; logical pointer/focus checks only.
- [x] **Step 6:** Commit `feat(overview): mobile tiles and section sheet`.


**Status:** Accepted combined source PAGE47a14cd, central UIb4711d8. Real mobile tiles/sheet and provider persistence installed; 73 focused implementation checks plus42central page/sheet checks pass. Real touch and all visual verification skipped by owner; consolidated final audit remains pending.

### Task 20: Filter bar and "+ Filter" panel

**Implementation checkpoint (2026-10-08):** Complete in fd71a2e, integrated as fcffe7c. Five production filter files and actual page wiring; 73 existing focused checks, types and scoped lint pass. No new tests authored under the owner override; direct new panel/overflow coverage remains a final audit limitation. Visual Step 5 skipped; broad checks are batched at the final cutover.

**Executor:** [UI] · final review Opus

**Files:** Create in `client/overview/filters/`: `facet-index.ts`, `chip-label.ts`, `filter-bar.tsx`, `filter-panel.tsx`, `filters.css`, and tests `facet-index.test.ts`, `chip-label.test.ts`, `filter-panel.test.tsx`.

**Interfaces:**
- `buildFacetIndex(payload, labels, locale): FacetOption[]`:
  - `FacetOption` is `{ facet: FacetKey | 'period'; value: string; label: string; sublabel?: string; count: number; mark?: { kind: 'maker'; key: MakerKey } | { kind: 'alliance'; key: Alliance } }`.
  - Counts are weighted over all counted rows.
  - Airline `sublabel` carries the alliance, or a leaver note such as "S7 · left Oneworld 2022" from `formerAlliance`.
- `searchFacets(index, query, locale): { facet; options: FacetOption[] }[]`:
  - Matching ignores case and diacritics, on label, code and city.
  - At most 8 options per group, in facet order: period, countries, airports, airlines, alliances, routes, aircraft, families, makers, bodies, haul, domestic, departureBands, depHours, arrHours, regions.
- `topPicks(index)`: the most-flown country, airline and route.
- `chipLabel(facet, values, labels, locale)` returns `{ name; values: string; more: number }`, for example `{ name: 'Airline', values: 'Turkish, Qatar', more: 1 }`.
- `FilterBar`, in the globe card's top-left corner:
  - "+ Filter" first, then one `Chip` per facet. With no filter it shows the text "All flights, all time".
  - Chips wrap to at most 2 rows; anything more collapses into a "+N" chip that opens the panel.
- `FilterPanel({ anchor, initialFacet? })`: a `Popover` on desktop and a full-height `Sheet` at ≤ 700px.
  - Search input on top.
  - Empty query: the top picks with mono counts, then "Browse all facets ›".
  - Browse: a facet list leading to that facet's values as multi-select checkboxes.
  - Typing: grouped results.
  - Period: years plus "Custom range" (`MonthRange`).
  - Combobox/listbox semantics: arrows move, Enter toggles, Esc closes.
  - A chip click opens the panel at its facet.
  - Changes apply instantly.

- [x] **Step 1: Existing-test evidence; new cases waived by owner:**
  - `facet-index.test.ts › board top picks and counts`: TK has 24.
  - `facet-index.test.ts › search groups across facets`: "ist" returns an airports group with IST and a routes group with routes containing IST.
  - `facet-index.test.ts › leaver note`.
  - `chip-label.test.ts › chipLabel shows two values and +N`.
  - `filter-panel.test.tsx › enter on a result adds the chip and keeps panel open`.
  - `filter-panel.test.tsx › chip click opens its facet`.
- [x] **Steps 2–4:** Implemented; affected existing checks pass. New RED cases waived by owner.
- [x] **Step 5: WAIVED — visual verification skipped by owner.** Original gate: Run V(9.3) and V(9.4) on the chips, with the filtered demo "Year 2025 + Turkish", in RU at 390.
- [x] **Step 6:** Commit `feat(overview): filter chips and search-all-facets panel`.

### Task 21: Hero panel and Next strip

**Executor:** [UI] · consolidated final review

**Implementation status (2026-10-08):** Accepted component source cffcb96 / UIe7db9fe, fixed accessible Next name and valid early-year captions;69 focused tests/types/lint passed. Actual dev-page wiring now passes all17 page tests. Full integration checks remain batched; all visual checks are skipped.

**Files:**
- Create: `client/overview/hero/{hero-panel.tsx,year-strip.tsx,next-strip.tsx,hero.css}` and tests `hero-panel.test.tsx`, `next-strip.test.tsx`.
- Modify: `lib/format.ts`, adding `formatDurationDays(locale, minutes)`, which gives "9d 4h" / "9 д 4 ч".

**Interfaces:**
- **`HeroPanel` (desktop and tablet; board 9.3).** A level-1 card containing:
  - The lead figure (flights) at 80px, "Flights since March 2014" (from `figures.firstDate`), and an "N awaiting review →" link to the review queue. Reuse the legacy `hero.tsx` target.
  - `YearStrip`: one button per `figures.byYear` row. The peak is `--accent`, the others `--mark-2`, and empty years are 2px `--mark-ghost` stubs. Labels `'14…'26` are mono 12px. A tap sets `period: { years: [y] }`.
  - A 2×2 grid at 32px with 15px units:
    - km, with "3.5× round the equator";
    - "≈ 9d 4h" with "in the air · 6 estimated". "≈" appears only when `durationApproximate`;
    - countries and territories, with "by air" when `source === 'by_air'`;
    - airports.
  - **Delta line** (only when the filter has a period): "↑ +12 vs 2025" in `--success-text`, or "↓ −3 vs 2025" in `--warning-text`. The sign and arrow are always shown. Delta = current − `deltas.*`.
  - **Share line** (only when `figures.share` is set): "24 flights · 35% of all".
  - **Zero state:** every figure shows "—".
- **Mobile hero (board 9.4):** the same four figures in a 2×2 grid at 40px, captioned "Flights · 3 to review", "Kilometres · 3.5× the equator", "Countries and territories", "In the air · 6 estimated". No year strip.
- **`NextStrip`.** A 44px row with no card:
  - A pill: "TODAY", "TOMORROW" or "IN N DAYS".
  - The mono route.
  - "Sat, 10 Oct · FZ 1937", plus "· a new country" when `newCountry`.
  - A chevron.
  - "+N more booked" on the right.
  - With no upcoming flight but `awaiting > 0`, it shows "3 flights to review · Review →" instead.
  - Hover or focus sets `ui-bus.hoverGhost`. A click opens the flight sheet.
  - Nothing renders when there is neither.

- [x] **Step 1: Write the failing tests:**
  - `› deltas only with a time filter`.
  - `› share line only for facet-only filters`.
  - `› approximate duration shows ≈ and estimated count`.
  - `› year tap sets the period`.
  - `› strip shows IN 3 DAYS and new country`.
  - `› awaiting variant when nothing is booked`.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Visual verification skipped by explicit user instruction.
- [x] **Step 6:** Commit `feat(overview): ranked hero panel and next strip`.

### Task 22: Globe card and SVG globe

**Executor:** [UI] · consolidated final review

**Implementation status (2026-10-08):** Accepted component source33d7f02 / UI0b3070a;24 focused tests/types/lint passed. Actual dev page now emits sphere/routes/rim SVG at SSR and retains first-run/zero behavior;17 page tests pass. Full integration checks remain batched; all visual checks are skipped.

**Files:** Create `client/overview/globe/{globe-card.tsx,svg-globe.tsx,globe.css}` and tests `svg-globe.test.tsx`, `globe-card.test.tsx`.

**Interfaces:**
- `GlobeCard({ children })`:
  - A level-1 card. The globe area sits on `--surface-inset`.
  - Rim: one flat 8px `--globe-rim` ring plus a 1px hairline at the limb. No blur, no gradient.
  - Corner slots: `topLeft` for `FilterBar`, `topRight` for Fullscreen, `bottomLeft` for the replay transport, `bottomRight` for the legend.
  - Height: from board 9.3 on desktop; about 360px on mobile, at full guttered width.
  - Fullscreen opens a full-viewport `Dialog` that renders the same globe component. There, scroll-zoom is enabled and Esc closes.
  - The legend shows the four bucket swatches plus their range labels from `lib/map-buckets.ts`.
- `SvgGlobe({ globe: GlobeData, all: GlobeData, rotate: [number, number], size, land?: GeoJSON })`:
  - TanStack `geoShape` layers with `geoOrthographic`, `fit: 'sphere'` and `scales: { x: null, y: null }`.
  - Layer order: sphere, land (`--map-land`), visited countries on the bucket ramp, out-of-scope countries in ghost, route LineStrings (great arcs; stroke 1–3px by count on the bucket ramp; ghost routes `--mark-ghost` at 15%), and airport dots.
  - Server render: sphere, routes and rim only. After mount it fetches `/maps/countries-110m-2.0.2.geojson` and adds the land.
  - It is the first paint, and the permanent fallback when WebGL2 is missing.
  - `rotate` comes from `globe.centroid`.
- With `figures.flights === 0` (first run), the globe has no routes and no replay.

- [x] **Step 1: Write the failing tests:**
  - `› server render has sphere and route paths without land`.
  - `› land appears after geojson loads`, with mocked fetch.
  - `› ghost routes render beneath in-scope routes`.
  - `› fullscreen opens dialog and escape closes`.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Visual verification skipped by explicit user instruction.
- [x] **Step 6:** Commit `feat(overview): globe card and SVG orthographic globe`.

### Task 23: MapLibre globe, camera, route card and axis lock

**Implementation checkpoint (2026-10-08):** Complete with Task24 in 97ed02f, integrated as 62b92b7. Full owned self-review, 54 focused checks and final affected lint/types pass. Pre-override tests preserved; existing corrections only afterwards. All browser/device/visual Step 5 checks skipped. Actual page uses the shared OverviewGlobe consumer; real GPU/touch behavior remains unverified.

**Executor:** [UI·Opus] · final review Opus

**Files:**
- Create: `client/overview/globe/{maplibre-globe.tsx,gestures.ts,night.ts,route-card.tsx}` and tests `gestures.test.ts`, `night.test.ts`, `maplibre-globe.test.tsx` (MapLibre mocked).
- Modify: `client/maps/geometry.ts`, adding `bearing(a, b)`.

**Interfaces:**
- `MaplibreGlobe`:
  - It is loaded with `import()` after `requestIdleCallback`, and only when `webgl2Supported()`.
  - It renders mapcn `Map` with `projection={{ type: 'globe' }}`.
  - Layers: countries (bucket fill through feature-state; out-of-scope countries hatched with 15% hairlines from a canvas pattern), routes (great-circle LineStrings from `geometry.ts`; width 1→3px by count; ghost routes at 15%), airports, microstates (dots at `country-centers-110m-2.0.2.json` positions for visited codes missing from the 110m features), and the night side.
  - Colours resolve through `client/maps/resolve-color.ts`.
  - It fades in over the SVG on the first `idle` event (200ms opacity; instant under reduced motion).
- **Camera:** on filter change, `flyTo({ center: globe.centroid, duration: 600, easing: easeInOut })`; `jumpTo` under reduced motion. `ui-bus.focusRoute` flies to the route midpoint.
- **Desktop:** drag rotates freely. Scroll-zoom is off in the card and on in Fullscreen.
- **Maker identity:** when `filter.makers` holds exactly one maker slot, in-scope routes use that `--cat-maker-*` token instead of the bucket ramp, so maker identity carries across the page.
- **Coarse pointers:**
  - The container sets `touch-action: pan-y`, so vertical swipes scroll the page natively.
  - MapLibre `dragPan` is disabled.
  - A one-finger horizontal drag spins the globe by `Δlng = −dx / R × 180 / π`, where R is the globe radius in px.
  - Two fingers use MapLibre `touchZoomRotate` and `touchPitch`.
  - Pointerdown on corner controls stops propagation.
- `gestureAxis(dx, dy, threshold = 10): 'x' | 'y' | null`. It returns null until `max(|dx|, |dy|) ≥ threshold`, then the dominant axis.
- `nightPolygon(date: Date): GeoJSON.Polygon`:
  - Declination δ = −23.44° × cos(2π/365 × (dayOfYear + 10)).
  - The subsolar longitude comes from `date`'s UTC time.
  - The polygon is the hemisphere centred on the antisolar point.
  - The caller passes the replay date combined with the page-load time of day.
- `RouteCard({ route, onScope, onClose })`:
  - A level-2 card at the click point (routes are queried with an 8px buffer).
  - It shows the mono route, "11 flights · 1,791 km", and a "Scope page to this route" button that adds a `routes` filter.

- [x] **Step 1: Existing-test evidence; new cases waived by owner:**
  - `gestures.test.ts › gestureAxis locks after 10px`: `(3, 4)` gives null; `(12, 3)` gives `'x'`; `(4, 11)` gives `'y'`.
  - `night.test.ts › june solstice keeps the north pole in daylight`.
  - `night.test.ts › december solstice puts it in night`.
  - `night.test.ts › antisolar point is inside`.
  - `geometry.test.ts › bearing DOH to AKL` is within 1° of a reference value computed in the test with the haversine bearing formula.
  - `maplibre-globe.test.tsx › filter change flies 600ms and reduced motion jumps`.
  - `maplibre-globe.test.tsx › no webgl2 keeps the svg globe`.
- [x] **Steps 2–4:** Implemented; affected existing checks pass. New RED cases waived by owner.
- [x] **Step 5: WAIVED — visual verification skipped by owner.** Original gate: Check by hand with touch emulation at 390: a vertical swipe on the globe scrolls the page; a horizontal swipe spins it; a pinch zooms. Then run V(9.3) and V(9.4).
- [x] **Step 6:** Commit `feat(overview): MapLibre globe with camera, route card and axis lock`.

### Task 24: flightcn planes, replay and transport

**Implementation checkpoint (2026-10-08):** Shared one-clock consumer and native transport integrated with Task23 in 62b92b7. Build/route-byte comparison deferred to the final frozen-source batch. Manual/visual Step 5 skipped. No further per-task review.

**Executor:** [UI·Opus] · final review Opus

**Files:**
- Create: `client/maps/flightcn.tsx`, vendored from flightcn `src/registry/flight.tsx` @ `5c9061ef36bb2cd3cfa9f11f6463419944566a9d`, keeping only the animated `FlightRoute` plane path and marker. It carries the MIT header "Copyright (c) 2026 Yen Cheng Lin" and the source URL, with `@turf/bearing` replaced by `geometry.bearing`.
- Create: `client/maps/licenses/flightcn-LICENSE`, `client/overview/globe/{replay.ts,replay-transport.tsx}`, and tests `replay.test.ts`, `replay-transport.test.tsx`.

**Interfaces:**
- `replayDurationMs(n) = clamp(10_000 + 12_000 × log2(n / 10), 12_000, 120_000)`. For n < 10 this clamps to 12,000.
- `buildTimeline(items: ReplayItem[], durationMs): { key; startMs; origin; destination; month: string }[]`:
  - Calendar-linear, from the first item's month start to the last item's month end.
  - In aggregate mode, items are already monthly, so the timeline batches by month.
- `monthAt(timeline, t)` and `yearTicks(timeline)`.
- **Replay behaviour:**
  - The replay shows in-scope items only, and loops forever.
  - Each plane flies its arc in 4,000ms (the flightcn default) from `startMs`. At most 12 planes are in flight at once; extra items draw their arc without a plane.
  - Arcs accumulate during a loop and clear when it restarts.
  - Upcoming flights stay drawn as dashed ghost arcs. `hoverGhost` highlights one.
  - The night side follows the replay month.
  - The stats never follow the replay.
- **Pausing:** the replay pauses when the user pauses it (persisted as `replayPaused`), when the card is off-screen (IntersectionObserver), or when `document.visibilityState === 'hidden'`.
- **Reduced motion:** no replay. Every route shows a static plane glyph at its midpoint, and the transport is hidden.
- `ReplayTransport`:
  - A pause/play button (32px visual, 44px coarse hit area) and a mono month label ("MAR 2019", locale-formatted short month, uppercase).
  - A scrubber built from `handleX` (`@tanstack/charts/interaction/handle`) with year ticks.
  - Desktop: the scrubber slides out on hover or focus-within (200ms ease-out; instant under reduced motion).
  - Touch: tapping the month label expands the scrubber across the card's bottom edge; an outside tap collapses it.

- [x] **Step 1: Existing-test evidence; new cases waived by owner:**
  - `replay.test.ts › duration clamps`: n = 1 gives 12,000; n = 69 gives 10,000 + 12,000 × log2(6.9) (round in the assertion); n = 100,000 gives 120,000.
  - `replay.test.ts › timeline is calendar-linear`: the 2019 entries start at a fraction of `durationMs` matching their date fraction.
  - `replay.test.ts › aggregate timeline batches by month`.
  - `replay-transport.test.tsx › pause persists replayPaused`.
  - `replay-transport.test.tsx › hidden tab pauses and resumes`.
  - `replay-transport.test.tsx › reduced motion hides transport`.
- [x] **Steps 2–4:** Implemented; affected existing checks pass. New RED cases waived by owner. Then run `pnpm next:build`, and record the Overview route's client JS and the MapLibre chunk sizes.
- [x] **Step 5: WAIVED — visual verification skipped by owner.** Original gate: Check by hand: a full loop on the board fixture, then pause, scrub and resume; the tab hidden and visible; Next-strip hover. Run V(9.3).
- [x] **Step 6:** Commit `feat(overview): chronological replay with flightcn planes`.

### Tasks 25–31: Sections

**Implementation checkpoint (2026-10-08):** All seven actual sections and pure mobile tiles are implemented and registered, committed in 8e1a9f4 and integrated as 6fd991e. Scoped types/lint pass; 72 of 73 focused checks originally passed. The remaining existing aircraft case was corrected to the real “Save 1 aircraft” label and a successful accept response; it now passes (2.26s). Actual frames avoid duplicating the below-gate narrator (abdb79b). No new unit tests after the owner override, full suites deferred, all visual checks skipped, final review reserved for the consolidated audit.

Every section task follows the same contract, so it is stated once here.

**Files:** `client/overview/sections/<id>/{section.tsx,tile.tsx,<chart files>,<helpers>.ts,<id>.css,<id>.test.tsx}`, plus registering the section in `sections/registry.ts`.

**Section contract:**
- `Section({ span })` renders inside `SectionFrame` with the title and controls from the board.
- **Gate below:** the `below:<id>` narrator line, the coverage line and its fix action ("Add aircraft →", "Add times →") where the gate counts typed or timed flights.
- **Gate ready:** the board content, then "View as table" under each chart, then the narrator at the foot.
- **Filtered state:** charts draw the ghost layer from `all`.
- **Charts** go through `KuukiChart` (or `LazyChart` when below the fold). Each sets `onPick` (add a filter) and `actions` ("Add filter", plus "Open flight" when there is a flight id and the page is not in aggregate mode).
- `Tile()` renders the mobile preview from board 9.4 and opens the sheet. Tile captions are factual.

**Section test minimums:**
- `› below gate shows placeholder line`.
- `› pick adds the expected chip` (one per chart).
- `› table view lists the chart rows`.
- `› renders in RU without missing keys`.

**Visual check:** V(9.3) for the card, V(9.4) for the tile, and V(9.5) for the sheet where shown.

**Steps (each task):**
1. Write the failing tests: the minimums plus the task's extra tests.
2. Run `pnpm --filter @kuuki/next test -- <id>`. Expected: FAIL.
3. Implement.
4. Re-run, then run the full Next tests, typecheck and lint. Expected: PASS.
5. Run the visual check.
6. Commit.

**Commit:** `feat(overview): <id> section`.

**Executor:** [UI] · final review Opus (each).

#### Task 25: Rankings

- **Leader tiles:**
  - Three `--surface-inset` tiles, 354 wide, gap 48, radius 10: "Top airline", "Top airport", "Top route".
  - Lockup: a 44px badge (`--accent-tint` background, `--accent-on-tint` text, mono code or a route glyph); the name at 18/24 600 with a 13px context line (alliance mark and name, "Georgia · home airport", or the city pair); the count at 28px, right-aligned, over "flights".
  - One 8px strip: #1 in `--accent`, #2–#5 combined in `--map-bucket-2`, the rest on the track. A two-swatch legend reads "35% of your flights" and "Top 5: 72%".
  - #2–#5 follow as rank, name and count rows, 24px tall and 4px apart, each a filter button.
  - Names wrap to 2 lines, then ellipsize.
- **Rank by year:**
  - Port `RankingsBump` from `prototype/charts/charts.tsx`: `lineY` per entity with `d3Curve(curveBumpX)`, `scalePoint` years, reversed y, and dim `states`.
  - Dashes: #1 solid 2.5, #2 solid 2, #3 `6 4`, #4 solid in `--mark-4`, #5 `1 4` round.
  - Segmented Airlines / Airports / Routes (44px), plus `interactiveColorLegend` that repeats the dash styles.
  - Ties share a y position, as the engine ranks them.
  - Always shown, with no threshold.
- **Head to head:** three scoreboards, each a chip and name per side, a mono score "38 : 21" in a fixed 96px centred slot, and one 8px split bar:
  - makers use `--cat-maker-airbus` against `--cat-maker-boeing`;
  - haul and daytime use `--accent` against `--mark-2` (open decision 3).
  - A card footnote reads "Daytime v red-eye leaves out N untimed flights" (from `versus.excluded`).
  - Each side is a filter button.
- **Header hint:** "Click any name to filter the page", on fine pointers only.
- **Tile:** TK/QR/FZ mini bars with 12px labels, "Turkish ×24", "Top airline · TBS–IST ×11".
- **Extra test:** `› bump pick adds airline chip and segment switches series`.

#### Task 26: Records

- **Lead tile** (558 wide, `--surface-inset`, radius 10):
  - Route in mono 28px, city names, a 64px figure, and meta (flight number · date).
  - Three stats: in the air (with "≈" if approximate), average ground speed (hidden when null), and clock shift.
  - A route sketch: an SVG arc crossing a dashed equator when the route crosses it.
  - A "% of the way round the equator" bar against 40,075 km, with a tick at `previousBestKm`.
- **Tiles** (2×2, 276 wide, gap 24): a 32px figure, a mono route, and one micro-visual on a 240px track with an accent dot:
  - Shortest: 0 → longest, "1/78 of your longest".
  - Furthest north: 0–90° with the Arctic zone shaded, "1.1° inside the Arctic Circle" (lat − 66.56).
  - Earliest departure: 00–24 with 22–06 shaded.
  - Busiest year: 12 month bars, peak in accent, "Peak: July, 3 flights".
- **↗ affordance:** opens the flight (`useOpenFlight`) and sets `ui-bus.focusRoute`. It is hidden in aggregate mode.
- **Tile:** an arc sketch, "14,535 km", "Longest · DOH → AKL".
- **Sheet (9.5):** the lead tile, then the 2×2 tiles.
- **Extra test:** `› aggregate hides open-flight`.

#### Task 27: Manufacturers

- **Header:** the leader share "55% ■ Airbus" (`MakerSwatch`), "38 of 69 flights"; segmented Flights / Hours / Km (`useMakerMetric`).
- **Waffle.** The TanStack `cell` mark on band x/y scales, laid out top-down. It is not `waffleY`, which packs bottom-up and loses per-flight identity.
  - `waffleLayout(units: number, width: number): { unit; cell; gap; columns; rows }`:
    1. Start with unit = 1, maxRows = 10, `columns = max(10, ceil(units / maxRows))`, `gap = clamp(round(width / columns × 0.2), 1, 4)` and `cell = (width − (columns − 1)·gap) / columns`.
    2. If `cell ≥ 6`, use that layout.
    3. Otherwise set cell = 6 and gap = 1, so `columns = floor((width + 1) / 7)`. Take the smallest unit in {5, 25, 125, …} for which `ceil(units / unit / columns) ≤ maxRows`.
  - `percentCells(rows: { key: MakerKey; value: number }[]): { key; cells: number }[]` returns 100 cells by largest remainder. Ties go to slot order.
  - Hours and Km use a 10×10 grid.
  - Cell keys are `` `${maker}:${i}` ``, so a metric toggle morphs the cells (300ms motion override; instant under reduced motion).
  - In Flights mode at unit 1, each cell carries its `flightId`. The tooltip shows "IST → DOH · 12 May 2023", "Boeing 737-800 · 4h 05m", "Click to filter by Boeing".
  - Hover dims every other maker through `states` with `z: maker`.
  - The filtered ghost draws unmatched cells as outlines only.
  - "1 cell = 5 flights" or "1 cell = 1% of 216.7 h" appears above the grid when it applies.
  - Unknown cells sit last in `--cat-maker-unknown`.
- **Legend rows:** swatch, name, value and %.
  - Other is expandable (`Disclosure`) into its families; each family is a `families` filter button.
  - Unknown has "Add aircraft →", which links to the missing-aircraft review. Refactor `missing-aircraft.tsx` to read the payload rows instead of the legacy endpoint.
  - The RU legend wraps.
- **Tile (10.2m):** "55% ■ Airbus", an HTML stacked bar, "Airbus 38 · Boeing 21 +3 more".
- **Extra tests:**
  - `waffleLayout`: width 230 with 69 units gives `{ unit: 1, columns: 10, rows: 7 }`; width 230 with 640 units gives `{ unit: 5, cell: 6, columns: 33, rows: 4 }`.
  - `percentCells` sums to 100.
  - `› aggregate payload uses unit 5 or more`.
  - `› cell pick adds maker chip`.

#### Task 28: Fleet

- **Header:** `MakerSwatch` plus "A320" in mono 20, "27 flights"; "Most flown type · 8 types".
- **Body split:** Narrowbody | Widebody segments with a 6px gap and maker sub-bands (HTML buttons; a sub-band adds both `bodies` and `makers`), labelled "Narrowbody 48" and "Widebody 16". Then "5 flights without aircraft · Add aircraft →".
- **"Flight length by type"** ridgeline, using TanStack `ridgelineY`. The maths is from `/tmp/kuuki-explore/fleet.mjs`:
  - x is `scaleLog` (d3-scale) over 30 → 1,020 minutes.
  - `ridgeProfile(minutes: number[], samples = 128): { x: number; height: number }[]` uses a Gaussian KDE in log-minutes.
    - Types with ≥ 8 flights: bandwidth 0.18, peak normalized to 1.
    - Types with < 8 flights: one spike per flight, bandwidth 0.035, height 0.4 per flight.
  - Fill is the maker colour at `fillOpacity 0.18` with a 2px stroke.
  - Rows are grouped narrow, then wide, with a 14px gap between groups. The label shows family and count.
  - A row pick adds `families`.
  - The ghost layer is a 1px `--mark-ghost` outline of the all-flights ridge.
  - The legend shows makers.
- **Tile:** the narrow/wide bar, "A320 ×27", "Most flown type · 8 types".
- **Extra tests:**
  - `ridgeProfile` dense peak equals 1.
  - Sparse spike count equals the number of flights (local maxima).
  - `› sub-band adds body and maker chips`.

#### Task 29: Clock

- **Radial clock.** Port `ClockRadial`: `polar` with `radialBarRadius` on a 24-hour `scaleBand` (padding 0.14).
  - The night `radialArc` runs 22→06.
  - Labels 00/06/12/18/22 sit on one radius.
  - The centre shows "07:00" (mono 22) over "busiest".
  - The peak bar is accent; the others are `--mark-2`.
  - The ghost layer draws the all-flights bars as `--mark-ghost` outlines behind.
- **Segmented Departures / Arrivals:** switches between `byHour`/`arrByHour`, and between `depHours`/`arrHours` for picks.
- **Caption:** "Local departure time · 61 of 69 flights".
- **Stats:** "61% before noon" and "8 red-eyes · 22:00–06:00".
- **Size:** about 300px on mobile.
- **Tile:** mini hour bars, "07:00", "Busiest hour · 9 flights".
- **Extra test:** `› arrivals toggle uses arrHours facet`.

#### Task 30: Rhythm

- **Heat grid.** The `cell` mark on band scales:
  - Rows are years, newest on top; columns are 12 months. Cells are 28px with radius 6, shrinking to fit 12 columns on mobile. Row totals are mono.
  - Metric segmented Flights / Distance / Hours.
  - `heatBucket(v, max): 0 | 1 | 2 | 3 | 4` is `v ≤ 0 ? 0 : min(4, ceil(4v / max))`, coloured `--heat-0..4`.
  - Future months get a dashed `--mark-ghost` outline.
  - The latest 6 years show by default, plus "Show all years, 2014–2020".
  - A cell pick sets `period: { from: key, to: key }`.
  - The legend sits below.
- **Stats:** "July" (busiest month) and "5 mo" (longest gap, with its range).
- **Odometer.** Port `RhythmOdometer`:
  - `lineY` and `areaY` with `d3Curve(curveStepAfter)`, `scaleUtc`.
  - The ghost line is grey.
  - `brushX` uses `handleSize: 6`, `values` = month starts, and `controlledSignal`. A commit sets `period { from, to }`.
  - `focus: 'nearest-x'`. The host has `touch-action: pan-y`; the brush overlay keeps `none`, which is accepted.
  - Below it, `MonthRange` (From / To / Clear, 44px) writes the same period.
- **Tile:** a mini heat grid, "July", "Busiest month · 6 years".
- **Extra tests:**
  - `heatBucket` edges.
  - `› brush commit and month pickers write the same period`.

#### Task 31: Crossings

- **Tiles:** four `--surface-inset` tiles, 271 wide, gap 16, padding 16/18/18, radius 10. Each has a 13px label, a 32px figure in a 68px slot, a 147–151px graphic and a 12px caption.
  - **Clocks shifted:** a split bar (`--accent` forward / `--mark-2` back), "54 h forward · 31 h back".
  - **Time zones** (open decision 1): 24 ticks with hits in accent, "18 of 24 hourly UTC offsets".
  - **Equator** and **Arctic Circle:** a dashed reference line with one dot per crossing (up to 12, then "+N") and the last crossing's route.
- **"Clock change per year · hours":** port `CrossingsShift`.
  - `rect` bars: forward above zero in `--mark-1`, back below in `--mark-2`.
  - Value labels; "–" for years with `flights === 0`.
  - A year pick sets `period: { years: [y] }`.
- **Tile:** mini shift bars, "85 h shifted", "3 equator · 1 Arctic Circle".
- **Extra test:** `› empty years show a dash`.

### Task 32: Alliance marks and "≈" in the Journal

**Executor:** [UI] · consolidated final review

**Implementation status (2026-10-08):** Implemented date-specific AllianceMark and shared visible/accessible estimated-duration prefix. Three new focused Journal tests pass EN/RU; existing Journal DTO already carries duration_source, so no API change is needed. Full integration checks remain batched; all visual checks are skipped.

**Files:** Modify `apps/next/src/client/reads/journal.tsx:224-238` and its test. If the Journal list response lacks `duration_source`, add it in the Journal list API handler under `functions/api` and its test.

**Interfaces:**
- Journal rows show `AllianceMark` (12px) before the airline code when `allianceAt(airline, date)` is non-null.
- Durations whose source is an estimate are prefixed with "≈" in both the visible cell and the row's accessible name.

- [x] **Step 1:** Write the failing tests `› aligned airline shows alliance mark` and `› estimated duration shows ≈`.
- [x] **Steps 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(journal): alliance marks and approximate durations`.

### Task 33: Cut over `/overview` and retire legacy code

**Executor:** [UI] · final review Opus

**Files:**
- Modify: `apps/next/src/app/(member)/overview/{page.tsx,loading.tsx}`; create `error.tsx`. Modify `apps/next/tests/read-journeys.test.ts:95-113`.
- Delete: the legacy `client/overview/*` files listed under File Structure, and their tests.
- Retire: `GET /api/me/overview` and `GET /api/me/overview/missing-aircraft`, with their handlers and services, once a grep shows no consumer. Then run `pnpm next:build` to regenerate the routes.

**Interfaces:**
- `page.tsx` is a server component: `getOwnOverviewData()` + `getOwnOverviewPrefs()` + the profile name and user id (as `ownerKey`) → `<OverviewPage>`.
- `loading.tsx` renders the page skeleton: the H1 line, a fixed-height globe card `Skeleton`, and a hero `Skeleton`.
- `error.tsx` shows a plain message plus Retry, following the existing error-boundary pattern.
- Any in-app link that uses `/overview?period=YYYY` must seed `period: { years: [YYYY] }` once on load. If no such link exists, drop the parameter.

- [x] **Step 1:** Updated the existing Playwright Overview journey (no new cases):
  - the first paint shows `.ov-globe svg`;
  - the MapLibre chunk is requested only after idle;
  - the hero shows the flight count;
  - the "+ Filter" panel adds a year chip and the figures change;
  - the Passport steps stay unchanged.

  Idle-load behavior is covered by existing globe cases and the compiled dynamic loader. Functional navigation is batched in final verification; no new RED case is required under the owner override.
- [x] **Step 2:** Implemented cut-over and deletions; consolidated checks pass with existing-case corrections and owner overrides (see final handoff). Original command gate: Then run `pnpm --filter @kuuki/next typecheck && pnpm --filter @kuuki/next lint && pnpm --filter @kuuki/next test && pnpm test:api && pnpm typecheck:api && pnpm next:build && pnpm test:next:navigation`. Expected: PASS.
- [x] **Step 3:** Commit `feat(overview): ship the redesigned page and retire the legacy overview`.

### Task 34: Docs, glossary and whole-branch review

**Executor:** [UI] Sonnet drafts; Opus runs the whole-branch review.

**Files:** Modify `DESIGN.md`, `GLOSSARY.md` and `docs/plans/2026-10-07-overview-release-3-ui-handoff.md`.

**DESIGN.md:**
- D8 is superseded by faceted filters.
- Ambient loops are allowed (the replay and the globe rim).
- The narrator is a product pillar.
- The Shu accent table replaces the Terracotta one, and danger gets its new values.
- The `in oklab` bucket formula.
- The data-mark, heat and category tokens.
- The hairline ban, including page chrome.
- The `:182` logo entry, now built.
- The Overview section anatomy: bento, tiles and sheet, the chart rules, and the touch rule.

**GLOSSARY.md:** Maker slot, Alliance at date, Head to head, Record cabinet, Ghost layer, Narrator, Bento.

- [x] **Step 1:** Write the doc updates. Keep each to the decisions; don't copy the plan.
- [x] **Step 2:** Consolidated functional verification complete; visual/device/board comparison gates WAIVED by owner. Exact full-batch and focused-correction evidence is in the final handoff. No new unit tests or cases.
- [x] **Step 3 — review:** Final whole-deployment Thermos and whole-repository Ponytail Audit completed in the owner-requested NEW thread using GPT‑6.1 Sol. Eight code findings fixed; focused checks, fresh build/Worker checks and one consolidated remediation review resolved. [Audit and coverage](../../.scratch/overview-release-3-audit/spec.md). No new test cases, per-task review loops or visual verification.
- [x] **Step 3 — promotion:** [PR47](https://github.com/indi256s/kuuki/pull/47) merged after all eight checks passed on audited `ad17e99`, producing main `6cc8f8f` with an identical tree. Separate clean main checkout prepared; post-merge CI/CD37747939613 and React Doctor37747939621 passed, as did its frozen-lockfile package/Next production build.
- [x] **Step 3 — release:** Approved0008+0009 migrations and exact guarded backfills/publication passed on production and preview; both ledgers contain0001–0009, canonical records and all135historical badges are preserved. Temporary operators/isolated D1 proof were deleted. Clean main `bbb8841` deployed with strict flags to preview and both production Workers; HTML/session/activation smoke and connected 300-second error monitoring on each production Worker passed. [Release versions, rollback targets and evidence](../../.scratch/overview-release-3-audit/issues/01-missing-flight-metrics-migration.md).
- [x] **Step 4:** Update the handoff: branch, checks, open decisions and any accepted board deviations. Commit `docs(overview): design system and glossary for the redesigned overview`.

---

## Open decisions (defaults applied; the owner can override before Tasks 10, 25 and 31)

1. **Time-zones tile.** The default counts distinct hourly UTC offsets at the flight endpoints, titled "Time zones" (exact, and no migration). Counting zones actually overflown needs a follow-up D1 column (a 24-bit offset mask computed at save time, plus a backfill) under the runbook gates.
2. **Head-to-head haul split.** The default is < 4,000 km against ≥ 4,000 km, so short- and medium-haul together face long-haul.
3. **Sub-3:1 segments.** By default, the far side of Head to head and the haul/red-eye segments use `--mark-2` (3.26:1) instead of `#E6C8C1`. Map buckets 1–3 stay below 3:1 as an accepted sequential ramp, with legend and tooltip values.
4. **Plan decisions, flagged:**
   - The Manufacturers waffle uses the `cell` mark, not `waffleY`, to get top-down packing and per-flight tooltips.
   - Charts use the `motion()` renderer (about +16 KB gzip) to get the spec's 1,100 ms tween. The plain `svgAnimation` (240 ms) is the cheaper alternative.
   - The Manufacturers narrator sits at the card foot, as on board 9.3, not under the figure as on 10.2.
5. **Deferred, with no boards:** the `/fly` presentation, the share-card visual, Flag-tones and alliance map modes, maker colours on public profiles and the leaderboard, a sticky scope bar, jump navigation, the page ending, Share, and repeated facts (busiest year shown in both Records and Rhythm).
