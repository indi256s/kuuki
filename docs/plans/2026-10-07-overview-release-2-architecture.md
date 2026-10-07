# Overview Release 2: Data Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build everything the new Overview needs below the UI:
- one owner payload;
- a pure stats engine in `packages/shared` (filters, figures, the six sections, globe data);
- preferences;
- the public `/fly` subset;
- the share-card pipeline;
- schedule suggestions;
- legacy stats retirement after parity.

**Architecture:** The Worker serves one `no-store` owner payload of weighted rows plus reference subsets. It is revalidated by ETag, and above 5 000 flights it switches to monthly route aggregates. `computeOverview(payload, filter)` is pure and deterministic. The Overview client runs it in memory, and the `/fly` Worker runs it for the public subset, so there is one implementation and no stats SQL per facet.

Chartable outputs are tidy row arrays that TanStack Charts marks take as they are. The same rows render in the browser (`<Chart>`), during SSR, and as DOM-free SVG in the Worker for the share card.

**Tech Stack:** TypeScript, D1/Workers, Next App Router (data helpers only), Vitest + Miniflare, `@tanstack/charts@1.0.0` (all charts: SVG, SSR, DOM-free `createChartScene` + `renderChartSvg`), `fast-check@4.10.2` (dev), `@cf-wasm/og@0.5.0` (share card, verified in a spike), Gemini via the existing enrichment client.

**Spec:** `.scratch/overview-redesign/decisions.md`. Release 1 (`docs/plans/2026-10-07-overview-release-1-migrations.md`) must be live: every flight has great-circle distance, `duration_source`, `zones_overflown`, filled tz, and the `profiles.overview_prefs` column.

**Not in this plan (design thread):** page layout, globe rendering/flightcn, replay timing and controls, section drag/hide UI, narrator triggers and corpus, share-card visual layout, "≈" presentation, filter popover. Also the TanStack Charts `defineChart` definitions themselves: chart choice, scales, colours, legends, tooltips. The engine returns numbers and codes, never copy.

## Global Constraints

- **Inclusion:** stats count `logged` + `awaiting` (awaiting reported separately). `upcoming` never counts but is in the payload for ghost arcs and the Next strip.
- **Filters:** OR within a facet, AND across facets.
  - Facets: period (years, or a month range), country, region, airline, aircraft, route (undirected `AAA-BBB`, sorted), manufacturer, body type, haul, domestic/international, departure band.
  - Country/region match origin or destination **country evidence after D12 suppression**. Transit stops excluded.
- **Plan-chosen constants (one file; the spec leaves them open):**
  - Haul by distance (Eurocontrol): short < 1 500 km, medium 1 500–4 000, long ≥ 4 000.
  - Departure bands by local departure time: night 22:00–06:00, morning 06–12, afternoon 12–18, evening 18–22.
  - Red-eye = night band, as in the wireframe.
- **Section minimums:** Records ≥ 5 flights, Crossings ≥ 3 with both tz, Fleet ≥ 5 typed, Clock ≥ 10 with departure time, Rhythm ≥ 2 distinct months. Below a minimum the section returns `{ status: 'below', have, need }`.
- **Precision:** stats that need precise durations (speed, duration records, Clock) exclude `duration_source = 'estimate'`. Totals include estimates and set `approximate: true` when any are present.
- **Deltas:** same filter, previous period of equal length. `null` for all time and for non-contiguous period sets.
- **Countries figure:** the Passport count when the filter is empty; otherwise countries reached by air in scope (`source: 'by_air'`).
- **Payload:** `Cache-Control: no-store`; the client keeps it in memory only and revalidates with `If-None-Match` on focus/visibility. Aggregate mode applies when the payload would carry more than `AGGREGATE_THRESHOLD = 5000` rows.
- **Public `/fly`:**
  - only for `is_public` profiles;
  - routes and airports without counts;
  - nothing finer than a month;
  - no home, flight numbers, ids or times;
  - only the sections the owner enabled (Records, Fleet);
  - Records excludes day-level entries.
- **Charts:** every chart uses TanStack Charts: `@tanstack/charts@1.0.0` pinned exactly, `@tanstack/charts/react` in Next, `createChartScene` + `renderChartSvg` in the Worker. Add no other chart library.
  - Chartable engine outputs are tidy arrays of plain objects, one row per mark datum, each with a stable string `key`. This is the shape `barY(rows, { x, y })` and `cell(rows, { x, y, color })` take.
  - Do not use `Record` maps or positional arrays for chart data.
  - Grids are zero-filled, so a heatmap needs no gap handling.
- **Share card:** PNG 1 200 × 1 500.
- **No CO₂ anywhere.**
- **Commits:** no Claude/AI attribution.
- **Task test steps:** `pnpm test:api -- <test file>` for shared/functions tests, `pnpm --filter @kuuki/next test -- <name>` for client tests. "Step 2–4: FAIL → implement → PASS" means:
  1. Run that command; expect failure (missing module or assertion).
  2. Implement the task's Interfaces.
  3. Re-run; expect PASS. Then run the full `pnpm test:api` and `pnpm typecheck:api`.
- **Verification:**
  - `pnpm typecheck:api` and `pnpm test:api` (shared tests run there via the Release 1 include).
  - `pnpm --filter @kuuki/next test` for client code.
  - `pnpm next:build` when routes change: it regenerates `apps/next/api-routes.generated.ts`, which is committed with the route.

## Review Focus

