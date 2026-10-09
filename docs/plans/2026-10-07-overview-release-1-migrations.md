# Overview Release 1: Flight Metrics Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the server the single authority for flight distance, time zones, duration (with provenance) and zones overflown; backfill every stored flight; republish derived state and leaderboards. This ships as its own release before the new Overview page.

**Architecture:** Pure geometry and time-zone helpers live in `packages/shared`. A server resolver (`resolveFlightMetrics`) replaces `computeFlightDuration` + `fillDistanceAndDuration` on every write path, and ignores client-sent distance and duration. History is fixed by a read-only proposal script. It emits reviewed compare-and-set SQL plus a manifest, the same pattern as `scripts/remote-migration-proposal.ts`. A temporary fixed-operation operator Worker then repairs derived state and refreshes leaderboards, because the maintenance cron stays held. That follows the 6 October `release-operator` precedent.

**Tech Stack:** TypeScript, Cloudflare D1/Workers, Vitest + Miniflare, `@photostructure/tz-lookup@11.7.0` (CC0, timezone-boundary-builder data), `Intl.DateTimeFormat` offsets.

**Spec:** `.scratch/overview-redesign/decisions.md` (Stats, Architecture and release). The companion plan `docs/plans/2026-10-07-overview-release-2-architecture.md` depends on this one landing in production first.

## Global Constraints

- Distance is pure great-circle: haversine, `EARTH_RADIUS_KM = 6371`, stored rounded to integer km. No routing factor (×1.10) remains anywhere after this release.
- `duration_source ∈ {'times','route_median','schedule','estimate'}`. It is NULL exactly when `duration_minutes` is NULL.
- Ladder, first match wins:
  1. `times`: own local times + both tz.
  2. `route_median`: median of same airline + flight number on the same directional route, else the same directional route. Pooled across all users; only `duration_source='times'` samples from `awaiting`/`logged` flights; **≥3 samples**.
  3. `schedule`: written only by the Release 2 accept path.
  4. `estimate`: calibrated model.
- Zones overflown: sample the great circle every ≤50 km. Take each sample's IANA zone from tz-lookup and its UTC offset at the flight's departure instant. Count the offset changes between consecutive samples. NULL when either airport lacks coordinates.
- Departure instant = `departure_utc` when known; otherwise `${date}T12:00:00Z`.
- Existing clamps stay: distance ≤ 20 000 km, duration ≤ 1 200 min.
- Migrations are additive. The next file is `0008`. No DROP, no down-migration, no rewrite of earlier files.
- Remote D1 writes (0008, backfill SQL, operator repair/refresh) follow `docs/runbooks/audit-remediation-release.md`: explicit target, writer hold, Time Travel bookmark + export + restore proof, schema admission. **Each production write step needs its own explicit authorization from the user.** Local rehearsal never writes to production.
- Earned badges are never revoked. `computedBadgeStatements` is award-only and must stay that way.
- Commits carry no Claude/AI attribution.
- Verify with `pnpm typecheck:api`, `pnpm test:api`, `pnpm typecheck:scripts`, `pnpm --filter @kuuki/next test`, and `pnpm next:build` where the Worker bundle changes.

## Review Focus

1. **Airport missing from `airports_reference` or without coordinates** (unresolved MOW/GAT/POD). Expected: distance falls back to the clamped client value or NULL, zones NULL, no throw. The backfill leaves that row's distance untouched. Tests: Task 5 `unknown airport keeps client distance`, Task 6 `no coordinates is reported, not rewritten`.
2. **Legacy duration that matches no old estimate formula.** It may be a real value from the Supabase era. Expected: value kept, labelled `estimate`, counted `kept_unexplained` in the manifest. Test: Task 6 `unexplained legacy duration is kept`.
3. **Row edited after the proposal was generated (drift).** Expected: its compare-and-set UPDATE changes 0 rows, and the newer edit is never overwritten. A re-plan reports remaining corrections; an already canonical times PATCH needs no proposal. Test: Task 6 `drifted row is not overwritten`. (User-approved correction, 2026-10-07.)
4. **Red-eye across a DST change with tz filled from the package** (imported flight that had no tz). Expected: `times`, positive minutes identical to `computeFlightDuration`, `departure_utc` set. Test: Task 5 `import without tz gets times across DST`.
5. **Operator misuse.** Missing or wrong token, repeated calls. Expected: 401 without touching D1; repeated repair is idempotent; refresh leaves no ready user missing from `leaderboard_cache`. Tests: Task 7.

