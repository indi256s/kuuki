# Achievements as ladders: code spec

Status: ready-for-agent. Branch `feat/achievements-ladders`. Written 2026-10-13.

Design sources, owned by the main checkout at `/Users/indi256/Documents/kuuki/kuuki/.scratch/achievements-redesign/`, and read in this order:

1. `final-brief.md` (objects, rules, per-object notes; it wins conflicts)
2. `variants-brief.md` (names EN/RU, thresholds, Normal and To-go copy, Japanorama rules)
3. `copy-sharp.md` (one Sarcastic line per rung)

The profile cabinet contract is in this worktree's `.scratch/profile-redesign/spec.md`: earned only, for everyone; owner unboxing; the "New" pill. Paper boards 24.x are unfinished and give only a rough idea.

## 0. What exists today (verified)

- **Definitions.** `db/seed/badge_definitions.sql` holds legacy ids 1–18 (milestone, geographic, airline, aircraft and `continent-*` rows) and ladder rows:
  - flights-1..5 (1/25/50/100/500)
  - distance-1..5 (10k/50k/100k/500k/1M km)
  - airlines-1..3 (5/15/30)
  - aircraft-1..3 (5/20/50)
  - cities-1..5
  - airtime-1..5 (`airtime_minutes` 1440/7200/21600/43200/129600)
  - continents-1..5 (2–6)
  - airports-1..5 (5/20/50/100/200)
  - countries-1..5 (5/15/30/50/100)
  - `founding-user` (id 63)
- **Evaluator.** `functions/api/_services/stats.ts` `badgeStatements` awards `flights`, `distance_km`, `airlines`, `aircraft`, `continents`, `flight_minutes`, `night_departure` and `early_adopter` only. **`countries`, `airports` and `airtime_minutes` have no branch, so those three ladders are never awarded,** although `user_stats` already computes `countries_count`, `airports_count` and `total_duration_minutes`.
- **Cabinet.** `apps/next/src/client/profile/profile.tsx` `BadgeCabinet` (4-col grid, 3-col mobile, `COLLAPSED = 6`) renders one tile per earned badge row with a metal glyph, and opens a `Sheet` (right on desktop, bottom on mobile). `unseen.ts` keeps the `badge-cabinet` and `badge-events` baselines. `badge-notifications.tsx` raises the toast. `achievements.ts` holds the names and metals.
- **Profile route.** `app/(public)/fly/[username]/page.tsx` has `stats` (a `toUserStats` shape, which may be null) and `badges` for owner and visitor alike.
- **Iso kernel.** `client/overview/iso/scene.ts` (`Scene`, `fitBox`) and `iso-figure.tsx` (`IsoFigure`, paints are roles → `--iso-*` CSS vars, light and dark tokens in `app/styles.css`).
- **D10** reads "Existing rank titles become localized achievement names; no new badge rules." It appears in `DESIGN.md:116`, `docs/plans/2026-10-04-redesign-2.0-implementation.md:70` and `docs/plans/2026-10-04-redesign-2.0-ux-ui.md:893`.

## 1. Data model and ladder mapping (`client/profile/ladders/model.ts`)

Pure, client-safe, no React.

```ts
type LadderId = 'flights'|'distance'|'time-aloft'|'countries'|'airports'|'continents'|'airlines'|'aircraft-types'
type Ladder = { id: LadderId; codePrefix: string; thresholds: readonly number[]; metric: (s: LadderStats) => number; unit: 'count'|'km'|'hours' }
type LadderStats = Pick<UserStats, 'total_flights'|'total_distance_km'|'total_duration_minutes'|'countries_count'|'airports_count'|'continents_count'|'airlines_count'|'aircraft_count'>
type LadderTile =
  | { kind: 'ladder'; ladder: LadderId; rung: number; rungs: number; item: EarnedBadge /* the top earned rung's row */ }
  | { kind: 'founding'; item: EarnedBadge }
```