1. **A scope with zero matching flights** (a country reached only through a suppressed transit). Expected: figures 0, every gated section `below`, `centroid null`, no `NaN`/`Infinity`. Test: Task 5 `empty scope is finite`.
2. **Only upcoming flights, or only estimates.** Expected: figures 0 with upcoming rows still in `globe.ghosts`; speed `null`, never 0 or NaN. Tests: Task 5 `upcoming never counts`, Task 8 `speed needs precise durations`.
3. **Month-range and multi-year periods.**
   - Nov 2025–Feb 2026 compares with Jul–Oct 2025.
   - `{years: [2019, 2024]}` gets no delta.
   - `{years: [2023, 2024]}` compares with 2021–2022.
   
   Test: Task 4 `previous period`.
4. **Stale remembered prefs**: an airline no longer flown, an older prefs version, malformed JSON. Expected: unknown facet values are kept but match nothing (so the H1 can still name them); malformed or old prefs read as defaults; never a 500. Tests: Task 11.
5. **Public endpoint on a profile that turned private, or an unknown username.** Expected: identical 404s. The response never contains a `YYYY-MM-DD` date, `home`, `flightNumber` or per-route counts. Test: Task 14 `public subset leaks nothing finer than a month`.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/overview/model.ts` | Payload, row, filter, scope types and constants |
| `packages/shared/src/overview/aggregate.ts` | Monthly route aggregation of rows |
| `packages/shared/src/overview/filter.ts` | Facet matching, sanitising, previous period |
| `packages/shared/src/overview/figures.ts` | Figures, deltas, coverage, home |
| `packages/shared/src/overview/records.ts`, `crossings.ts`, `fleet.ts`, `clock.ts`, `rhythm.ts`, `rankings.ts`, `globe.ts` | One section each (pure) |
| `packages/shared/src/overview/compute.ts` | `computeOverview` entry |
| `packages/shared/src/overview/__fixtures__/` | Golden payloads |
| `packages/shared/src/overview/prefs.ts` | Prefs schema, defaults, parse |
| `functions/api/_services/overviewData.ts` | Payload builder (D1) |
| `functions/api/me/overview/data.ts`, `prefs.ts`, `share.png.ts` | Owner endpoints |
| `functions/api/public/profiles/[username]/overview.ts` | Public subset |
| `functions/api/flights/schedule-suggestions.ts`, `schedule-batch.ts` | Schedule rung |
| `apps/next/src/client/overview/data-store.ts` | Memory store + revalidation |
| `scripts/overview-parity.ts` | Legacy parity report |

Section types are declared in each section's task. `compute.ts` composes them.

---

### Task 1: Aircraft family data

**Files:**
- Modify: `packages/data/src/aircraft.json` (add `family` to all 215 entries), `packages/data/src/index.ts` (the `Aircraft` type gains `family: string`)
- Create: `packages/data/src/aircraft-family.test.ts`; add `'packages/data/src/**/*.test.ts'` to `functions/vitest.config.ts` `include`

**Interfaces:**
- Produces:
  - `Aircraft.family: string`.
  - `familyOf(icao: string, ref?: { model: string | null }): string | null`, exported from `packages/data/src/aircraft-lookup.ts`. Order: the package family, else `ref.model`, else null.
- Curation rule: family = the marketing family across variants and engine options.
  - Airbus: A318–A321 ceo/neo → `A320`; A332–A339 → `A330`; A359/A35K → `A350`.
  - Boeing: B731–B739, B37M–B3XM → `737`; B744/B748 → `747`; B752/B753 → `757`; B762–B764 → `767`; B772–B779 incl. B77L/B77W → `777`; B788–B78X → `787`.
  - Regional: E170–E195 and E290/E295 → `E-Jet`; CRJ1–CRJX → `CRJ`; AT43–AT76 → `ATR 42/72`; DH8A–DH8D → `Dash 8`.
  - Anything else → its `model`.

- [x] **Step 1: Write the failing test** `every type has a curated family`.
  - Every entry has a non-empty `family`.
  - `findAircraft('A20N').family === 'A320'`, `B38M → '737'`, `B77W → '777'`, `E195 → 'E-Jet'`, `AT72 → 'ATR 42/72'`.
  - Distinct families < 215.
  - `familyOf('ZZZZ', { model: 'Foo 1' }) === 'Foo 1'`, and `familyOf('ZZZZ') === null`.
- [x] **Step 2:** `pnpm test:api packages/data`. Expected: FAIL.
- [x] **Step 3:** Add the field (mechanical; apply the rule) and `familyOf`.
- [x] **Step 4:** Re-run. Expected: PASS. Run `pnpm typecheck:api`.
- [x] **Step 5:** Commit `feat(data): curated aircraft families`.

### Task 2: Payload contract, aggregation and builder

**Files:**
- Create: `packages/shared/src/overview/model.ts`, `packages/shared/src/overview/aggregate.ts`, `functions/api/_services/overviewData.ts`, `functions/test/overview-data.test.ts`
- Modify: `packages/shared/package.json` (export `"./overview/*"`)

**Interfaces:**
- Consumes: `DurationSource` (Release 1), `familyOf` (Task 1), `COUNTRY_REGION` (`functions/api/_lib/countryRegions.generated.ts`), `readPassport` (`functions/api/_services/passport.ts`), `stateOf` (`derivedState.ts`).
- Produces (`model.ts`):

```ts
export const AGGREGATE_THRESHOLD = 5000
export interface OverviewRow {
  id: number                    // aggregate mode: smallest id in the group
  weight: number                // 1, or flights in the group
  date: string                  // local departure date; aggregate mode: 'YYYY-MM-01'
  state: 'upcoming' | 'awaiting' | 'logged'
  origin: string; destination: string
  airline: string | null; aircraft: string | null
  flightNumber: string | null   // null in aggregate mode
  depMinute: number | null      // local minute of day; aggregate mode: hour × 60
  distanceKm: number | null; durationMinutes: number | null; zonesOverflown: number | null  // sums in aggregate mode
  durationSource: DurationSource | null
  originTz: string | null; destTz: string | null
  departureUtc: string | null   // null in aggregate mode
  suppressed: 0 | 1 | 2 | 3     // bit 1 origin, bit 2 destination: D12 country evidence suppressed
  recordExtrema?: RecordExtrema  // aggregate-only individual winners with values and ids
  clockShiftMinutes?: number | null  // aggregate-only sum of absolute individual jumps
}
export interface OverviewPayload {
  schemaVersion: 2; etag: string; generatedAt: string; mode: 'flights' | 'aggregate'
  derivedReady: boolean
  passport: { countries: number; regions: number }
  homeOverride: string | null
  rows: OverviewRow[]
  refs: {
    airports: Record<string, { lat: number | null; lon: number | null; country: string | null; city: string | null; name: string }>
    aircraft: Record<string, { manufacturer: string | null; type: string | null; family: string | null; name: string | null }>
    regions: Record<string, string>
  }
}
```

- More interfaces:
  - `aggregateRows(rows: OverviewRow[]): OverviewRow[]`. It groups by `(state, origin, destination, airline, aircraft, month, depHour, durationSource, suppressed)`: it sums weight/distance/duration/zones, keeps the min id and nulls the per-flight fields. Rows are sorted by `(date, id)`.
    Before clearing per-flight dates/times, preserve `recordExtrema` (the five
    Task 6 individual record references, with lowest-ID ties) and nullable
    `clockShiftMinutes` (sum of absolute individual DST-aware jumps). Preserve
    these summaries on re-aggregation. Approved during Task 6; issue 08 records
    the original information loss. Weighted inputs without these summaries
    provide no unsupported individual records or invented clock-shift sum.
  - `overviewEtag(state: { revision: number; evidence_revision: number }): string` → `W/"ov2-<revision>-<evidence_revision>"`.
  - `readOverviewData(db: D1Database, userId: string): Promise<OverviewPayload>`. One `db.batch`: flights, suppressions, referenced airports/aircraft, derived state, plus `profiles.home_airport`. `suppressed` comes from `country_evidence_suppressions` by `(flight_id, endpoint)`. `mode` is `'aggregate'` when `rows.length > AGGREGATE_THRESHOLD`.

- [x] **Step 1: Write the failing tests:**
  - `payload carries every lifecycle state`: 1 upcoming + 1 awaiting + 1 logged → 3 rows with their states.
  - `transit suppression is a bit, not a missing country`: a confirmed connection → destination bit set; `refs.airports[dest].country` still present.
  - `refs are the referenced subset`: airport keys = endpoints plus the owner's
    home override when known in D1; aircraft keys = aircraft used. Unknown home
    overrides add no reference and fall back. The known-home extension was
    approved by the user during Task 5; issue 07 records the failing proof.
  - `aggregate mode preserves totals`: `bulkFlights(db, 5001)` (from `overview-fixture.ts`) → `mode 'aggregate'`, Σweight 5001, Σdistance equals the flight-mode sum.
  - `etag changes with revision`: a mutation changes `etag`.
- [x] **Step 2:** `pnpm test:api -- functions/test/overview-data.test.ts`. Expected: FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Re-run. Expected: PASS.
- [x] **Step 5:** Commit `feat(overview): owner payload contract and builder`.

### Task 3: Owner payload endpoint

**Files:**
- Create: `functions/api/me/overview/data.ts`
- Modify: `apps/next/src/server/overview.ts` (add `getOwnOverviewData()` mirroring `getOwnOverview`), `apps/next/api-routes.generated.ts` (via build)
- Modify: `functions/api/profiles/me.ts` (user-approved home-edit invalidation)
- Test: `functions/test/overview-data.test.ts` (extend)

**Interfaces:**
- Consumes: `readOverviewData`, `overviewEtag` (Task 2); `requireUser`, `runHandler`, `json`.
- Produces: `GET /api/me/overview/data`.
  - 200 with the payload, plus `Cache-Control: no-store` and an `ETag`.
  - 304 with an empty body when `If-None-Match` equals the current etag; the stamp is read with a single `stateOf` before any flights read.
  - 401 when anonymous.
  - A profile PATCH carrying `home_airport` (including clearing it) atomically
    updates the profile and marks the owner dirty, then uses the existing repair
    flow. This keeps the ETag format and stamp-only 304 path valid after home
    edits. Other profile edits do not change the Overview revision. Approved by
    the user on 7 October; issue 06 records the original stale-304 proof.
- Produces: `getOwnOverviewData(): Promise<{ ownerId: string; payload: OverviewPayload } | null>`.

- [x] **Step 1: Write the failing tests:**
  - `serves no-store payload with etag`.
  - `304 on matching etag reads only the stamp`: a spy DB counts statements; expect exactly 1.
  - `anonymous is 401`.
  - Home change and clearing invalidate an old ETag and publish the new stamp;
    unrelated profile edits preserve it. Failed dirty marking rolls back the
    profile update; failed repair retains the edit and a recoverable dirty stamp;
    a missing profile returns 404 without a dirty mark.
- [x] **Step 2:** Run. Expected: FAIL.
- [x] **Step 3:** Implement; run `pnpm next:build` to regenerate routes.
- [x] **Step 4:** `pnpm test:api`, `pnpm --filter @kuuki/next test`. Expected: PASS.
- [x] **Step 5:** Commit `feat(api): GET /api/me/overview/data`.

### Task 4: Filter engine

**Files:**
- Create: `packages/shared/src/overview/filter.ts`, `packages/shared/src/overview/filter.test.ts`
- Modify: `packages/shared/src/overview/model.ts` (add the filter types and constants below)

**Interfaces:**
- Produces:

```ts
export type Haul = 'short' | 'medium' | 'long'
export type DepartureBand = 'night' | 'morning' | 'afternoon' | 'evening'
export interface OverviewFilter {
  period?: { years: number[] } | { from: string; to: string }   // months 'YYYY-MM', inclusive
  countries?: string[]; regions?: string[]; airlines?: string[]; aircraft?: string[]
  routes?: string[]; manufacturers?: string[]; bodyTypes?: string[]
  haul?: Haul[]; domestic?: Array<'domestic' | 'international'>; departureBands?: DepartureBand[]
}
export const HAUL_KM = { medium: 1500, long: 4000 } as const
export const BAND_START_HOUR = { night: 22, morning: 6, afternoon: 12, evening: 18 } as const
```

- More interfaces:
  - `routeKey(a: string, b: string): string`: sorted, `'IST-TBS'`.
  - `haulOf(km: number): Haul`.
  - `bandOf(depMinute: number): DepartureBand`.
  - `rowCountries(row, refs): string[]`: unsuppressed endpoint countries.
  - `matches(row: OverviewRow, filter: OverviewFilter, refs): boolean`.
    - A row missing the attribute a facet needs (no aircraft, no departure time) does not match that facet.
    - Domestic compares raw airport countries, ignoring suppression.
    - Aggregate rows use the per-flight distance (`distanceKm / weight`).
  - `previousPeriod(filter): OverviewFilter | null`. Null when there is no period or the years are non-contiguous.
  - `isEmptyFilter(filter): boolean`.

- [x] **Step 1: Write the failing tests** (rows built inline):
  - `OR within, AND across`: airlines [TK, A9] matches both; adding `countries: ['JP']` keeps only the Japan rows.
  - `transit country does not match`: destination-suppressed row ∉ its destination country, ∈ its origin country.
  - `route is undirected`: `routes: ['IST-TBS']` matches TBS→IST and IST→TBS.
  - `haul and band edges`: `haulOf(1499)` short, `haulOf(1500)` medium, `haulOf(4000)` long; `bandOf(22*60)` night, `bandOf(359)` night, `bandOf(360)` morning.
  - `missing attribute never matches`: aircraft null ∉ `bodyTypes: ['narrowbody']`.
  - `previous period`: {years:[2024]} → {years:[2023]}; {from:'2025-11', to:'2026-02'} → {from:'2025-07', to:'2025-10'}; {years:[2023,2024]} → {years:[2021,2022]}; {years:[2019,2024]} → null; no period → null.
- [x] **Step 2:** `pnpm test:api -- packages/shared/src/overview/filter.test.ts`. Expected: FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Re-run. Expected: PASS.
- [x] **Step 5:** Commit `feat(overview): faceted filter engine`.

### Task 5: Figures, coverage, home and `computeOverview`

**Files:**
- Create: `packages/shared/src/overview/figures.ts`, `packages/shared/src/overview/compute.ts`, `packages/shared/src/overview/figures.test.ts`

**Interfaces:**
- Consumes: Task 4.
- Produces:

```ts
export type Gate<T> = { status: 'ready'; value: T } | { status: 'below'; have: number; need: number }
export interface Figures {
  flights: number; awaiting: number
  distanceKm: number
  durationMinutes: number; durationApproximate: boolean
  countries: { value: number; source: 'passport' | 'by_air' }; regions: number
  deltas: { flights: number; distanceKm: number; durationMinutes: number } | null  // previous-period values
}
export interface Coverage { total: number; typed: number; withDepartureTime: number; withBothTz: number; preciseDuration: number }
export interface OverviewScope {
  filter: OverviewFilter; figures: Figures; coverage: Coverage
  home: { iata: string; source: 'override' | 'most_departed' } | null
  // Tasks 6–9 each add their field here and wire it in compute.ts:
  // records: Gate<Records>; crossings: Gate<Crossings>; fleet: Gate<Fleet>; clock: Gate<Clock>;
  // rhythm: Gate<Rhythm>; rankings: Rankings; globe: GlobeData
}
export function computeOverview(payload: OverviewPayload, filter: OverviewFilter): OverviewScope
```

- Home rule:
  - The override wins when it is a known airport.
  - Otherwise the most-departed origin over **all** counted rows (not the scope); ties go to the alphabetically first IATA.
  - `null` with no counted rows.
- `computeOverview` filters `payload.rows` once with `matches` and passes the counted scope rows (`awaiting`/`logged`) to each section function. `globe` also receives all rows.

- [x] **Step 1: Write the failing tests:**
  - `upcoming never counts`: 2 logged + 1 upcoming → flights 2.
  - `estimates make totals approximate`.
  - `passport count only when unfiltered`: empty filter → `source 'passport'` with `payload.passport.countries`; filtered → `'by_air'`.
  - `deltas follow previous period`.
  - `empty scope is finite`: every number finite. Tasks 6–9 extend this test with their section's `below` result and finite values.
  - `home override and fallback`.
  - `weights count as flights`: one aggregate row with weight 7 → flights 7.
- [x] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [x] **Step 5:** Commit `feat(overview): figures, coverage, home and compute entry`.

### Task 6: Records

**Files:** Create `packages/shared/src/overview/records.ts`, `records.test.ts`; Modify `compute.ts`.

**Interfaces:**
- Produces:
  - `interface RecordRef { flightId: number; origin: string; destination: string; value: number }`.
  - `interface Records`:
    - `longest`, `shortest` by distance;
    - `longestDuration`, `shortestDuration` (precise only);
    - `biggestClockJump` (signed minutes, by |value|);
    - `busiestDay: { date: string; flights: number } | null`;
    - `northernmost`, `southernmost: { iata: string; lat: number } | null` over all endpoints (airport evidence keeps transits);
    - `longestStreakMonths: number` (consecutive calendar months with ≥ 1 flight);
    - `longestGroundStopDays: number | null` (max gap between consecutive flight dates).
    
    Day-level entries (`busiestDay`, `longestGroundStopDays`) are null in aggregate mode.
  - `records(rows, refs, mode): Gate<Records>`. Minimum 5 flights; ties go to the lowest id.
  - Clock jump = `utcOffsetMinutes(destTz, t) − utcOffsetMinutes(originTz, t)`, where `t = departureUtc ?? date+'T12:00:00Z'`.
  - Aggregate records select from `recordExtrema`, preserving real values and
    winning IDs. Missing aggregate extrema return null individual references.

- [x] **Step 1: Write the failing tests:**
  - `below five is gated`.
  - `extremes and ties`.
  - `estimate durations excluded from duration records`.
  - `streak across a year boundary` (2024-11…2025-02 → 4).
  - `ground stop counts days between flight dates`.
  - `aggregate mode nulls day-level records`.
  - `clock jump is DST-aware`: JFK→LHR on 2026-03-28 and on 2026-03-30 give different jumps.
  - Aggregation preserves individual duration extrema, DST clock-jump winners,
    absolute shift sums and lowest-ID ties across groups and re-aggregation.
    Missing summary metadata must not produce records from group means.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): records`.