---

## File Structure

| File                                                                                | Responsibility                                                                                            |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/geo.ts`                                                        | Great-circle distance, path sampling, eastward share (pure)                                               |
| `packages/shared/src/timezones.ts`                                                  | `utcOffsetMinutes(zone, instant)` via cached `Intl` formatters (pure)                                     |
| `packages/shared/src/blockTime.ts` + `blockTimeModel.generated.ts`                  | Calibrated block-time model, its least-squares fit, legacy-estimate detector                              |
| `functions/api/_lib/zones.ts`                                                       | `zonesOverflown`, `zoneAt` (tz-lookup wrapper); server-only, so tz-lookup never reaches the client bundle |
| `functions/api/_services/blockTimeMedian.ts`                                        | Pooled flight-number/route medians (D1 read + pure median)                                                |
| `functions/api/_services/flightMetrics.ts`                                          | `decideDuration` (pure ladder) + `resolveFlightMetrics` (write-path resolver)                             |
| `functions/api/_services/flightBackfill.ts`                                         | Pure backfill planner + SQL renderer                                                                      |
| `db/migrations/0008_flight_metrics.sql`                                             | Additive schema                                                                                           |
| `scripts/fit-block-time.ts`, `scripts/overview-backfill-proposal.ts`                | Local/read-only operator scripts                                                                          |
| `workers/release-operator/`                                                         | Temporary fixed-operation repair + leaderboard refresh Worker                                             |
| `docs/adr/0002-flight-metrics-provenance.md`, `docs/runbooks/overview-release-1.md` | Decision record and production sequence                                                                   |

---

### Task 1: Shared great-circle geometry and offsets

**Files:**

- Create: `packages/shared/src/geo.ts`, `packages/shared/src/timezones.ts`, `packages/shared/src/geo.test.ts`
- Modify: `packages/shared/package.json` (exports `"./geo"`, `"./timezones"`), `functions/vitest.config.ts` (add `'packages/shared/src/**/*.test.ts'` to `include`), `packages/client/src/geo.ts` (`calculateFlightDistance` returns `Math.round(greatCircleKm(...))`; delete `ROUTING_ADJUSTMENT` and the local haversine)
- Test: `packages/shared/src/geo.test.ts`, `apps/next/src/client/import/flight-input.test.ts` (create or extend)

**Interfaces:**

- Produces:
  - `interface LatLon { lat: number; lon: number }`
  - `EARTH_RADIUS_KM = 6371`
  - `greatCircleKm(a: LatLon, b: LatLon): number` (unrounded)
  - `greatCirclePoints(a: LatLon, b: LatLon, maxStepKm = 50): LatLon[]`: spherical interpolation, endpoints included, `n = max(1, ceil(km / maxStepKm))` segments, lon normalised to (-180, 180]
  - `eastwardShare(a: LatLon, b: LatLon): number`: Σ signed eastward km between samples ÷ path km, in [-1, 1]
  - `utcOffsetMinutes(timeZone: string, instant: Date): number | null`: null for an unknown zone. Uses one cached `Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })` per zone and parses `GMT±HH:MM`.

- [x] **Step 1: Write the failing tests.** Coordinates come from `packages/data/src/airports.json`.
  - `great-circle distances match haversine`: `Math.round(greatCircleKm(TBS, JFK)) === 8980`, `LHR–JFK === 5540`, `KUT–TBS === 212`. Also `greatCircleKm(a, b) === greatCircleKm(b, a)` and `greatCircleKm(a, a) === 0`.
  - `path samples`: `greatCirclePoints(JFK, HKG)` has length 261. Its max lat is in [83.9, 84.0]. Every consecutive pair is ≤ 50.0 km apart. `greatCirclePoints({lat:0,lon:0},{lat:0,lon:180})` contains only finite numbers.
  - `eastward share`: `eastwardShare(LHR, JFK) < 0`, and `eastwardShare(JFK, LHR) === -eastwardShare(LHR, JFK)` within 1e-9.
  - `offsets are DST-aware`:
    - `utcOffsetMinutes('Europe/London', new Date('2026-07-01T12:00Z')) === 60`, and `=== 0` on 2026-01-01.
    - `'Asia/Kathmandu'` → 345. `'Europe/Moscow'` on 2012-06-01 → 240 and on 2026-06-01 → 180.
    - `'Not/AZone'` → null.
  - `flight-input.test.ts › routeKm uses pure great circle`: `routeKm('TBS','JFK') === 8980`.
- [x] **Step 2:** Run `pnpm test:api -- packages/shared/src/geo.test.ts` and `pnpm --filter @kuuki/next test -- flight-input`. Expected: FAIL (module not found / 9878).
- [x] **Step 3:** Implement the interfaces above and update the client helper.
- [x] **Step 4:** Re-run both. Expected: PASS. Run `pnpm typecheck:api`. Expected: clean.
- [x] **Step 5:** Commit `feat(shared): pure great-circle geometry and tz offsets`.

### Task 2: Zones overflown

**Files:**

- Create: `functions/api/_lib/zones.ts`, `functions/test/zones-overflown.test.ts`
- Modify: root `package.json` (dependency `"@photostructure/tz-lookup": "11.7.0"`, pinned exactly)

**Interfaces:**

- Consumes: `greatCirclePoints`, `utcOffsetMinutes` (Task 1).
- Produces:
  - `zoneAt(p: LatLon): string`: tz-lookup's IANA zone, including `Etc/GMT±n` over oceans.
  - `zonesOverflown(a: LatLon, b: LatLon, instant: Date): number`: number of changes in `utcOffsetMinutes(zoneAt(sample), instant)` between consecutive samples of `greatCirclePoints(a, b, 50)`. A null offset is skipped.

- [x] **Step 1: Write the failing tests.**
  - `same zone hop is zero`: KUT–TBS on 2026-06-01 → 0.
  - `TBS to IST crosses one offset`: on 2026-06-01 → ≥ 1.
  - `LHR to JFK crosses the Atlantic zones`: → ≥ 4.
  - `direction does not matter`: for NRT–SFO and JFK–HKG, `zonesOverflown(a,b,t) === zonesOverflown(b,a,t)`.
  - `history follows the flight date`: TBS–SVO on 2012-06-01 (Moscow +4 = Tbilisi +4) → 0; on 2026-06-01 → ≥ 1.
  - `golden routes`: `toMatchInlineSnapshot` over `[TBS-JFK, NRT-SFO, JFK-HKG, SIN-SYD, DXB-LAX]` on 2026-06-01. The reviewer checks each value for plausibility against a map; do not hand-edit them.
  - `cost stays bounded`: DXB–LAX completes in < 50 ms on a warm run (`performance.now()`). Production runs on Workers Paid (confirmed in the 6 October handoff).
- [x] **Step 2:** `pnpm test:api -- functions/test/zones-overflown.test.ts`. Expected: FAIL (missing module).
- [x] **Step 3:** `pnpm add -w @photostructure/tz-lookup@11.7.0`; implement `zones.ts`.
- [x] **Step 4:** Re-run. Expected: PASS. Run `pnpm next:build`. Expected: success. Record the Worker bundle size before/after in the commit body.
- [x] **Step 5:** Commit `feat(api): zones overflown from tz-lookup offsets`.

### Task 3: Migration 0008, ADR and glossary

**Files:**

- Create: `db/migrations/0008_flight_metrics.sql`, `functions/test/flight-metrics-migration.test.ts`, `docs/adr/0002-flight-metrics-provenance.md`
- Modify: `GLOSSARY.md` (entries: _duration source_, _zones overflown_, _clock shift_), `functions/api/_lib/flights.ts` (`FlightRow` + `toOwnFlight` gain `duration_source`, `zones_overflown`), `functions/api/flights/index.ts` (`FLIGHT_COLUMNS`), `packages/shared/src/types.ts` (own-flight DTO fields)

**Interfaces:**

- Produces this exact schema:

```sql
ALTER TABLE flights ADD COLUMN duration_source TEXT
  CHECK (duration_source IS NULL OR duration_source IN ('times','route_median','schedule','estimate'));