- **`LADDERS`** is in display order: flights, distance, time-aloft, countries, airports, continents, airlines, aircraft-types. The code prefixes are `flights-`, `distance-`, `airtime-`, `countries-`, `airports-`, `continents-`, `airlines-` and `aircraft-`. Thresholds copy the seed (airtime in minutes). The display unit for time aloft is hours.
- **`ladderOf(code)`** returns `{ ladder, rung } | null`. Only `^<prefix>(\d)$` with rung in range matches. Everything else is hidden: legacy ids 1–18, `cities-*` (no object in the final list), and unknown codes.
- **`toTiles(badges)`** returns one tile per ladder at its **highest earned rung**: each achievement counts once, and lower rungs and duplicates never add tiles. It adds one `founding` tile when `founding-user` is present. Order: founding first, then ladders in `LADDERS` order.
- **`nextStep(ladder, rung, stats)`** returns `{ rung: rung + 1, remaining } | null`. It returns null at the top rung, when stats are missing, or when `remaining ≤ 0`. That last case covers a stat that is ahead of the award, which is caught up on the next repair. `remaining` is in display units: hours = `ceil((threshold − minutes) / 60)`, km rounded up, counts as is. Founding is never "next up".
- **`visibleBadges(badges)`** keeps ladder rows and `founding-user`. The toast and the cabinet baseline use it, so hidden rows never toast or unbox.

## 2. Copy (`client/profile/ladders/copy.ts`)

EN/RU pairs in the `overview/copy.ts` style (`p(en, ru)`, `t(pair, locale)`), and Russian uses «вы». Use the `glados-copy` skill.

| Key | Source |
|---|---|
| `LADDER_NAME[id]` | Flights / Перелёты · Distance / Расстояние · Time aloft / Время в воздухе · Countries and territories / Страны и территории · Airports / Аэропорты · Continents / Континенты · Airlines / Авиакомпании · Aircraft types / Типы самолётов |
| `RUNG_NAME[id][rung-1]` | variants-brief, names lists |
| `SARCASTIC[id][rung-1]` | copy-sharp, verbatim; Airlines rung 2 fills `{n}` with the current airlines count, or the threshold when stats are missing |
| `normal(id, value, locale)` | variants-brief Normal lines, generalised per ladder with the **current** value, falling back to the earned threshold. Time aloft uses days when ≥ 48 h ("15 days in the air." / «15 суток в воздухе.», with real plural forms through the shared formatter); below that, hours. |
| `toGo(id, remaining, locale)` | "Flights to go: 50" / «Осталось перелётов: 50»; Kilometres / км, Hours / часов, Countries / стран, Airports / аэропортов, Continents / континентов, Airlines / авиакомпаний, Types / типов; numbers via `Intl.NumberFormat(locale)` |
| `rungOf(n, m)` | "Rung 3 of 5" / «Ступень 3 из 5» |
| Founding | name "Founding crew" in both locales; Normal "Here since before launch." / «С нами с самого начала.»; Sarcastic from copy-sharp |
| Misc | "New" / «Новое», "Earned {date}" / «Получено {date}», "Top rung" / «Верхняя ступень» (the strip's next slot when the top rung is reached) |

The old `achievements.ts` `badgeName`, `badgeTier` and `badgeDescription` lose their callers. Delete the metal tiers. Keep `badgeEventId` and `EarnedBadge`.

## 3. Figures (`client/profile/ladders/figures/`)

The contract is in `figures/types.ts`, and its rules are enforced by `figures/figures.test.ts`:

- `LadderFigureDef { id, rungs, build(k, { rung, lod, initials? }) }`
- The builder uses the app's `Scene` (not the anatomy kit's runtime), so paints stay theme roles.
- There is exactly one `group('lit')`, holding the accent part, which is the thing that changed at this rung. No other node uses an accent paint.
- No text, except the Flights top rung's initials on the tail.
- Output is deterministic.
- `lod: 'thumb'` drops sub-pixel detail and is never denser than `hero`. Every rung draws differently.

One file per ladder. Each worker owns exactly one:

| File | Export | Object | Rungs | Lit part | Top-rung joke |
|---|---|---|---|---|---|
| `flights.ts` | `flights` | The aircraft that grows: paper plane → Cessna (high wing, strut, prop) → turboprop (two nacelles, T-tail) → narrowbody (twin underwing engines) → widebody (twin big fans, two aisles' worth of windows) | 5 | the new class's distinguishing part (e.g. the prop disc, the nacelles, the engines) | the holder's initials on the widebody tail (`initials`; `ink`/`on-accent` text, not lit) |
| `distance.ts` | `distance` | Duty-free triangular chocolate bar: a triangular prism in a card sleeve with peaks visible past the sleeve and a foil end; it gets longer each rung (snack, standard, long, extra long, absurd) | 5 | the newest length segment | the bar spans a gap between two shelf ends like a jet bridge, with a price tag still on (tag shape plus ruled lines, no text) |
| `time-aloft.ts` | `timeAloft` | The in-flight meal tray: the same tray and the same tray-table edge every rung. Pretzel bag → sandwich box → hot meal with foil lid → full tray with dessert → birthday cake | 5 | the new item | a cake with candles (the candle flames may be the lit part) |
| `countries.ts` | `countries` | Ink pad and stamped sheet: the sheet fills with stamp impressions | 5 | **the fresh impression as a stamp ring with ruled lines in accent, not a filled block** | e.g. impressions overflow onto the pad's lid |
| `airports.ts` | `airports` | Radar scope: a round CRT in a console, with blips building | 5 | the sweep (or the newest blip) | e.g. a crowded scope with a sticky note on the bezel |
| `continents.ts` | `continents` | Cork map: a framed cork board with six region outlines and one pin per continent | 5 | the newest pin head | e.g. the sixth pin pushed in so hard the frame cracked |
| `airlines.ts` | `airlines` | Patchwork tail fin: one airline livery band (shapes and stripes, no logos) → a messy repaint over it → a full patchwork quilt | 3 | the newest livery band | a ladder, a paint tin and a roller left at the fin, with no painter |
| `aircraft-types.ts` | `aircraftTypes` | The stretch: the same airframe in a long side-on iso body with a countable door rhythm. Short body → fuselage plugs (longer, one more door pair) → absurdly stretched | 3 | the newest plug | far too many doors, with the tail barely in frame |

The rung-to-threshold mapping comes from `variants-brief.md` (Countries rungs 5/15/30/50/100 = 1–5 impressions is too sparse at the top; draw impression counts that read, such as 1, 3, 6, 10 and a full sheet, not literal counts).

Mandatory owner notes, from the final brief:

- **Countries.** Seat the stamp handle on the pad or the sheet, and never cut the sheet edge.
- **Airports.** The rung 3 holding oval is a solid faint trail that fades toward its tail. It is never dashed: draw it as segments of decreasing opacity, or as a thin accent-free `detail` path in steps.
- **Continents.** Use real cork, a fine deterministic speckle that fades toward the frame (hero only; the thumb drops it). The next rung's pin must clearly differ from the earned pins at 56px; this is handled by state CSS (§4) plus the pin's geometry.
- **Flights vs Aircraft types.** These must look clearly different. Flights changes the class and silhouette and shows the whole aircraft. Aircraft types keeps one airframe at a long side-on framing with doors you can count.

Drawing quality follows `~/.claude/skills/anatomy/SKILL.md` and `references/craft.md`:

- many small, precise solid parts, with crease and line tones, painter's order, and 1px strokes;
- lines end on edges or fade;
- no chunky toy boxes, and no people (only the traces they leave);
- a contact shadow under the base.

The 56px check comes before polish: in the harness strip, each rung must be told apart from its neighbours with no label.

**Preview harness.** `pnpm exec tsx .scratch/achievements-redesign/preview/build.ts <id> [--showcase N]` writes `.scratch/achievements-redesign/preview/out/<id>.html` with heroes 320×200, own-fit 56px tiles and the rung strip, in dark then light. Screenshot it with `agent-browser --session <id>` and downscale with `sips -Z 1200`.

**Component (`client/profile/ladders/ladder-figure.tsx`).** `LadderFigure({ ladder, rung, size: 'hero'|'thumb', state?: 'earned'|'next'|'later', fitK?: number, initials? })`:

- `useMemo` computes `k` with `fitBox`. The hero box is 320×200 with k capped at 2.2; the thumb box is 56×56.
- It renders `<IsoFigure>` inside `<span className="ladder-figure" data-size data-state>`.
- The strip passes one shared `fitK`, the minimum over the ladder's rungs, so growth reads. The tile and the hero fit their own rung.

**State CSS (`client/profile/ladders/ladders.css`).** Thumbs are line-only: faces take the mark's background, strokes take `--text-muted`, the lit part stays accent, and there is no glow or shadow. `next` and `later` restroke everything, accent included, with a new token **`--iso-ghost-line`** (dark `#897e70`, light `#a39a91`); `later` is at 40% opacity. It is the same as the harness CSS.

## 4. Cabinet and sheet UI

These go in `client/profile/profile.tsx` (`BadgeCabinet` is renamed `AchievementCabinet`) plus `ladders.css`. Remove the old metal glyph CSS.

**Grid.** One tile per `toTiles` entry, in the same grid, collapse and "Show all" as today.

- **Tile.** A 72px round `--surface-inset` mark holding the 56px thumb of that ladder at its rung (earned state). Below it, the rung name (600 16px) and "Rung N of M" (14px muted), centred.
- **Founding tile.** The mark holds the shipped `FoundingStub`. The second line is "Founding crew" muted, with no rung line.
- **Block aside.** "N earned" counts tiles.

**Unboxing.**

- `unseenBadges(ownerId, visibleBadges(badges), storage, 'badge-cabinet')`.
- A tile is fresh when any of its ladder's fresh rows is in the batch. It then shows the "New" pill, pinned absolutely to the mark's top-right, plus the existing press (1.08 → 1) and ink-settle keyframes with an 80ms stagger.
- Reduced motion keeps only the pill and ring.
- The first-ever visit only records the baseline.

**Sheet** (same `Sheet`, right on desktop, bottom on mobile):

- **Header.** Title = rung name. Description = "<Ladder name> · Rung N of M".
- **Hero.** `LadderFigure size="hero"` at the earned rung, on a `--surface` stage with radius 20. `initials` come from the holder's display name, as up to two upper-case initials.
- **Copy.** The Normal line (text), then the Sarcastic line (muted), then "Earned <date>" (muted, `formatDateOnly`).
- **Rung strip.** One slot per rung, each with a 56px thumb in state `earned`/`next`/`later` and the rung name at 12px below it.
  - The next slot is about 140px wide and carries the to-go label on one line (`white-space: nowrap`).
  - At the top rung there is no to-go. When stats are null, the next slot shows the ghost and the name only.
  - The strip is a horizontal row that scrolls (`overflow-x: auto`, scroll-snap) when it doesn't fit (mobile 390). There are no divider lines.
- **Founding sheet.** Hero = `FoundingStub` at a larger size. Show Normal and Sarcastic, no strip, and the earned date.
- **Accessibility.** Figures are `aria-hidden`. The strip is a `<ol>` whose items read "<rung name>, earned" / "next: <to-go>" / "locked" through visually hidden text. Tiles keep their 44px-plus targets.

**Toast** (`badge-notifications.tsx`).

- Pass `visibleBadges`.
- Collapse the fresh batch to one line per ladder (the highest fresh rung name) plus founding.
- Names come from `RUNG_NAME`.
- Use the copy table instead of the inline ternaries the toast touches.

## 5. Server: evaluator handlers (Q1 answered 2026-10-13: add them)

In `badgeStatements`, add three branches before `flight_minutes`:

- `countries` → `stats.countries_count`
- `airports` → `stats.airports_count`
- `airtime_minutes` → `stats.total_duration_minutes`

The change is award-only and needs no schema change, no seed change and no migration. Test: one case in `functions/test/derived.test.ts` showing that the three keys award at threshold and not below.

## 6. D10 amendment and docs

- **D10.** Amend the row in all three places to read: "Amended 2026-10-13: achievements are ladders. Each fact is one ladder whose rungs are states of one drawn object, named by the rung names (localized), shown as "Rung N of M" (no metals). Thresholds are unchanged; legacy rows 1–18 and `cities-*` stay in D1 but are hidden in the display. The evaluator gains branches only for criteria already seeded (countries, airports, airtime); no new badge rules."
- **GLOSSARY.md.** Add **Achievement ladder** and **Rung** (and **Founding crew**, a milestone, not a ladder).
- **DESIGN.md.** Add an Illustration table row for the ladder figures (lit part = what changed at the rung; thumbs line-only; ghost states), a `--iso-ghost-line` token row, and a Profile note on the cabinet and sheet.
- **docs/README.md.** In the profile entry, point to `ladders/model.ts` and its tests.

## 7. Tests (one per new failure mode)

- `ladders/figures/figures.test.ts` (exists): the one-lit, no-text, deterministic, rungs-differ and thumb-≤-hero rules, and Flights initials.
- `ladders/model.test.ts`:
  - mapping (hidden legacy, cities and unknown codes);
  - one tile at the highest rung with no duplicates;
  - founding first, and never next;
  - `nextStep` units (hours ceil, km), top rung null, stats null.
- `profile-page.test.tsx`: update the badge expectations to rung names and "Rung N of M".
- `badge-notifications.test.tsx`: hidden rows never toast, and one line per ladder.
- `functions/test/derived.test.ts`: the three new criteria (§5).
- `app/tokens.test.ts`: run unchanged; add `--iso-ghost-line` to `styles.css` in both modes.

## 8. Light, dark and reduced motion

- Every colour is a CSS role. Figures inherit the `--iso-*` tokens per mode, and the only new token is `--iso-ghost-line`. Verify both modes in the harness and on `/fly/<user>`.
- No figure animates. The only motion is the existing unboxing, and reduced motion swaps it for the "New" pill (already in `profile.css`'s reduced-motion block; extend the selectors to the new class names). The sheet uses the existing `Sheet` motion.

## 9. Tasks

| # | Task | Owner | Files (exclusive) | Depends |
|---|---|---|---|---|
| T0 | Contract, registry, stubs, harness, figure test | main thread (done) | `ladders/figures/{types,index,figures.test}.ts`, preview | – |
| F1–F8 | One figure each (table §3) | Sonnet, parallel | `ladders/figures/<id>.ts` only | T0 |
| T1 | Model + copy + model tests | Sonnet | `ladders/model.ts`, `ladders/copy.ts`, `ladders/model.test.ts` | T0 |
| T2 | Evaluator handlers + test | Sonnet | `functions/api/_services/stats.ts`, `functions/test/derived.test.ts` | – |
| T3 | LadderFigure + ladders.css + token + cabinet + sheet + toast integration | main thread | `ladders/ladder-figure.tsx`, `ladders/ladders.css`, `profile.tsx`, `profile.css`, `badge-notifications.tsx`, `achievements.ts`, `styles.css`, the page | T1, F* |
| T4 | Docs (D10, GLOSSARY, DESIGN, README) | Sonnet | the docs above | T3 |
| T5 | Verify: typecheck, lint, tests, browser (desktop dark and light, mobile 390, RU, reduced motion, console) | main thread | – | T3 |
| T6 | Final code review: Sol high via T3 `delegate_task`, once; optional figure review on Opus high | main thread | – | T5 |

## 10. Assumptions (reversible) and open decisions

**Assumptions:**

- **Cabinet.** One tile per ladder at the highest rung.
- **Aside count.** The "N earned" aside counts tiles.
- **Toast.** The toast collapses to one line per ladder.
- **Cities.** `cities-*` is hidden because it has no object in the final list.
- **Visitors.** The visitor sheet shows the strip and the to-go too: the public stats are already public, so this leaks nothing new.
- **Normal line.** The Normal line uses the current value. Time aloft shows days at 48 h or more.
- **Tokens.** Drawing tokens come from the app's `--iso-*` (DESIGN), not the brief's Paper hexes. They are close, and the app is the source of truth.
- **Initials.** Initials come from the display name, then the handle.

**Q1 (answered: add handlers).** Should the evaluator start awarding countries, airports and time aloft (§5)?

- **Yes:** after the next deploy, each member's next derived-state repair awards the rungs they already qualify for, so returning members get one toast batch with several new rungs.
- **No:** those three ladders stay empty in the cabinet. Their figures are still built.