### Task 7: Crossings

**Files:** Create `packages/shared/src/overview/crossings.ts`, `crossings.test.ts`; Modify `compute.ts`.

**Interfaces:**
- Consumes: `greatCirclePoints` (Release 1).
- Produces:
  - `interface Crossings { zonesOverflown: number; clockShiftHours: number; equator: number; dateLine: number; arcticCircle: number; antarcticCircle: number; eastboundShare: number }`.
    - `clockShiftHours` = Σ|jump| / 60; aggregate rows contribute their stored
      `clockShiftMinutes` rather than recomputing from the collapsed month date.
    - `eastboundShare` = the weighted share of rows whose wrapped longitude delta is > 0.
  - Path crossings are counted on `greatCirclePoints(a, b, 50)`, memoised per directional route.
    - Equator: sign changes of lat.
    - Date line: consecutive lon jump > 180°.
    - Polar circles: crossings of ±66.5634°.
  - `crossings(rows, refs): Gate<Crossings>`: minimum 3 rows with both tz.

- [x] **Step 1: Write the failing tests** (golden values computed from package coordinates):
  - JFK–HKG → dateLine 1, arctic 2.
  - DXB–LAX → arctic 2, dateLine 0.
  - NRT–SFO → dateLine 1.
  - SIN–SYD → equator 1.
  - Weights multiply counts.
  - `below three with tz is gated`.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5:** Commit `feat(overview): crossings`.