ALTER TABLE flights ADD COLUMN zones_overflown INTEGER
  CHECK (zones_overflown IS NULL OR zones_overflown >= 0);
ALTER TABLE profiles ADD COLUMN overview_prefs TEXT
  CHECK (overview_prefs IS NULL OR (json_valid(overview_prefs) AND length(overview_prefs) <= 8192));
CREATE INDEX idx_flights_route_times ON flights(origin, destination, duration_minutes)
  WHERE duration_source = 'times';
```

The home override reuses the existing private `profiles.home_airport`; no column is added for it. Aircraft family stays in package data (Release 2), so `aircraft_reference` is unchanged.

- [x] **Step 1: Write the failing tests** (use `databaseThrough('0007_import_drafts.sql')` from `lifecycle-fixture.ts`, then apply 0008).
  - `0008 adds nullable metrics to existing rows`: a flight inserted before 0008 reads `duration_source IS NULL AND zones_overflown IS NULL`.
  - `CHECK rejects bad values`: `duration_source='guess'`, `zones_overflown=-1`, `overview_prefs='{'`, and an 8193-char JSON string all throw.
  - `old writers still work`: `OLD_CREATE_FLIGHT` and `OLD_EDIT` from `lifecycle-fixture.ts` succeed after 0008.
  - `public profile never exposes prefs`: `GET /api/public/profiles/:username` for a public profile with `overview_prefs` set has no `overview_prefs` key.
- [x] **Step 2:** `pnpm test:api -- functions/test/flight-metrics-migration.test.ts`. Expected: FAIL.
- [x] **Step 3:** Write the migration and the DTO/column changes. ADR 0002 records:
  - why distance became pure great-circle (with the ~9.1 % drop in stored totals);
  - the ladder;
  - the zones definition and the tz-lookup accuracy caveat (~5 % offset mismatches near borders, per its README);
  - why the operator Worker exists.
- [x] **Step 4:** Run `pnpm test:api`. Expected: all PASS, including `wrangler-migrations.test.ts` and `scripts/migration.test.ts`. If a schema-hash fixture pins the migration set, update it in this commit and name it in the commit body.
- [x] **Step 5:** Commit `feat(db): 0008 flight metrics and overview prefs columns`.

### Task 4: Calibrated block-time model

**Files:**

- Create: `packages/shared/src/blockTime.ts`, `packages/shared/src/blockTimeModel.generated.ts`, `packages/shared/src/blockTime.test.ts`, `scripts/fit-block-time.ts`

**Interfaces:**

- Consumes: `greatCircleKm`, `eastwardShare` (Task 1); `computeFlightDuration` (`functions/api/_services/flightDuration.ts`); `openLocalTarget`/`parseLocalTarget` (`scripts/migration-target.ts`).
- Produces:
  - `interface BlockTimeModel { intercept: number; slopes: [number, number, number]; jet: number; samples: number; rmse: number | null; fittedAt: string | null }`. Knots are at 1 500 and 4 000 km.
  - `BLOCK_TIME_MODEL` (generated). The prior, used until a fit is accepted: `intercept 30, slopes [0.075,0.075,0.075], jet 0, samples 0, rmse null, fittedAt null`.
  - `estimateBlockMinutes(distanceKm: number, east: number, model = BLOCK_TIME_MODEL): number`. Evaluates `intercept + s1·min(d,1500) + s2·clamp(d−1500,0,2500) + s3·max(d−4000,0) + jet·east·d`, rounded and clamped to [1, 1200].
  - `fitBlockTimeModel(samples: Array<{ distanceKm: number; east: number; minutes: number }>): BlockTimeModel`: ordinary least squares on the five terms. Returns the prior when `samples.length < 30` or any distance band has < 5 samples.
  - `isLegacyEstimate(minutes: number, distanceKm: number): boolean`: true when `|minutes − round(d/v·60 + (d > 3000 ? 45 : 30))| ≤ 1` for any `v ∈ {300, 500, 750, 800, 850}`. These are the old client and server formulas.

- [x] **Step 1: Write the failing tests.**
  - `prior reproduces the old default`: `estimateBlockMinutes(1000, 0)` with the prior → 105.
  - `monotonic in distance`: for d in 100…15 000 step 100, the estimate never decreases.
  - `fit recovers known coefficients`: 200 synthetic samples generated from `{intercept 25, slopes [0.08,0.072,0.07], jet -0.004}` with zero noise → every coefficient within 1e-6.
  - `fit falls back to prior on thin data`: 29 samples → returns the prior.
  - `legacy detector`: `isLegacyEstimate(round(2000/850·60+30), 2000)` → true; `isLegacyEstimate(137, 2000)` → false.
- [x] **Step 2:** `pnpm test:api -- packages/shared/src/blockTime.test.ts`. Expected: FAIL.
- [x] **Step 3:** Implement `blockTime.ts` with the prior in `blockTimeModel.generated.ts`. Then implement `scripts/fit-block-time.ts --database-id <id> --persist <abs dir> [--schema-admission <json>] [--write]`.
  - It opens the local copy through the same `MigrationReader` + `assessSchemaAdmission` path as Task 6. A restored production copy carries the admitted `user_advanced_stats` column-order variant, so `openLocalTarget`'s exact check would refuse it.
  - It reads `awaiting`/`logged` flights with both times, resolves tz from the package when the row has none, computes minutes with `computeFlightDuration`, and prints `{samples, rmse, model}`.
  - With `--write` it regenerates the module (header: generated, sample count, date; no user identifiers).
- [x] **Step 4:** Re-run the tests. Expected: PASS. Run `pnpm typecheck:scripts`. Expected: clean.
- [x] **Step 5:** Commit `feat(shared): calibrated block-time model with prior`. The real fit is regenerated in Task 8 from the restored production export, and that diff is reviewed on its own.

### Task 5: Server-authoritative write path

**Files:**

- Create: `functions/api/_services/blockTimeMedian.ts`, `functions/api/_services/flightMetrics.ts`, `functions/test/flight-metrics.test.ts`
- Modify:
  - `functions/api/_services/flightCreate.ts:64-79` and the INSERT column list: replace both helpers with `resolveFlightMetrics`, and insert `duration_source`, `zones_overflown`.
  - `functions/api/flights/[id].ts:72-110`: same, for the UPDATE.
  - `functions/api/_services/stats.ts`: delete `fillDistanceAndDuration`, and `haversineKm` once `grep -rn haversineKm functions` shows no other caller.

**Interfaces:**

- Consumes: Tasks 1, 2 and 4; `computeFlightDuration`; `airports` from `packages/data/src/airports.json`.
- Produces:
  - `type DurationSource = 'times' | 'route_median' | 'schedule' | 'estimate'`. Export it from `packages/shared/src/types.ts` so Release 2 shares it.
  - `medianFromSamples(values: number[]): number | null`: null below 3 samples. An even count averages the middle pair, then `Math.round`.
  - `normalizeFlightNumber(airline: string | null, number: string | null): string | null`: uppercase, strip spaces, strip a leading `airline` prefix, strip leading zeros. `('TK','TK 0381')` → `'381'`.
  - `readBlockTimeMedian(db, key: { origin: string; destination: string; airlineIata: string | null; flightNumber: string | null; excludeFlightId?: number }): Promise<number | null>`. One query on `idx_flights_route_times` (LIMIT 1 000), then the flight-number median, then the route median.
  - `decideDuration(args: { timesMinutes: number | null; timesFromSchedule: boolean; median: number | null; distanceKm: number | null; east: number }): { minutes: number | null; source: DurationSource | null }`. Pure ladder. A times result is labelled `schedule` when `timesFromSchedule` is true.
  - `interface FlightMetrics { originTz; destTz; departureUtc; arrivalUtc; distanceKm; durationMinutes; durationSource; zonesOverflown }`
  - `resolveFlightMetrics(db, input: { date; origin; destination; airlineIata; flightNumber; departureTime; arrivalTime; originTz?; destTz?; clientDistanceKm?: number | null; timesFromSchedule?: boolean; excludeFlightId?: number }): Promise<FlightMetrics>`
    - tz: a valid input zone (`utcOffsetMinutes` non-null), else the package `timezone`, else `zoneAt(reference coords)`, else null.
    - Distance: reference coords → `Math.round(greatCircleKm)`, else the clamped `clientDistanceKm`, else null.
    - Client `duration_minutes` is ignored.
- PATCH rule: recompute metrics only when route, date, times, tz or flight number change. Otherwise keep the stored metric columns, including `duration_source`.

- [x] **Step 1: Write the failing tests** (Miniflare harness; insert `airports_reference` rows with the package coordinates):
  - `create stores great-circle distance, not the client value`: POST TBS→JFK with `distance_km: 1` → stored 8980, `zones_overflown` > 0.
  - `unknown airport keeps client distance`: destination `GAT` (no coords) with `distance_km: 700` → 700; `zones_overflown` null.
  - `import without tz gets times across DST`. Draft conversion (`draftToFlightInput` path) JFK→LHR, 2026-03-28, dep 22:30, arr 10:30, no tz. Expect:
    - `origin_tz 'America/New_York'`, `dest_tz 'Europe/London'`;
    - `duration_source 'times'`;
    - minutes equal to `computeFlightDuration` with those zones;
    - `departure_utc` non-null.
  - `pooled median needs three samples`:
    - Two other users' `times` flights TBS→IST at 150 and 160 min → new flight without times gets `estimate`.
    - Add a third at 155 → `route_median` 155.
    - A same-number TK 381 set of 3 at 170 beats the route median.
  - `estimate ignores client duration`: no times, `duration_minutes: 999` → `estimateBlockMinutes(...)`, `estimate`.
  - `patch of airline keeps metrics`: PATCH `airline_iata` only → duration, source and zones unchanged.
  - `patch of times recomputes`: PATCH new times on an `estimate` flight → `times`.
  - `leaderboard input follows`: after publish, `user_stats.total_distance_km` equals the sum of stored great-circle distances.
- [x] **Step 2:** `pnpm test:api -- functions/test/flight-metrics.test.ts`. Expected: FAIL.
- [x] **Step 3:** Implement and wire both write paths.
- [x] **Step 4:** Run `pnpm test:api` (whole suite: flights, overview, derived, import-conversion). Expected: PASS. Fixtures asserting ×1.10 distances are updated in this commit and listed in the body.
- [x] **Step 5:** Commit `feat(api): server-authoritative distance, tz, duration provenance and zones`.

### Task 6: Backfill planner and read-only proposal

**Files:**

- Create: `functions/api/_services/flightBackfill.ts`, `functions/test/flight-backfill.test.ts`, `scripts/overview-backfill-proposal.ts`

**Interfaces:**

- Consumes: `decideDuration`, `medianFromSamples`, `normalizeFlightNumber` (Task 5); `isLegacyEstimate`, `estimateBlockMinutes` (Task 4); `zonesOverflown` (Task 2); `computeFlightDuration`.
- Script plumbing:
  - `MigrationReader` + `openRemoteReader`/`assertRemoteIds` (remote).
  - A Miniflare-backed `MigrationReader` over `d1Persist` (local).
  - `assessSchemaAdmission` + `expectedSchemaRows` with optional `--schema-admission`.
  - `SCHEMA_SQL`/`ROOT`/`requiredArg`.
  - `privateOutputPath`: move it from `remote-migration-proposal.ts` into `scripts/_cli.ts` and import it in both scripts. The rule stays: output in tmpdir or `db/_snapshot`, mode 0600.
- Produces:
  - `type BackfillClass = 'tz_filled' | 'times' | 'route_median' | 'estimate_replaced' | 'kept_unexplained' | 'distance_changed' | 'zones_set' | 'no_coordinates'`
  - `interface BackfillChange { id: number; userId: string; before: CasColumns; after: MetricColumns; classes: BackfillClass[] }`
    - `CasColumns` = origin, destination, date, airline_iata, flight_number, departure_time, arrival_time, origin_tz, dest_tz, distance_km, duration_minutes, duration_source.
    - `MetricColumns` = origin_tz, dest_tz, departure_utc, arrival_utc, distance_km, duration_minutes, duration_source, zones_overflown.
  - `planFlightBackfill(flights: BackfillFlight[], coords: Map<string, LatLon>, model?: BlockTimeModel): BackfillChange[]`. Pure. Two passes:
    1. tz fill + `times` for every flight.
    2. Pooled medians from pass-1 `times` rows (all users, `awaiting`/`logged`), then the ladder for the rest.
    - A no-times duration that fails `isLegacyEstimate` (checked against the stored, old distance) is kept and labelled `estimate` (`kept_unexplained`).
    - Rows whose metrics are already correct produce no change.
  - `renderBackfillSql(changes: BackfillChange[], meta: { accountId: string; databaseId: string; schemaSha256: string }): string`. Output:
    - A private header like `renderMissingSql`.
    - One `UPDATE flights SET <MetricColumns> WHERE id = ? AND user_id = ? AND <each CasColumn> IS <before>` per change.
    - The dirty-marker INSERT…ON CONFLICT block from `renderMissingSql` for affected users.
  - Manifest sidecar `<sql>.manifest.json` containing:
    - target IDs, schema SHA-256, SQL SHA-256;
    - change count; per-class counts;
    - per-user flights changed and distance/duration totals before → after (user IDs only; no emails).

- [x] **Step 1: Write the failing tests** (pure planner, plus an apply round-trip on Miniflare):
  - `legacy ×1.10 distance is replaced`: TBS→JFK stored 9878 → change to 8980, `distance_changed`.
  - `legacy estimate is replaced by the ladder`: stored `round(9878/800·60+45)`, no times → `estimate_replaced`, model value.
  - `unexplained legacy duration is kept`: stored 611 min, no times → kept 611, `estimate`, `kept_unexplained`.
  - `tz fill turns times on`: times present, tz null → `tz_filled` + `times`.
  - `no coordinates is reported, not rewritten`: destination `MOW` without coords → distance unchanged, `no_coordinates`.
  - `apply is idempotent`: render → execute on the DB → re-plan returns `[]`.
  - `drifted row is not overwritten`: plan, then PATCH that flight's times, then execute the SQL → that row keeps the PATCH result; re-plan returns `[]` because PATCH already wrote canonical metrics. Separately, airline-only drift rejects stale SQL and re-plan lists the row with its new `before`. Guard flight-number-only drift too. (User-approved correction, 2026-10-07.)
  - `derived totals follow after repair`: execute, `repairUserDerivedState` → `user_stats.total_distance_km` equals the new sum; badge rows count unchanged.
- [x] **Step 2:** `pnpm test:api -- functions/test/flight-backfill.test.ts`. Expected: FAIL.
- [x] **Step 3:** Implement the planner, the renderer, and `scripts/overview-backfill-proposal.ts`:
  - `--target local --database-id <id> --persist <abs dir>` or `--target remote --account-id <id> --database-id <id>` (read-only reader);
  - `[--schema-admission <json>]`;
  - `--output-sql <abs path>`;
  - refuses to write SQL unless the schema is admitted;
  - always prints the manifest summary to stdout.
- [x] **Step 4:** Run `pnpm test:api` and `pnpm typecheck:scripts`. Expected: PASS / clean.
- [x] **Step 5:** Commit `feat(scripts): read-only flight metrics backfill proposal`.

### Task 7: Temporary release operator (repair + leaderboards)

**Files:**

- Create: `workers/release-operator/index.ts`, `workers/release-operator/tsconfig.json`, `functions/test/release-operator.test.ts`
- Not committed: the private deploy config `.scratch/overview-release-1/operator-prod.toml`. It binds the explicit production D1 and the `OPERATOR_TOKEN` secret; keep it out of git like `.scratch/next-release/`.

**Interfaces:**

- Consumes: `repairUserDerivedState`, `STALE_DERIVED_PREDICATE` (`derivedState.ts`), `refreshLeaderboards` (`leaderboard.ts`).
- Produces: `fetch(request, env: { DB: D1Database; OPERATOR_TOKEN: string })`.
  - Every request needs `Authorization: Bearer <token>`, compared in constant time. Otherwise 401, and the handler reads nothing.
  - `GET /status` → `{ users, flights, dirty, metricsNull }`. `metricsNull` counts flights with `duration_minutes` set but `duration_source` NULL.
  - `POST /repair` → repairs up to 50 stale users oldest-first (the maintenance query) and returns `{ repaired, failed, remaining }`.
  - `POST /refresh-leaderboards` → returns `{ rows }` (the `leaderboard_cache` count after refresh).
  - Responses carry counts only.

- [x] **Step 1: Write the failing tests:**
  - `rejects missing and wrong tokens before touching D1`: a DB proxy that throws on use → still 401.
  - `repair loop drains dirty users`: 3 dirty users → `POST /repair` until `remaining === 0`; then `/status` `dirty === 0`; a second loop reports `repaired: 0`.
  - `refresh lists every eligible ready user`: 5+ flights each, `show_on_leaderboards=1` → rows = 5 categories × eligible users.
- [x] **Step 2:** `pnpm test:api -- functions/test/release-operator.test.ts`. Expected: FAIL.
- [x] **Step 3:** Implement. Add `typecheck:operator` (`tsc --noEmit -p workers/release-operator/tsconfig.json`) to the root `package.json`.
- [x] **Step 4:** Run `pnpm test:api` and `pnpm typecheck:operator`. Expected: PASS / clean.
- [x] **Step 5:** Commit `feat(workers): temporary release operator for repair and leaderboard refresh`.

### Task 8: Rehearsal on the restored export and the production runbook

**Files:**

- Create: `scripts/restore-export-local.ts`, `docs/runbooks/overview-release-1.md`
- Modify: `packages/shared/src/blockTimeModel.generated.ts` (real fit), `docs/skills/deploy-kuuki/SKILL.md` (one line: Release 1 requires the 0008 ledger row and the runbook)

**Interfaces:**

- Consumes: everything above.
- Produces: `scripts/restore-export-local.ts --sql <abs export> --database-id <id> --persist <abs dir>`.
  - Applies `parseLocalTarget`'s path refusals.
  - Splits the export with wrangler's `unstable_splitSqlQuery`, drops `BEGIN`/`COMMIT`/`PRAGMA`/`sqlite_sequence` statements, and executes in `db.batch` chunks of 200. This is the procedure proven in `.scratch/next-release/operator-local-test.ts`.
  - Then runs `applyMigrations(db, { after: <last ledger row> })`.

- [x] **Step 1:** Ask the user before copying private production data. Then:
  - `pnpm exec wrangler d1 export kuuki-db --remote --output <abs private dir>/kuuki-<UTC>.sql`. This is read-only, but it briefly blocks the DB.
  - `chmod 600` the file.
  - Restore it with `scripts/restore-export-local.ts`.

  No remote writes.

- [x] **Step 2:** Locally: apply 0008 (done by the restore's `applyMigrations`), then run `pnpm exec tsx scripts/fit-block-time.ts --database-id <id> --persist <dir> --schema-admission <reviewed json>`.
  - Expected: `samples ≥ 30`, then re-run with `--write`.
  - With fewer samples, keep the prior and record that.
  - Commit `chore(shared): fit block-time model on production sample` and show the coefficient diff to the user.
- [x] **Step 3:** Locally:
  - Run `overview-backfill-proposal.ts --target local …`.
  - Review the manifest: expected total distance ≈ old ÷ 1.1 per user; list every `kept_unexplained` and `no_coordinates` row for the user.
  - Execute the SQL on the local copy.
  - Bundle the operator (`wrangler deploy --dry-run --outdir <tmp>`) and run it in Miniflare over the same `d1Persist` with `dispatchFetch` (`/repair` loop, `/refresh-leaderboards`).
  - Re-run the proposal.
  - Expected: 0 changes, `dirty 0`, `metricsNull 0`.
- [x] **Step 4:** Write `docs/runbooks/overview-release-1.md`. Each production write step is marked **separate authorization**. The ordered sequence:
  1. Writer hold per the audit runbook.
  2. Time Travel bookmark + SQL export + restore proof on a separate DB.
  3. Read-only ledger check (deploy-kuuki step 2).
  4. Schema admission for 0008.
  5. **Apply 0008.**
  6. Regenerate the proposal against held production (read-only) and compare its manifest with the rehearsal; stop on drift.
  7. **Execute the SQL file.**
  8. **Deploy the operator, then `/repair` until `remaining 0`, then `/refresh-leaderboards`.**
  9. Re-run the proposal → 0 changes.
  10. **Delete the operator.**
  11. **Deploy the Release 1 app via deploy-kuuki.**
  12. Release hold, then smoke: create a flight and check its distance, source and zones; check the leaderboard and profile totals.

  Rollback: forward-fix while held; D1 restore only under hold, per the audit runbook.

- [x] **Step 5:** Commit `docs: overview release 1 runbook and rehearsal evidence`. Stop. Production execution happens only when the user authorizes each marked step.