### Task 8: Fleet and Clock

**Files:** Create `packages/shared/src/overview/fleet.ts`, `clock.ts`, `fleet-clock.test.ts`; Modify `compute.ts`.

**Interfaces:**
- Produces:
  - `interface ShareRow { key: string; flights: number }`: chart rows, sorted by flights desc then key.
  - `interface Fleet { topType: { icao: string; share: number } | null; byBodyType: ShareRow[]; byManufacturer: ShareRow[]; families: number; types: number; typed: number; total: number }`.
  - `fleet(rows, refs): Gate<Fleet>`: minimum 5 typed.
  - `interface Clock { byHour: Array<{ key: string /* '00'–'23' */; hour: number; flights: number }> /* always 24 rows */; redEyes: number; haul: Array<{ key: Haul; flights: number }> /* short, medium, long */; averageSpeedKmh: number | null; withDepartureTime: number; total: number }`.
  - `clock(rows): Gate<Clock>`: minimum 10 with departure time.
  - `averageSpeedKmh` = Σdistance ÷ Σduration × 60 over precise rows with both values; null when there are none.

- [ ] **Step 1: Write the failing tests:**
  - `top type share of typed`.
  - `families use familyOf`.
  - `red-eye is the night band`.
  - `chart rows are complete`: `byHour` has 24 rows with keys '00'…'23' even when 3 hours have flights; `haul` always has 3 rows.
  - `speed needs precise durations` (only estimates → null).
  - `haul uses per-flight distance in aggregate rows`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(overview): fleet and clock`.

### Task 9: Rhythm, rankings and globe data

**Files:** Create `packages/shared/src/overview/rhythm.ts`, `rankings.ts`, `globe.ts`, `rhythm-rankings-globe.test.ts`; Modify `compute.ts`.

**Interfaces:**
- Produces:
  - `interface RhythmCell { key: string /* 'YYYY-MM' */; year: number; month: number /* 1–12 */; flights: number; distanceKm: number; durationMinutes: number }`.
  - `interface Rhythm { years: number[] /* newest first */; cells: RhythmCell[] }`.
    - `cells` covers 12 zero-filled months for every year from the first to the last flight year (gap years included). It feeds `cell(cells, { x: 'month', y: 'year', color: <metric> })` directly.
    - The design thread decides how many years to show; the spec says the latest 6 plus "Show all", which slices `years`.
  - `rhythm(rows): Gate<Rhythm>`: minimum 2 distinct months.
  - `interface Rankings { airlines: RankRow[]; airports: RankRow[]; routes: RankRow[] }` with `RankRow = { key: string; count: number }`.
    - Full sorted lists: count desc, then key asc. The UI takes the top 5 and builds "versus" rows from them.
    - Airports count endpoint visits.
  - `interface GlobeData`:
    - `routes: Array<{ key: string; a: string; b: string; count: number }>` (in scope);
    - `ghostRoutes: string[]` (route keys of counted rows outside the scope);
    - `airports: Array<{ iata: string; count: number }>`;
    - `countries: Array<{ code: string; visits: number }>` (in-scope country evidence, for the accent ramp);
    - `ghostCountries: string[]` (countries reached by counted rows outside the scope);
    - `ghosts: Array<{ id: number; origin: string; destination: string; date: string }>` (upcoming);
    - `centroid: { lat: number; lon: number } | null`: the visit-weighted 3-D mean of endpoint unit vectors, normalised; null when there are no coordinates or the norm is < 1e-9.
  - `globe(allRows, scopeRows, refs): GlobeData`.

- [ ] **Step 1: Write the failing tests:**
  - `rhythm cells are a full grid`: flights in 2022-12 and 2024-03 → `years [2024, 2023, 2022]`, 36 cells; `2022-12` has the flight, `2023-*` are zeros.
  - `ranking ties are alphabetical`.
  - `ghost routes and countries exclude in-scope keys`.
  - `centroid of TBS×3 + NRT×1 lies between them, nearer TBS`.
  - `antipodal centroid is null`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(overview): rhythm, rankings and globe data`.

### Task 10: Golden fixtures and property tests

**Files:** Create `packages/shared/src/overview/__fixtures__/*.json`, `packages/shared/src/overview/golden.test.ts`, `packages/shared/src/overview/properties.test.ts`; root `package.json` devDependency `fast-check@4.10.2`.

**Interfaces:**
- Consumes: `computeOverview`, `aggregateRows`.
- Fixtures are payloads built by a committed generator in the test file; each is snapshotted with `toMatchSnapshot()`:
  - `polar` (JFK–HKG, DXB–LAX);
  - `dateLine` (NRT–SFO round trip);
  - `redEyeDst` (JFK→LHR 2026-03-28 22:30);
  - `transit` (a suppressed connection);
  - `microstate` (SIN, BAH, MLA, LUX);
  - sizes `n0`, `n1`, `n10`, `n500`, `n5001` (aggregate mode).

- [ ] **Step 1: Write the tests:**
  - **Golden:** each fixture's snapshot, plus explicit asserts:
    - `n0`: all sections `below`, `home null`;
    - `n1`: flights 1;
    - `n5001`: `mode 'aggregate'` and day-level records null;
    - `microstate`: countries 4 by air;
    - `transit`: the connection country absent.
  - **Properties** (fast-check, 200 runs each):
    1. Adding a value to a facet never decreases `flights`.
    2. Adding a facet never increases `flights`.
    3. Σ over single-year filters of `flights` = unfiltered `flights`.
    4. `computeOverview(aggregate(rows))` equals `computeOverview(rows)` for flights, distanceKm, durationMinutes, crossings.zonesOverflown and rankings.
    5. Shuffling `rows` changes nothing (deep equal).
    6. No number in the output is NaN or infinite.
- [ ] **Step 2:** Run. The first run writes snapshots. The reviewer inspects them against the fixtures' known values before accepting.
- [ ] **Step 3:** Fix any engine defect the properties find, in the owning module.
- [ ] **Step 4:** `pnpm test:api`. Expected: PASS.
- [ ] **Step 5:** Commit `test(overview): golden fixtures and property tests`.

### Task 11: Preferences API

**Files:** Create `packages/shared/src/overview/prefs.ts`, `functions/api/me/overview/prefs.ts`, `functions/test/overview-prefs.test.ts`; regenerate routes.

**Interfaces:**
- Produces:

```ts
export type SectionId = 'records' | 'crossings' | 'fleet' | 'clock' | 'rhythm' | 'rankings'
export interface OverviewPrefs {
  version: 1
  filter: OverviewFilter
  layout: { order: SectionId[]; hidden: SectionId[] }
  replayPaused: boolean
  publicSections: { records: boolean; fleet: boolean }
}
export const DEFAULT_PREFS: OverviewPrefs  // empty filter; order as listed; none hidden; replay running; public sections off
export function parsePrefs(raw: string | null): OverviewPrefs  // never throws; unknown/old/malformed → defaults, merged per field
```

- `GET /api/me/overview/prefs` → `OverviewPrefs`.
- `PUT /api/me/overview/prefs` (CSRF) validates with zod 4. It rejects unknown section ids, duplicates in `order`, and serialised length > 8 192 with 400 `INVALID_PREFS`, and stores to `profiles.overview_prefs`. It does **not** bump derived revision.
- The home override stays on `PATCH /api/profiles/me` (`home_airport`).

- [ ] **Step 1: Write the failing tests:**
  - `defaults when unset`.
  - `malformed stored JSON reads as defaults`.
  - `old version merges known fields`.
  - `PUT round-trips`.
  - `oversize and duplicate order are 400`.
  - `PUT without CSRF is 403`.
  - `unknown facet values survive round-trip`.
- [ ] **Step 2–4:** FAIL → implement (+ `pnpm next:build`) → PASS.
- [ ] **Step 5:** Commit `feat(api): overview preferences`.

### Task 12: Client data store

**Files:** Create `apps/next/src/client/overview/data-store.ts`, `data-store.test.ts`.

**Interfaces:**
- Consumes: `OverviewPayload`, `computeOverview`.
- Produces:
  - `createOverviewDataStore(initial: OverviewPayload | null, fetcher = fetch)` → `{ get(): OverviewPayload | null; revalidate(): Promise<'unchanged' | 'updated' | 'failed'>; subscribe(fn: () => void): () => void }`.
    - Sends `If-None-Match: payload.etag` with `credentials: 'same-origin'`.
    - Keeps the old payload on failure.
    - Nothing touches `localStorage`, `sessionStorage`, IndexedDB or the Cache API.
  - `attachRevalidation(store, target: Window & Document)` → detach fn. It listens to `focus` and to `visibilitychange` when visible, at most once per 2 s.
  - `scopeFor(store, filter)`: memoised `computeOverview` keyed by etag + `JSON.stringify(filter)`.

- [ ] **Step 1: Write the failing tests** (vitest + fake fetch):
  - `304 keeps payload`.
  - `200 replaces and notifies`.
  - `failure keeps payload`.
  - `focus burst revalidates once`.
  - `no persistent storage is touched` (spies on Storage).
- [ ] **Step 2–4:** `pnpm --filter @kuuki/next test -- data-store` FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(next): in-memory overview data store`.

### Task 13: TanStack Charts foundation

**Files:**
- Modify: `apps/next/package.json` and the root `package.json`. Add the dependency `"@tanstack/charts": "1.0.0"` to both: Next renders charts in the browser and during SSR, and the Worker functions render SVG for the share card.
- Create: `packages/shared/src/overview/charts.test.ts` (DOM-free), `apps/next/src/client/overview/chart-ssr.test.tsx` (React SSR)

**Interfaces:**
- Consumes: `computeOverview` outputs `rhythm.cells` (Task 9), `clock.byHour` and `fleet.byBodyType` (Task 8).
- Produces: no new runtime API. This task proves the contract the design thread builds on:
  - engine rows go straight into `cell(...)` and `barY(...)` marks with no reshaping;
  - `createChartScene(definition, { width, height })` + `renderChartSvg(scene, { ariaLabel, idPrefix })` works without a DOM;
  - `<Chart definition height ariaLabel />` from `@tanstack/charts/react` server-renders an `<svg>` (prerender uses its 640 × 320 initial geometry).
- The test definitions are fixtures, not product charts. Keep them unstyled: no tokens, colours or legends.

- [ ] **Step 1: Write the failing tests:**
  - `charts.test.ts › engine rows render without reshaping`. For a 10-flight fixture, `defineChart({ marks: [cell(scope.rhythm.value.cells, { x: 'month', y: 'year', color: 'flights', key: 'key' })] })` and `barY(scope.clock.value.byHour, { x: 'key', y: 'flights' })` each go through `createChartScene(def, { width: 600, height: 300 })` + `renderChartSvg`. Expect:
    - the markup starts with `<svg`;
    - it contains the `aria-label`;
    - rendering twice gives byte-identical strings (determinism the share card relies on).
  - `chart-ssr.test.tsx › Chart server-renders svg`: `renderToString(<Chart definition={def} height={320} ariaLabel="Clock" />)` contains `<svg` and `Clock`.
- [ ] **Step 2:** `pnpm test:api -- packages/shared/src/overview/charts.test.ts` and `pnpm --filter @kuuki/next test -- chart-ssr`. Expected: FAIL (package missing).
- [ ] **Step 3:** `pnpm add -w @tanstack/charts@1.0.0 && pnpm --filter @kuuki/next add @tanstack/charts@1.0.0`. Import from subpaths where the docs offer one (`@tanstack/charts/react`, `/svg`, `/scales/band`, `/scales/linear`, `/geo`) so the client chunk stays tree-shaken.
- [ ] **Step 4:** Re-run both tests. Expected: PASS. Then `pnpm next:build`. Expected: success. Record the Overview route's client JS size delta in the commit body.
- [ ] **Step 5:** Commit `chore(charts): add TanStack Charts and prove SSR and DOM-free rendering`.

### Task 14: Public `/fly` subset

**Files:** Create `functions/api/public/profiles/[username]/overview.ts`, `functions/test/public-overview.test.ts`; Modify `apps/next/src/server/public.ts` (add `getPublicOverview(username)`); regenerate routes.

**Interfaces:**
- Consumes: `readPublicProfile`, `readOverviewData`, `parsePrefs`, `computeOverview`.
- Produces: `GET /api/public/profiles/:username/overview` →

```ts
interface PublicOverview {
  routes: Array<[string, string]>           // undirected, deduplicated, sorted
  airports: Record<string, { lat: number; lon: number }>
  records?: PublicRecords   // only if publicSections.records: Records minus busiestDay/longestGroundStopDays, every RecordRef without flightId
  fleet?: Fleet                             // only if publicSections.fleet
}
```

- The engine runs on the owner's counted rows with an empty filter. Upcoming rows are excluded.
- Unknown or private user → the same 404 body as `/api/public/profiles/:username`.
- `Cache-Control: public, max-age=300`.

- [ ] **Step 1: Write the failing tests:**
  - `private and unknown are identical 404s`.
  - `sections follow owner choice`.
  - `public subset leaks nothing finer than a month`: the serialised JSON has no `/\d{4}-\d{2}-\d{2}/`, no `home`, `flightNumber`, `count`, `id`, `flightId` or `depMinute` keys, and no upcoming route.
- [ ] **Step 2–4:** FAIL → implement (+ `pnpm next:build`) → PASS.
- [ ] **Step 5:** Commit `feat(api): public overview subset for /fly`.

### Task 15: Share-card PNG pipeline

**Files:** Create `functions/api/me/overview/share.png.ts` (or a `workers/share-card/` Worker, per Step 1), `functions/test/share-card.test.ts`.

**Interfaces:**
- Consumes: `readOverviewData`, `parsePrefs`, `computeOverview`; `createChartScene` + `renderChartSvg` (Task 13).
- Produces: `GET /api/me/overview/share.png?filter=<base64url JSON>` (owner only, `no-store`) → `image/png`, 1 200 × 1 500.
  - The layout is a **stub**: four figures as plain text on the paper token colour, plus one fixture chart (the Task 13 `barY` of `clock.byHour`). The design thread replaces the layout and chart definitions only.
  - Charts in the card come from `renderChartSvg` on the same engine rows and are embedded as an SVG data-URI `<img>`. There is no second chart stack.

- [ ] **Step 1 (spike):** Add `@cf-wasm/og@0.5.0` and render the stub, including the embedded chart SVG, in the Next Worker. Run `pnpm next:build` and record the compressed Worker size, then decide:
  - If it stays under the Workers Paid limit with ≥ 1 MB headroom, render in-process.
  - Otherwise move rendering to `workers/share-card` behind a service binding, and record the decision in the commit body.
  
  Before adding the package, check the current `@cf-wasm/og` docs (Context7) for its Workers import path.
- [ ] **Step 2: Write the failing tests:**
  - `owner gets a 1200x1500 png`: PNG signature; IHDR width/height read from bytes 16–23.
  - `card embeds the chart svg`: the layout function's intermediate tree contains an `<img>` whose `src` starts with `data:image/svg+xml`.
  - `anonymous is 401`.
  - `invalid filter param is 400`.
- [ ] **Step 3–4:** Implement → PASS (`pnpm test:api`, `pnpm next:build`).
- [ ] **Step 5:** Commit `feat(api): share card render pipeline (stub layout)`.

### Task 16: Schedule suggestions (ladder rung 3)

**Files:** Create `functions/api/flights/schedule-suggestions.ts`, `functions/api/flights/schedule-batch.ts`, `functions/test/schedule-suggestions.test.ts` (with `import-fake-provider.ts`-style fake); Modify `functions/api/_services/flightMetrics.ts` (PATCH preservation), regenerate routes.

**Interfaces:**
- Consumes: `resolveFlightMetrics` (`timesFromSchedule`), the Gemini client pattern and `ENRICHMENT_DEADLINE_MS` from `functions/api/enrich/aircraft.ts`, `AIRCRAFT_BATCH_SIZE`.
- Produces:
  - `POST /api/flights/schedule-suggestions` `{ ids: number[] }` (≤ 20; owned; only `duration_source = 'estimate'` with airline + flight number).
    - Returns `{ results: Array<{ id; departureTime: string | null; arrivalTime: string | null; confidence: number; evidence: string | null }> }`.
    - Saves nothing.
    - 503 `PROVIDER_DISABLED` without `GEMINI_API_KEY`.
  - `POST /api/flights/schedule-batch` `{ items: Array<{ id; departure_time; arrival_time }> }` (≤ 20).
    - Writes times through `resolveFlightMetrics({ timesFromSchedule: true })` and the dirty marker in one batch; per-item results are like `aircraft-batch.ts`.
  - PATCH rule: if the stored source is `schedule` and the times are unchanged → keep `schedule`. Edited times → `times`.
- Production enablement (API key, cost, data use) is a separate authorization, like the import provider gate.

- [ ] **Step 1: Write the failing tests:**
  - `suggestions never write`.
  - `only estimate flights with a number are eligible`.
  - `accept stores schedule source and times`.
  - `owner edit of times turns schedule into times`.
  - `missing key is 503`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(api): reviewed schedule suggestions`.

### Task 17: Parity report and legacy retirement

**Files:**
- Create: `scripts/overview-parity.ts`
- Delete: `functions/api/me/advanced-stats.ts`, `functions/api/me/dashboard-stats.ts`, `functions/api/_services/advancedStats.ts`, `advancedStatsBreakdowns.ts`, `advancedStatsInsights.ts`, and their tests
- Modify: `functions/api/_services/derivedState.ts` (drop `computedAdvancedStatsStatement` from the repair batch), regenerate routes
- Keep: the `user_advanced_stats` table and its `deleteUserCascade` entry (additive-only schema)

**Interfaces:**
- Consumes: the Release 1 local restore (`scripts/restore-export-local.ts`), `readOverviewData`, `computeOverview`, and the legacy compute in `advancedStats.ts` before deletion.
- Produces: `scripts/overview-parity.ts --database-id <id> --persist <abs dir> --user <id> [--schema-admission <json>]`.
  - Prints a table of metric | legacy | new | delta for: flights, distance, duration, airlines, aircraft types, manufacturers, regions, longest/shortest flight, top airline/airport/route.
  - Writes a private copy to the tmpdir.

- [ ] **Step 1:** Run the parity script on the restored production copy for the owner's account. Expected: equal counts. Distance and duration differences are explained only by Release 1 (great-circle, ladder). List any other delta.
- [ ] **Step 2:** Show the report to the user. **Stop until they accept it.**
- [ ] **Step 3:** Delete the legacy files. Run `grep -rn "advancedStats\|advanced-stats\|dashboard-stats" apps functions packages`. Expected: no hits outside the generated routes, which `pnpm next:build` regenerates.
- [ ] **Step 4:** `pnpm typecheck:api`, `pnpm test:api`, `pnpm next:build`. Expected: all pass.
- [ ] **Step 5:** Commit `refactor(api): retire legacy advanced stats after parity`.

---

## Handoff to the design plan

The page swap belongs to the design plan. That plan:
- replaces `(member)/overview`;
- retires `/api/me/overview`, `/api/me/overview/missing-aircraft` and `/api/flights/route-projection` once nothing reads them;
- shows `duration_source` as "≈" in Journal/flight sheets;
- builds the prefs-driven layout, the globe, the replay, the narrator, the share-card visual and the `/fly` presentation.

It consumes `getOwnOverviewData`, `createOverviewDataStore`/`scopeFor`, `OverviewScope`, the prefs API, `PublicOverview` and the share endpoint as defined here.

**Charts:** every chart in the design plan is a TanStack Charts `defineChart` over the engine's tidy rows (Task 13). The library is installed and its SSR and DOM-free paths are proven; the visuals are design's. Some options the design thread may want:
- `cell` for the Rhythm heatmap;
- `barY` for Clock hours and haul;
- the `ridgeline` and `waffle` subpaths, which match the legacy AircraftTypesCard and ManufacturerCard;
- `@tanstack/charts/geo` (`geoShape` with d3-geo's `geoOrthographic`; d3-geo is already a dependency of the charts package). This could draw the static SVG orthographic globe that is both the no-WebGL fallback and the SSR first paint, and the share-card globe, from one implementation.
