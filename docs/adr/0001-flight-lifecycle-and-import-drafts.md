# ADR 0001: Flight lifecycle, country evidence and import drafts

- **Status:** Accepted for implementation, 2026-10-05. Revised after the independent review (fix rounds 1 and 2). H5 runtime decided by the owner: option (a) (§9).
- **Scope:** Binding spec for W3 (T07–T11) of [Redesign 2.0](../plans/2026-10-04-redesign-2.0-implementation.md). Resolves contracts C2–C5 under Addendum A (A1, A2, A6).
- **Vocabulary:** [GLOSSARY.md](../../GLOSSARY.md), "Flight lifecycle & evidence vocabulary".

## Context

**Lifecycle today.** The only lifecycle flag is `flights.is_upcoming INTEGER NOT NULL DEFAULT 0` (`db/migrations/0001_init.sql:129`).

- It is set at create from the UTC calendar day (`functions/api/flights/index.ts:29-32`).
- On edit it is recomputed only when the patch carries a date (`functions/api/flights/[id].ts:75-76`).
- Two writers clear it with `date <= today` (UTC): the owner sync (`functions/api/flights/sync-upcoming.ts:15-18`) and the cron (`workers/maintenance/index.ts:20-45`).
- The sync is called only by the legacy SPA (`apps/web/src/lib/flights.ts:352`). Nothing in `apps/next` calls it.

So a same-day flight completes on its departure day, Next users rely on a cron that is held, and nothing records how a flight became completed.

**Derived data.** Derived data is revision-published.

- Each canonical mutation adds `dirtyUserStatement` to its D1 batch (`functions/api/_services/derivedState.ts:47-61`).
- `repairUserDerivedState` reads canonical sources in one batch. It publishes `visits`, `user_stats`, `user_advanced_stats` and badges in a second batch, guarded by a CHECK violation against newer revisions (`derivedState.ts:170-224`, `0003_derived_recovery.sql:2-12`).
- `visits` is the airport aggregate: both endpoints of every non-upcoming flight, max-merged with `legacy_visit_evidence` (`derivedState.ts:63-132`).

Countries are read from `visits` or straight from flight endpoints:

- `countries_count` and `continents_count` (`_services/stats.ts:151-152`);
- the `regionOf` advanced-stats breakdowns persisted in `user_advanced_stats` (`_services/advancedStats.ts:76-78`, `advancedStatsBreakdowns.ts:179-210`);
- the passport endpoints (`passport/countries/index.ts:11-26`, `countries/[cc]/stats.ts:21-27`, `apps/next/src/server/passport.ts:15`);
- Overview, which uses live canonical endpoints (`_services/overview.ts:38-57,109-114`).

Claims and ground visits mark the user dirty, but they feed no derived table.

**Replay and import.**

- Create replay uses `flight_idempotency` (`0003:18-26`, primary key `(user_id, key)`). It is chained through `changes()` (`flights/index.ts:99-132`), purged after 7 days (`workers/maintenance/index.ts:56-63`), and the client retries for 6 days (`apps/web/src/lib/flightCreateOperations.ts:9`).
- Import makes one synchronous `generateContent` call (`functions/api/import/parse.ts:112`) and returns `raw_text` (`parse.ts:241`).
- Review drafts are browser-local (`apps/next/src/client/capture/drafts.ts:9-13`).
- `apps/next/wrangler.toml` binds only D1 (A2/H5).
- Both maintenance configs set `MAINTENANCE_MODE = "true"` (`workers/maintenance/wrangler.toml:9,25`).
- Runbook gate 6 defers lifecycle, transit, auto-confirm and undo to this work.

**Shared code.** `functions/api` is bundled once by `build:api` (`package.json:16`) into `.wrangler/functions-build`. That bundle is imported by `apps/next/worker.ts:2`, proxied at `worker.ts:33-47` and partly called in-process via `apps/next/api-capture.ts`. The same code therefore serves the Next and the fallback Pages surface.

## Decision

### 1. Lifecycle columns (migration `0006_flight_lifecycle.sql`)

Columns are added with `ALTER TABLE flights ADD COLUMN`; there is no table rebuild. A rebuild would have to carry `sqlite_sequence`: a reused deleted `id` would turn a `flight_idempotency` tombstone (`flights/index.ts:158-160`) into a replay of an unrelated flight.

| Column | Type / constraint | Meaning |
|---|---|---|
| `lifecycle_state` | `TEXT CHECK (lifecycle_state IS NULL OR lifecycle_state IN ('upcoming','awaiting','logged'))`, no default | Canonical state, never `draft`. NULL never survives the inserting statement (see the adapter below). |
| `confirmation_source` | `TEXT CHECK (… IS NULL OR … IN ('save','user','automatic','legacy'))` | Non-null iff `logged`. |
| `confirmed_at` | `TEXT` (canonical ISO UTC, `_lib/time.ts`) | NULL iff not logged or `legacy`. |
| `lifecycle_timezone` | `TEXT CHECK (… IS NULL OR length(…) BETWEEN 1 AND 64)` | Captured IANA zone. Required when `upcoming`/`awaiting`. |
| `awaiting_after` | `TEXT` (ISO UTC) | Start of local day `date + 1`. Required when `upcoming`/`awaiting`. |
| `auto_confirm_after` | `TEXT` (ISO UTC) | Start of local day `date + 8` (7 calendar days after `awaiting_after`). Required when `upcoming`/`awaiting`. |
| `arrival_transit` | `INTEGER CHECK (… IS NULL OR … IN (0,1))` | NULL: no decision. 1: transit. 0: the member left the airport. |
| `arrival_transit_leg_id` | `INTEGER` | Outgoing leg matched when a transit decision was written (§4). Non-null only when `arrival_transit = 1`. |
| `is_upcoming` (existing) | unchanged | Compatibility projection: `1` iff `upcoming`. |

**Invariant** `INV(row)`, all conjuncts required:

- `lifecycle_state IS NOT NULL`;
- `is_upcoming = (lifecycle_state = 'upcoming')`;
- `(confirmation_source IS NOT NULL) = (lifecycle_state = 'logged')`;
- `lifecycle_state <> 'logged' OR (confirmation_source = 'legacy') = (confirmed_at IS NULL)`;
- `lifecycle_state = 'logged' OR confirmed_at IS NULL`;
- `lifecycle_state = 'logged' OR (lifecycle_timezone, awaiting_after, auto_confirm_after all NOT NULL)`;
- `arrival_transit_leg_id IS NULL OR arrival_transit = 1`.

**Triggers (controller ruling R2: adapt pre-lifecycle writers, don't abort them).** SQLite triggers cannot assign `NEW.*`, so every adapter is an `AFTER` trigger that runs a nested `UPDATE flights … WHERE id = NEW.id`. A pre-lifecycle writer is recognised by its signature: it writes the old columns (`is_upcoming`, `date`, `origin`, `destination`) but never the lifecycle columns, so they keep their `OLD` values.

`SHIFT(x)` is `strftime('%Y-%m-%dT%H:%M:%fZ', OLD.x, printf('%+d days', julianday(NEW.date) - julianday(OLD.date)))`: the stored deadline moved by the whole-day date difference. It keeps the stored zone (SQLite cannot do IANA arithmetic) and is exact except across a DST change, where it is off by at most the DST delta until the next lifecycle-aware edit. `UTCDL` means zone `'UTC'`, `awaiting_after = strftime('%Y-%m-%dT%H:%M:%fZ', NEW.date, '+1 day')`, `auto_confirm_after = … '+8 days'`.

| # | Trigger | Fires | Effect |
|---|---|---|---|
| 1 | `flights_lifecycle_adapt_insert` | `AFTER INSERT WHEN NEW.lifecycle_state IS NULL` (only an old writer omits the column; T07 code always writes it) | `is_upcoming = 1` → `upcoming` + `UTCDL` (the old writer's own UTC rule). `is_upcoming = 0` → `logged`, `save`, `confirmed_at = NEW.created_at`. |
| 2 | `flights_lifecycle_adapt_flag` | `AFTER UPDATE OF is_upcoming WHEN NEW.lifecycle_state IS OLD.lifecycle_state AND NEW.is_upcoming <> (NEW.lifecycle_state = 'upcoming')` (old sync, old cron, old date edit across today) | `1 → 0` → `awaiting`, never silently logged. Deadlines are kept if the date is unchanged; otherwise `SHIFT`. `0 → 1` → `upcoming`. Clears `confirmation_source`, `confirmed_at`, `arrival_transit` and `arrival_transit_leg_id`. On `0 → 1`, uses `SHIFT` when `OLD.lifecycle_state = 'awaiting'` and `UTCDL` when `OLD.lifecycle_state = 'logged'`. |
| 3 | `flights_lifecycle_adapt_redate` | `AFTER UPDATE OF date WHEN NEW.date IS NOT OLD.date AND NEW.is_upcoming = OLD.is_upcoming AND NEW.lifecycle_state IS OLD.lifecycle_state AND NEW.lifecycle_state IN ('upcoming','awaiting') AND NEW.awaiting_after IS OLD.awaiting_after AND NEW.lifecycle_timezone IS OLD.lifecycle_timezone` (old re-date that does not cross today: upcoming future→future, awaiting past→past) | `awaiting_after = SHIFT(awaiting_after)`, `auto_confirm_after = SHIFT(auto_confirm_after)`, state unchanged. This matches the §2 "edit `date`" rows: the state follows the old writer's flag, and deadlines follow the corrected date. If the shifted `auto_confirm_after` has already passed, the next pass auto-confirms. A lifecycle-aware re-date always writes new deadlines, and for an unchanged zone and a changed date they always differ, so it never matches. |
| 4 | `flights_lifecycle_adapt_route` | `AFTER UPDATE OF origin, destination WHEN (NEW.origin IS NOT OLD.origin OR NEW.destination IS NOT OLD.destination) AND (NEW.arrival_transit IS NOT NULL OR NEW.arrival_transit_leg_id IS NOT NULL)` | Sets `arrival_transit = NULL, arrival_transit_leg_id = NULL`. This is the §2 route-edit rule enforced for every writer, so a decision about the old hub never suppresses a new destination. |
| 5 | `flights_lifecycle_check_insert` | `AFTER INSERT WHEN NEW.lifecycle_state IS NOT NULL AND NOT INV(NEW)` | `RAISE(ABORT, 'LIFECYCLE_INVARIANT')` |
| 6 | `flights_lifecycle_check_update` | `AFTER UPDATE WHEN NOT INV(NEW) AND NOT (<trigger 2 condition>)` | `RAISE(ABORT, 'LIFECYCLE_INVARIANT')` |

**Ordering and recursion.**

- **Why `UTCDL` for logged rows (F1).** A logged row may still carry its upcoming-era deadlines. §2 keeps a logged row's deadlines on a past re-date, so they are anchored to an old date and are not a valid base for `SHIFT`. Only `upcoming`/`awaiting` deadlines are maintained in step with `date` (by T07 code and adapters 2–3), so only those are shifted. This is the alternative to having the logged re-date NULL or recompute its deadlines: it is chosen because it fixes the one place that consumes them, keeps T07's logged edit a no-op, and needs no backfill.
- **Adapters 1–3 never act on the same row event.** 1 is INSERT only. 2 requires the flag to disagree with the state, while 3 requires the flag to be unchanged on a row that satisfied `INV`, so the flag agrees with the state.
- **Adapter 4 can co-fire with 2 or 3** on an old edit that changes both route and date. Its writes either touch different columns or set the same NULLs, so the result is order-independent.
- **No nested `UPDATE` re-fires an adapter.** None sets `is_upcoming`, `date`, `origin` or `destination`. Recursion is impossible either way, because `recursive_triggers` only matters when a trigger fires itself.
- **Check 6 validates every adapted row.** Its exemption is exactly adapter 2's condition. A row in that state is still pending adaptation by adapter 2 on the same outer event.
- **Intermediate rows (F3).** SQLite fires the triggers of one event in reverse creation order: `0006` creates them 1→6, so for an UPDATE they run 6, 4, 3, 2. That order is an implementation detail, so the design must hold for any order.
  - Take an old edit that changes route and date into the future on a logged flight with `arrival_transit = 1`. Adapter 4's nested `UPDATE` can then run on an intermediate row that still has flag 1 and state `logged`. That row violates `INV`.
  - Check 6 fires for the nested `UPDATE`, but the row matches adapter 2's condition (state unchanged, flag disagrees). It is exempt only because adapter 2 is guaranteed to run for the same outer event: its `WHEN` is evaluated on the outer `NEW` snapshot, which matches.
  - Adapter 2's own nested `UPDATE` then produces the final row, and check 6 validates it fully.
  - If adapter 2 runs first instead, adapter 4 still fires (outer `NEW.arrival_transit = 1`) and writes NULLs over a valid row.
  - Either way the final row satisfies `INV`, and an invalid row never survives the statement, because every nested `UPDATE` that leaves an unexempted violation aborts. A2 covers this case.
- **Batch rollback.** `RAISE(ABORT)` fails the D1 batch, which rolls back the whole batch (A1).
- **`changes()`.** SQL `changes()` and `last_insert_rowid()` exclude trigger writes, so the §5/§6 chains, the old create link and `dirtyUserStatement(…, true)` are unaffected. D1 `meta.changes` is a `total_changes()` delta and includes adapter writes (Miniflare: 2 per flight for old sync and cron, up to 3 for an old route+date edit), and remote D1 is assumed to behave the same until proven. Old readers only test it for `> 0`, log it, or read the trigger-free ledger statement, so the impact is cosmetic. Lifecycle-aware code takes counts from `RETURNING` or a re-read, never from `meta.changes` on `flights`.
- **T07 code never fires adapters 1–3.** A T07 test asserts that every lifecycle-aware writer (create, bulk, conversion, edit, sync, cron, confirm, transit review) leaves those triggers unfired; it uses a test-only counting trigger. An app bug writing NULL `lifecycle_state` or forgetting to recompute deadlines would otherwise be silently adapted.

**Why not reject the old writer.** R2 requires migrate-then-deploy with no create outage. With the adapters, the pre-lifecycle build keeps working against `0006` until T07 code replaces it, and its writes never corrupt the lifecycle. Its known degradations are bounded and listed in §10:

- UTC eligibility, so an old sync or cron moves a flight to `awaiting` on its UTC departure day;
- no confirmation;
- no auto-confirm;
- DST-approximate shifted deadlines.

An old edit that changes neither date nor route leaves lifecycle untouched, which is correct.

**Indexes:**

- `idx_flights_user_lifecycle ON flights(user_id, lifecycle_state, date)`;
- `idx_flights_due_upcoming ON flights(awaiting_after, id) WHERE lifecycle_state = 'upcoming'`;
- `idx_flights_due_awaiting ON flights(auto_confirm_after, id) WHERE lifecycle_state = 'awaiting'`.

`FLIGHT_COLUMNS` (`flights/index.ts:24-27`), `FlightRow` and `toOwnFlight` (`_lib/flights.ts`) gain the fields additively, and `is_upcoming` stays.

**Calendar rule.** A pure helper `packages/shared/src/calendar.ts` handles date arithmetic. `date` is a `YYYY-MM-DD` label and is never passed to `new Date(date)` for presentation.

- `localToday(tz, now)` returns the calendar date at `now` in `tz`.
- `startOfLocalDay(label, tz)` returns the UTC instant of local 00:00. In a DST gap it returns the first existing instant after midnight; for an ambiguous midnight it returns the earlier instant.
- `addDays(label, n)` is label arithmetic. It never adds 24 hours.

**Time zone capture.**

- Create, bulk create, draft conversion and date edits take an optional `timezone` request field. It is validated with `Intl.DateTimeFormat(undefined, { timeZone })` and canonicalized via `resolvedOptions().timeZone`. An invalid value returns `400 INVALID_TIMEZONE`.
- Fallback order: the request value, then the flight's stored zone (edits only), then `UTC` (old clients).
- `timezone` is request context, outside `FlightInput`, and excluded from `digestInput` (`flights/index.ts:38-41`). Replays that were stored before the deploy therefore keep their digest.
- Deadlines are computed only at create or date edit. Transitions compare `now` with stored instants, so a late sync or a missed cron never restarts the clock. Countdown labels use the viewer's zone; eligibility does not.

### 2. Transition table and the owner sync trigger

In this table, `today` means `localToday(capturedTz, now)`. "Recompute" means recomputing both deadlines from `date` and the zone.

| Operation | From | Result |
|---|---|---|
| Create / bulk create / draft conversion, `date <= today` | none | `logged`, `save`, `confirmed_at = now`. Deadlines and `arrival_transit` NULL (existing endpoint policy, §4). Newly pressed countries per §5 "Newly stamped". |
| Same, `date > today` | none | `upcoming`; deadlines set. No completed totals, visits or stamps. |
| Owner sync or cron, `now >= awaiting_after` | `upcoming` | `awaiting`. Counts in completed totals and airport visits. Its countries are pending unless pressed elsewhere. |
| Same pass, `now >= auto_confirm_after` | `awaiting` | `logged`, `automatic`, `confirmed_at = now`. `arrival_transit` set to the effective policy, plus `arrival_transit_leg_id` when the result is transit (§4). No animation. A flight past both deadlines makes both moves in one pass. |
| `POST /api/flights/confirm` | `awaiting` | `logged`, `user`, `confirmed_at = now`. `arrival_transit` = submitted value, else the effective default; always 0/1. `arrival_transit_leg_id` is set when the result is transit. |
| Edit `date` to future | any | `upcoming`. Clears confirmation fields, `arrival_transit` and `arrival_transit_leg_id`. Recompute. |
| Edit `date` to today/past | `upcoming` | Recompute. `awaiting` if `now >= awaiting_after`, else stays `upcoming`. A corrected upcoming flight never skips the queue (gap in C2, §11). If `auto_confirm_after` has also passed, the next owner sync or cron pass logs it as `automatic`; the edit never does it inline. |
| Edit `date` to today/past | `awaiting` | Stays `awaiting`; recompute from the corrected date, never from the edit time. |
| Edit `date` to today/past | `logged` | Stays `logged`. Provenance kept. |
| Edit `origin`/`destination` | any | Lifecycle unchanged. `arrival_transit` and `arrival_transit_leg_id` reset to NULL. |
| Other field edits | any | No lifecycle change. |
| Delete / bulk delete | any | Row removed as today. "Did not fly" is client-only: the card hides and the existing `DELETE /api/flights/:id` is sent after a 6 s undo window. Closing before then leaves the flight `awaiting`. There is no server-side state for it. |
| Transit review apply (§5) | `logged`, `legacy`/`save`, `arrival_transit` NULL | `arrival_transit = 1` plus `arrival_transit_leg_id`. Lifecycle and provenance unchanged. |

**`applyDueTransitions(db, { userId?, now, limit })`** (`functions/api/_services/lifecycle.ts`) is the only implementation of the two due transitions. It is used by the owner sync and by the cron.

- It first runs `INSERT INTO user_derived_state (user_id, revision, published_revision) VALUES (?, 0, 0) ON CONFLICT (user_id) DO NOTHING` as its own statement (upsert-then-guard). A user with no derived-state row would otherwise never pass the guard below.
- One read batch then captures the user's flights and `user_derived_state.revision` = R.
- Upcoming→awaiting updates are guarded by state and deadline.
- Auto-confirm updates are also guarded by `EXISTS (SELECT 1 FROM user_derived_state WHERE user_id = ? AND revision = R)`, so a policy computed from a stale snapshot never applies. That pass becomes a no-op and the next pass retries.
- `dirtyUserStatement` comes last in the batch. It is unconditional whenever the read found due flights, because `changes() > 0` would only see the last `UPDATE`. A lost race costs one extra repair.

**Owner sync contract (controller ruling R1).** `POST /api/flights/sync-upcoming`:

- owner-scoped and CSRF-checked, with an empty body;
- at most 100 flights per direction per call;
- returns `{ synced, awaited, autoConfirmed, more, derived_state?, revision? }`.

`synced` counts distinct flights whose state changed. A flight making both moves counts once in `synced` and once in each of `awaited` and `autoConfirmed`. `apps/web` reads only `synced`, so it stays compatible.

**Where the trigger lives.** `ActivityBridge` in `apps/next/src/client/activity.tsx` (mounted in `apps/next/src/app/layout.tsx:27`) is the member shell's client activity island.

- **When it fires:** after `checkIdentity()` publishes a non-null member id, if `localStorage['kuuki:lifecycle-sync:<userId>']` is older than 10 minutes or absent. The timestamp is written before the request, so tabs share the throttle, and identity reset clears it.
- **Follow-ups:** while `more` is true, at most 2 more calls.
- **On changes:** when `synced > 0`, it calls `router.refresh()` for server-owned routes and dispatches `kuuki:lifecycle-changed` for Query-owned queue and badge reads.
- **On failure:** it does nothing visible and the next window retries.

`GET /api/me/awaiting` stays read-only. When the cron is enabled it runs the same function for all accounts (§8).

### 3. Historical backfill (inside `0006`, before the triggers are created)

```sql
UPDATE flights SET lifecycle_state = 'logged', confirmation_source = 'legacy' WHERE is_upcoming <> 1;
UPDATE flights SET lifecycle_state = 'upcoming', lifecycle_timezone = 'UTC',
  awaiting_after     = strftime('%Y-%m-%dT%H:%M:%fZ', date, '+1 day'),
  auto_confirm_after = strftime('%Y-%m-%dT%H:%M:%fZ', date, '+8 days')
WHERE is_upcoming = 1;
-- fail the migration loudly if any guard is violated
CREATE TABLE _m0006_assert (ok INTEGER NOT NULL CHECK (ok = 1));
INSERT INTO _m0006_assert SELECT NOT EXISTS (SELECT 1 FROM flights WHERE is_upcoming NOT IN (0,1)
  OR lifecycle_state IS NULL OR (lifecycle_state = 'logged' AND confirmation_source IS NULL)
  OR (lifecycle_state = 'upcoming' AND (awaiting_after IS NULL OR auto_confirm_after IS NULL)));
INSERT INTO _m0006_assert SELECT NOT EXISTS (SELECT 1 FROM visits WHERE country_code = '');
DROP TABLE _m0006_assert;
```

- **Malformed dates.** An upcoming row with a malformed `date` gets NULL deadlines and fails the assertion instead of becoming a row that can never come due. T07 ships the matching read-only pre-check `SELECT`.
- **Empty country codes.** `mergeVisits` can write `country_code = ''` (`derivedState.ts:101`), and `countries_count` would count it (`stats.ts:151`). The projection excludes `''`/NULL. The second assertion proves no such row exists before seeding. If the pre-check finds one, T07 fixes the reference data first.
- **Old non-upcoming flights** become `logged`/`legacy` with `arrival_transit` NULL, which includes both endpoints as today. IDs, `flight_idempotency`, claims, ground visits, `legacy_visit_evidence`, `visits` and `user_stats` are untouched.
- **Old upcoming flights** keep `upcoming` with UTC deadlines, the old system's own zone. Overdue ones move through ordinary transitions. A flight more than 7 days past its date makes both moves in one pass and lands as `automatic`. Only flights still inside their 7-day window enter the queue. No historical *logged* flight ever becomes `awaiting`.
- **Projection seed.** `0006` seeds `country_visit_evidence` (§4) from published `visits` (excluding `''`), `country_claims` and `ground_visits`. With no awaiting flights and no transit decisions, the seed equals what the first repair produces, so there is no mass dirty mark. A mass mark (`0003:14-16`) would show every account as "updating" while the cron is held. Already-dirty accounts repair as usual.

### 4. Country evidence and connections (C3)

**Projection.** `visits` stays the airport aggregate (both endpoints of every non-upcoming flight). `0006` adds `country_visit_evidence`:

| Column | Type / constraint |
|---|---|
| `user_id` | `TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `country_code` | `TEXT NOT NULL CHECK (length(country_code) = 2)` |
| `status` | `TEXT NOT NULL CHECK (status IN ('pressed','pending'))` |
| `logged_visit_count` | `INTEGER NOT NULL DEFAULT 0 CHECK (… >= 0)`: Σ airport visit counts of country-contributing endpoints of logged flights, max-merged with legacy evidence as in `derivedState.ts:109-130` |
| `awaiting_visit_count` | `INTEGER NOT NULL DEFAULT 0 CHECK (… >= 0)` |
| `claimed` | `INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0,1))` |
| `ground_visit_count` | `INTEGER NOT NULL DEFAULT 0 CHECK (… >= 0)` |
| `first_visit`, `last_visit` | `TEXT` (`YYYY-MM-DD`; NULL for claim/ground-only) |
| `policy_version` | `INTEGER NOT NULL DEFAULT 1` |
| key / index | `PRIMARY KEY (user_id, country_code)`; `idx_country_evidence_user_status ON (user_id, status)` |

- A row exists only when a count or `claimed` is positive.
- `pressed` iff `logged_visit_count > 0 OR claimed = 1 OR ground_visit_count > 0`. Otherwise the row is `pending` (awaiting-only).
- `country_evidence_suppressions` has columns `user_id … REFERENCES users(id) ON DELETE CASCADE`, `flight_id INTEGER NOT NULL`, `endpoint TEXT NOT NULL CHECK (endpoint IN ('origin','destination'))` and `country_code TEXT NOT NULL`, with `PRIMARY KEY (user_id, flight_id, endpoint)`. It lists only suppressed endpoints and is created empty, because no transit decisions exist at migration.

**Publish flow.** `repairUserDerivedState` adds one read to its `combineReads` batch: flights with lifecycle, time and decision columns (upcoming flights included as potential outgoing legs), claims and ground visits.

- Pure functions compute both tables: `connectionChains` (`_services/connections.ts`) and `deriveCountryEvidence` (`_services/countryEvidence.ts`). Both tables are published as the user's full computed set, with deletes for rows outside it, and the batch stamps `evidence_revision` (§10).
- Both tables are written in the existing guarded publish batch with the diff-upsert pattern of `visitStatements` (`derivedState.ts:145-168`).

Consumers:

- **Passport** list and detail (`passport/countries/*`, `apps/next/src/server/passport.ts`) read only the published projection. Detail derives contributing flight IDs with the same pure policy and returns `derivedState`.
- **`user_stats.countries_count`** counts projection rows with `logged_visit_count + awaiting_visit_count > 0`: flight and legacy countries after transit policy, no claims or ground visits. That is today's meaning. `continents_count` uses `continentOf7` over the same set. The leaderboard `countries` category, the 5-flight eligibility and `cities` → `airports_count` stay unchanged (`_services/leaderboard.ts:18-24,58`).
- **The passport collection count** (pressed, including claims and ground visits) and `pendingCountryCount` are separate DTO fields with distinct labels.
- **Overview.** Overview counts country figures from published data only; it never mixes live endpoints with published suppressions.
  - `period = 'all'` uses projection rows with `logged_visit_count + awaiting_visit_count > 0`. This now includes legacy evidence, matching Passport (an intentional change from `overview.ts:56-57`).
  - A year uses canonical non-upcoming endpoints in that year, anti-joined with `country_evidence_suppressions`. `revision`, `published_revision`, `evidence_revision` and these canonical rows are read in one D1 read batch, so the readiness gate (§10) and the rows come from the same snapshot. Legacy evidence has no reliable per-year attribution, so it stays out of year periods, as today.
  - While the account is not ready (`revision ≠ published_revision OR evidence_revision ≠ published_revision`, §10), Overview returns `countries: null` with `countryState: 'updating'` instead of a mixed figure, so a hub never appears as a country while a repair is pending.

**Region models (three, by decision):**

| Model | Where it is used |
|---|---|
| `continentOf7` (`_lib/continents.ts:25-34`) | `continents_count` and continent badges, as versioned `badge-continents-v1`. Badges stay award-only (`stats.ts:186-233`). |
| `regionOf` (`continents.ts:37-45`) | Still drives the persisted `user_advanced_stats` continent and region breakdowns. Their input switches from `visits` countries to the projection's flight countries inside the same repair. At migration the two sets are identical (no transit decisions), so non-dirty accounts are not stale. |
| Six-region catalog model (`packages/data/src/countries.json` `continent`: africa 58, americas 54, asia 52, europe 51, oceania 28, antarctica 3; 246 total) | Overview, Passport, profile and geographic progress. Computed **at read time** from the published projection through a T08-generated, checked-in country→region map (`functions/` cannot import `@kuuki/data`) with a parity test. Never persisted, so it needs no dirty mark. Retiring `regionOf` consumers later (W4) requires a policy bump plus a dirty mark. |

**Connection chains** (deterministic, no trips entity):

1. Sort legs by `departure_utc`, else `date`T00:00Z, with `id` as the tiebreak. The order affects traversal only, not link eligibility.
2. *Precise* link A→B: `A.destination = B.origin`, both `A.arrival_utc` and `B.departure_utc` present, and `0 <= B.departure_utc - A.arrival_utc <= 24h`.
3. *Estimated* link: same airport, an instant missing, and `B.date ∈ {A.date, addDays(A.date, 1)}`.
4. For incoming A: if any precise candidate exists, exactly one must exist; otherwise exactly one estimated candidate must exist. B must be unique for A under the same rule. Anything else is *ambiguous*: review-only, never suppressed automatically. Precise candidates outrank estimated ones. That is this ADR's reading of C3's "equally plausible": a timed connection is more plausible than a date-only one.
5. A maximal chain of unambiguous links has a start country and a final country. A connection endpoint in either of them is not a third-country candidate.

**Effective arrival policy** for F's destination, shared by queue DTOs, the projection, Overview, Passport, auto-confirm and cleanup:

1. **Explicit decision.** If `arrival_transit` is not NULL, use it. For `= 1`, the suppressed outgoing origin is the stored `arrival_transit_leg_id`, not the live chain. If that leg no longer exists or no longer departs from F's destination airport, only F's destination is suppressed. A later or ambiguous leg never revives the stamp, and the suppression never moves to another leg.
2. **Prospective default.** Otherwise, if F is `awaiting`: transit if F has an unambiguous outgoing link (estimated links are labelled) whose hub is a third-country candidate; else include. This is provisional and recomputed from the live chain until a decision is written.
3. **Existing policy.** Otherwise (logged `legacy`/`save`, or route changed): include. No prospective default reclassifies history.

Under transit, the hub country gets no country evidence from F's destination or from the matched leg's origin, whatever that leg's state. Airport evidence keeps both endpoints. A country supported by another flight, legacy row, claim or ground visit stays. «Выходил в город» (`arrival_transit = 0`) includes the hub, as pending or pressed according to lifecycle.

**T08 implementation notes (rules fixed while implementing §4):**

- **One calculation.** `functions/api/_services/connections.ts` (`connectionChains`), `countryEvidence.ts` (`effectiveArrivalPolicies`, `arrivalSuppressions`, `countryContributions`, `deriveCountryEvidence`). The repair publishes the projection and the suppressions, and `countries_count`, `continents_count` and the persisted advanced breakdowns take their country set from the same result (`flightCountriesOf`). `visits` and airport statistics keep both endpoints. T09's queue DTOs, auto-confirm and cleanup must call `effectiveArrivalPolicies`, not re-derive.
- **Link tiers.** Link A→B needs B to be A's only candidate *and* A to be B's only candidate in the winning tier. A date-only pair that could be ordered either way on one date (X→Y and Y→X, same label, no instants) forms a cycle: both legs are ambiguous. `ambiguous` carries the candidate IDs for review and never suppresses.
- **Ambiguous or competing legs and the hub.** A leg that departs from the hub counts that country even when it is ambiguous or competes with the stored leg (open item 7). Only the stored leg's origin and F's destination stay suppressed. A5 asserts the published suppression rows do not change when such a leg appears or the matched leg is deleted.
- **Overview.** The unfiltered all-time figure reads the projection (flight and legacy countries, no claims or ground visits). A year, and any filtered read, use canonical completed endpoints anti-joined with `country_evidence_suppressions`, as does the top-countries list. Every country figure is `null`/empty with `countryState: 'updating'` unless the readiness predicate holds in the same batch. `totals.continents` is now the six-region catalog count (`regionPolicyVersion`), not `continentOf7`.
- **Region policy.** `functions/api/_lib/regions.ts` (`REGION_POLICY = {version: 1, id: 'catalog-regions-v1'}`) over `countryRegions.generated.ts`, produced by `pnpm generate:regions` from `packages/data/src/countries.json`. `functions/test/regions.test.ts` fails when the checked-in map and the catalog differ. A policy bump needs a new version and no dirty mark, because nothing is persisted.
- **Profile `continents_count` stays on the seven-continent model.** The public profile keeps `continents_count` (`continentOf7`) until the profile task moves it, so Overview (six-region) and the profile can show different continent figures for the same account. This is deliberate; no profile code changed in T08.
- **Numeric continent eligibility inspected, unchanged.** `continents_count` keeps `continentOf7` (`badge-continents-v1`); the `continents` badge criterion is `continents_count >= n`, and badges stay award-only. The *input* changed: the country set is the evidence set, so a suppressed transit hub no longer counts toward the continent figure of a later repair. No award is revoked. `countries_count` now also excludes the empty-code bucket that `visits` could produce (§3), and still ranks flights and legacy evidence only, so the leaderboard `countries` category keeps its meaning.
- **Passport DTOs.** The list adds `countries[]` (published rows with `status` `pressed|pending`, per-source counts, `region`), `pressedCountryCount` (collection, including claims and ground visits), `pendingCountryCount`, `flightCountryCount` (the `countries_count` meaning), `regions[]`, `regionPolicyVersion`, `derivedState`, `revision` and `publishedRevision`, next to the unchanged airport/claim/ground arrays. The detail adds `status` (`pressed|pending|none`), `flightIds`, `entries[]` (flight, legacy with an `archived_counter` explanation and its covering flight count, claim, ground), `suppressed[]` (transit endpoints) and `derivedState`. Pending-only and suppressed countries never enter the pressed count.

### 5. Queue, confirmation and transit cleanup (C4)

`0006` adds two tables:

| Table | Columns / constraints |
|---|---|
| `lifecycle_operation_receipts` | `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`; `operation_id TEXT NOT NULL CHECK (length(operation_id) BETWEEN 8 AND 128)`; `kind TEXT NOT NULL CHECK (kind IN ('confirm','transit_review'))`; `request_digest TEXT NOT NULL`; `batch_nonce TEXT NOT NULL`; `expected_count INTEGER NOT NULL CHECK (expected_count >= 0)`; `applied_count INTEGER NOT NULL DEFAULT 0`; `complete INTEGER NOT NULL DEFAULT 0 CHECK (complete IN (0,1))`; `pressed_before_json TEXT`; `result_json TEXT`; `created_at TEXT NOT NULL`; table `CHECK (applied_count <= expected_count AND (complete = 0 OR applied_count = expected_count))`. `PRIMARY KEY (user_id, operation_id)`; `idx_lifecycle_receipts_created ON (created_at)` |
| `transit_cleanup_markers` | `user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`; `status TEXT NOT NULL CHECK (status IN ('dismissed','completed'))`; `candidate_set_digest TEXT NOT NULL`; `updated_at TEXT NOT NULL` |

All endpoints are owner-scoped, writes require CSRF, and they are composed through `apps/next/api-capture.ts` and the generated route table (A1).

**`GET /api/me/awaiting`** has no side effects. It returns:

- awaiting flights, each with its candidate link, label (`precise`/`estimated`/`ambiguous`), effective default and `candidateToken`;
- unresolved server draft summaries;
- `awaitingFlightCount`, `draftRowCount` (`import_drafts.status = 'review'` in unexpired batches) and `actionableCount = awaitingFlightCount + draftRowCount`;
- `derivedState` and `revision`.

A transport failure is an error, never an empty queue. Browser-local legacy drafts are not counted. They stay readable locally until their own 30-day expiry and are not uploaded.

**`candidateToken`** is a per flight SHA-256 over:

- the flight's `[id, lifecycle_state, date, origin, destination]`;
- the linked leg's `[id, date, origin, departure_utc]`;
- `label` and `effectiveDefault`.

It is scoped per item, so cron or sync ticks on other flights cause no spurious conflicts. It is deliberately not `user_derived_state.revision`.

**`POST /api/flights/confirm`** takes `{operationId, items:[{flightId, candidateToken, arrivalTransit?}]}`, with 1–100 unique flight IDs and no `timezone`. The request digest is the SHA-256 of canonical JSON `{kind:'confirm', items: [[flightId, arrivalTransit ?? null]] sorted by flightId}`. Tokens are excluded, so a refreshed token does not break an exact replay.

1. **Receipt first.** Read `(user_id, operation_id)`.
   - Digest mismatch → `409 IDEMPOTENCY_CONFLICT`.
   - Match with `result_json` → return it.
   - Match without `result_json` → attempt repair, then compute and freeze the result if publication is ready; otherwise return the committed-but-pending outcome.
   - Validation never runs for a known operation, so an exact replay always returns the recorded result.
2. **Validate (new operations only).** All-or-nothing:
   - unknown or foreign ID → `404 NOT_FOUND` for the whole request;
   - non-awaiting item → `409 STATE_CONFLICT` with a per-item `cause` (`logged`/`upcoming`);
   - recomputed token differs → `409 CANDIDATES_CHANGED`.
3. **Snapshot.** If the account is dirty, run `repairUserDerivedState` first. If it is ready, read the pressed set from the published projection into `pressed_before_json`; otherwise store NULL.
4. **One D1 batch:**
   - insert the receipt (`ON CONFLICT DO NOTHING`, fresh `batch_nonce`, `expected_count = items.length`);
   - per item, `UPDATE flights … WHERE user_id = ? AND id = ? AND lifecycle_state = 'awaiting' AND EXISTS (receipt with this nonce)`, followed by `UPDATE lifecycle_operation_receipts SET applied_count = applied_count + changes() WHERE user_id = ? AND operation_id = ? AND batch_nonce = ?`;
   - `UPDATE … SET complete = 1 WHERE … AND batch_nonce = ?`, where a count mismatch violates the CHECK and rolls back the whole batch (the `derivedState.ts:205-211` technique);
   - `dirtyUserStatement`.

   A concurrent same-operation request loses the receipt insert, so its nonce matches nothing and the batch commits no change.
5. **After the batch**, re-read the receipt:
   - Our nonce → repair.
   - Another nonce → step 1 (replay or `409 IDEMPOTENCY_CONFLICT`).
   - A batch error (CHECK or `LIFECYCLE_INVARIANT`) → re-read. If a same-operation winner exists, go to step 1; otherwise re-validate and return `409 STATE_CONFLICT` with causes (or `CANDIDATES_CHANGED`).
6. **Result.** After a successful repair, `result_json = {results, newlyStampedCountries, pendingCountryCount}` is stored once, with `derivedState: 'ready'` and `revision`. If repair fails, the response is `200` with `derivedState: 'pending'` and `newlyStampedCountries: null`. This is committed-but-pending: the UI shows "finishing save", polls publication and never re-submits.

**Newly stamped (confirm, create, bulk, conversion).** `newlyStampedCountries = (pressed after publication − pressed_before) ∩ countries contributed by the operation's own flights` (their non-suppressed endpoints). It is null when `pressed_before` is NULL or publication is pending.

- Creates take the same snapshot only when the account is already published. They return `newly_stamped_countries` (snake_case, as on the legacy DTO) on fresh `created` results; it is null on `replayed` items or pending publication.
- The intersection prevents a concurrent claim or edit from being attributed to the operation. The remaining residual (a concurrent mutation that presses the same country) is accepted.

**Retention.** Receipts are kept 14 days; the supported client replay interval is 6 days, as for creates.

**`GET /api/me/transit-review`** has no side effects. It returns:

- candidates among logged `legacy`/`save` flights with `arrival_transit` NULL and an unambiguous third-country link, with `candidateToken`, estimate label and the matched leg;
- `wouldRemoveStamp` per country (false when supported elsewhere);
- the marker status.

**`POST /api/me/transit-review`** takes `{operationId, action: 'apply'|'dismiss', items?:[{flightId, candidateToken}]}`. The digest is `{kind:'transit_review', action, flightIds sorted}`. It follows the same receipt-first, nonce and progress rules:

- `apply`: `expected_count = items.length >= 1`. Each update is guarded by `lifecycle_state = 'logged' AND confirmation_source IN ('legacy','save') AND arrival_transit IS NULL` and writes `arrival_transit = 1` plus `arrival_transit_leg_id`. It upserts the marker as `completed`, repairs, and returns the actual `removedCountries` (pressed before minus after).
- `dismiss`: `expected_count = 0`, marker upsert only.

The banner shows only when candidates exist and no marker does. The GET stays reachable from Passport.

**T09 implementation notes.** Code: `_services/{queue,confirmation,transitReview,receipts}.ts`, routes `me/awaiting.ts`, `flights/confirm.ts`, `me/transit-review.ts`.

- The receipt is a plain `INSERT` (a duplicate operation id aborts the whole batch) rather than `ON CONFLICT DO NOTHING` plus a per-item nonce guard. One JSON-driven `UPDATE flights` replaces the per-item updates, followed by `UPDATE receipt SET applied_count = changes(), complete = 1`, whose CHECK rolls everything back when any flight was lost. The flights `UPDATE` also carries the `user_derived_state.revision` guard the decisions were computed under; a lost guard is a rollback and a retry (at most four attempts, then `409 STATE_CONFLICT` with `cause: concurrent_update`). Same transaction semantics as the ADR text, fewer statements.
- The receipt's `result_json` holds the applied results from the commit on; the outcome is complete (frozen) once it carries `derivedState`. A replay that finds no `derivedState` repairs and freezes it first-writer-wins.
- `candidate.label` is `precise`, `estimated`, `ambiguous` or null. `candidateToken` also covers the leg's destination and the chain's start and final countries and the ambiguous candidate ids, so it is stricter than the list above.
- Conflict `cause` values: `not_awaiting` (per item `logged` or `upcoming`), `candidates_changed`, `not_reviewable` (per item `awaiting`, `upcoming`, `confirmed_by_member`, `already_decided`), `operation_reused`, `concurrent_update`, and `flight_changed` on a flight edit that lost to a sync, confirmation or transit review (the edit guard now also covers `arrival_transit` and `arrival_transit_leg_id`).
- `removedCountries` and `newlyStampedCountries` are intersected with the countries the operation's own flights contribute or suppress, so a concurrent claim is never credited to it.
- Transit review GET returns `marker: {status, matchesCandidates}`; `matchesCandidates` compares the stored candidate-set digest with the current one. A dismissal hides the banner and leaves the option available.

### 6. Import drafts (migration `0007_import_drafts.sql`)

| Table | Columns / constraints |
|---|---|
| `import_batches` | `id TEXT PRIMARY KEY` (UUID); `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`; `source_type TEXT NOT NULL CHECK (source_type IN ('pdf','image','text'))`; `source_label TEXT CHECK (source_label IS NULL OR length(source_label) <= 120)` (sanitized base filename or fixed label, never content); `status TEXT NOT NULL CHECK (status IN ('processing','review','partial','failed','cancelled','completed'))`; `stage TEXT CHECK (stage IS NULL OR stage IN ('accepted','recognizing','validating','review_ready'))`; `sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0)`; `generation INTEGER NOT NULL DEFAULT 1`; `submission_operation_id TEXT NOT NULL`; `error_code TEXT`; `retry_after TEXT`; `processing_deadline TEXT`; `created_at`, `updated_at`, `expires_at TEXT NOT NULL` (creation + 30 days). `UNIQUE (user_id, submission_operation_id)`; `idx_import_batches_user ON (user_id, status, created_at)`; `idx_import_batches_expiry ON (expires_at)` |
| `import_drafts` | `id TEXT PRIMARY KEY` (immutable UUID); `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`; `batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE`; `ordinal INTEGER NOT NULL CHECK (ordinal >= 0)`; `fields_json TEXT NOT NULL CHECK (length(fields_json) <= 2048)` (ExtractedFlight fields only); `confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1)`; `field_confidence_json TEXT CHECK (… IS NULL OR length(…) <= 1024)`; `year_explicit`, `year_confirmed`, `selected`, `edited`, `duplicate_acknowledged` `INTEGER NOT NULL DEFAULT 0 CHECK (… IN (0,1))`; `status TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('review','dismissed','converted'))`; `version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)`; `converted_flight_id INTEGER`; `created_at`, `updated_at`. `UNIQUE (batch_id, ordinal)`; `idx_import_drafts_user_status ON (user_id, status)` |
| `import_conversion_receipts` | `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`; `operation_key TEXT NOT NULL`; `draft_id TEXT NOT NULL`; `batch_id TEXT NOT NULL`; `request_digest TEXT NOT NULL`; `flight_id INTEGER NOT NULL`; `created_at TEXT NOT NULL`. `PRIMARY KEY (user_id, operation_key)`; `UNIQUE (user_id, draft_id)`; `idx_import_conversion_receipts_created ON (created_at)`. No FK to drafts, batches or flights: receipts are tombstones. |

**Limits and storage rules.**

- **Limits:** 100 drafts per batch (the current `MAX_DRAFT_ROWS`), 10 unexpired batches per owner, and 1 batch `processing` per owner. Invalid references stay correctable drafts and never enter `flights`.
- **Never persisted:** uploaded bytes, base64, pasted text, provider responses and `raw_text`, in any of D1, DO storage, queues, R2, logs or browser storage. Normalization drops `raw_text`. No snippet is stored until a verified parser field exists.

**Shared services.**

- **`bulkCreate`.** `createFlightStatements` and result reconciliation move from `flights/bulk.ts:40-77` into `functions/api/_services/flightCreate.ts` as `bulkCreate(db, userId, items, {timezone, conversion?})`. `/flights/bulk` and draft confirmation both call it, with no internal HTTP round trip and no second validation path (`parseFlightBodies`, `_lib/flightValidation.ts:26-51`).
- **Synchronous batch writer (controller ruling R3, T10 scope).** `POST /api/import/jobs` exists in T10 regardless of H5. It authenticates, CSRF-checks and rate-limits (`parse.ts:267`), and is idempotent on `submission_operation_id`.
  - **No job binding:** it runs the parse normalization extracted from `parse.ts` (`extractFlights`, the same prompt, schema, model and limits) synchronously in the request. It then writes the batch plus all drafts in one D1 batch through the shared `persistDraftRows` (status `review`, `partial` or `failed` with a structured `error_code`) and returns the batch snapshot.
  - **H5 option (a) with a binding:** the same endpoint dispatches to the DO (§9).
  - Clients poll `GET /api/import/batches/:id`, which is also T10. The synchronous `POST /api/import/parse` stays for old clients.

**Draft endpoints.**

- **Draft conversion.** `POST /api/import/batches/:id/confirm` takes `{timezone?, items:[{draftId, version, key}]}`, with at most `FLIGHT_BULK_CREATE_MAX` (50) items. Each `key` is the `flight_idempotency` key.
  1. **Receipt first.** For each item, read the conversion receipt by `(user_id, operation_key)`, and also by `(user_id, draft_id)`. This happens before any batch-existence or expiry check, so a replay survives batch deletion and expiry.
     - Matching digest → replay.
     - Flight gone → `410 CONVERTED_FLIGHT_DELETED`, never recreated.
     - Differing digest → `409 IDEMPOTENCY_CONFLICT`.
     - The draft was already converted under another key → `409 DRAFT_ALREADY_CONVERTED` with that flight id.
  2. **Ledger pre-check.** Read `flight_idempotency` by `(user_id, key)`. A ledger row with no conversion receipt for that key means the key was already used by a plain create, or by another client. The item returns `409 IDEMPOTENCY_CONFLICT` and nothing is written for it.
  3. Otherwise the batch must exist and be unexpired.
  4. **Per item, in one D1 batch, in this order.** Every statement after the first is gated on this batch's own previous write:
     - the ledger insert `INSERT INTO flight_idempotency (user_id, key, payload_digest, flight_id, created_at) SELECT ?, ?, ?, NULL, ? WHERE EXISTS (SELECT 1 FROM import_drafts WHERE id = ? AND user_id = ? AND version = ? AND status = 'review') ON CONFLICT (user_id, key) DO NOTHING`;
     - the flight insert `… WHERE changes() = 1`;
     - the ledger link `UPDATE flight_idempotency SET flight_id = last_insert_rowid() WHERE user_id = ? AND key = ? AND flight_id IS NULL AND changes() = 1`;
     - `UPDATE import_drafts SET status = 'converted', version = version + 1, converted_flight_id = last_insert_rowid() WHERE id = ? AND user_id = ? AND version = ? AND status = 'review' AND changes() = 1`. A ledger `UPDATE` does not change `last_insert_rowid()`, so it is still the new flight;
     - `INSERT INTO import_conversion_receipts (user_id, operation_key, draft_id, batch_id, request_digest, flight_id, created_at) SELECT ?, ?, ?, ?, ?, converted_flight_id, ? FROM import_drafts WHERE id = ? AND user_id = ? AND changes() = 1 ON CONFLICT DO NOTHING`. The `ON CONFLICT` clause has no target, so it covers both the primary key `(user_id, operation_key)` and `UNIQUE (user_id, draft_id)`. The `WHERE` clause also resolves SQLite's `INSERT … SELECT … ON CONFLICT` parsing ambiguity. Neither conflict is reachable after the first statement's guards (same key → ledger `DO NOTHING`; same draft → no longer `review`), so the clause only hides an unexpected conflict instead of reporting it; the real safety net is A2/A4, which assert that every converted draft has exactly one receipt.

     The receipt and `converted_flight_id` therefore come only from the flight this batch inserted, never from an existing ledger row.

     **Why this is all-or-nothing per item without a `RAISE`.** A D1 batch is one serialized transaction. If the draft check in the first statement passes, nothing can change the draft before the fourth statement, so the chain either completes or stops at the first statement with nothing written.
     - A second tab or a retry with a new key finds the draft no longer in `review` and writes nothing.
     - A key already in the ledger (a race past step 2) hits `DO NOTHING` and writes nothing.

     So no draft is ever left `converted` without a flight, and none is linked to an unrelated flight.
  5. **Afterwards**, each item is re-read by key and by draft.
     - **A receipt exists for the key.** Compare its `request_digest` and `draft_id` with the request. On a match, the response is the success result (`created` if this batch inserted the flight, else `replayed`). A different digest or draft → `409 IDEMPOTENCY_CONFLICT`; success is never reported from a receipt that was not checked.
     - **No receipt exists for the key**, classified on the re-read:
     - a receipt exists for the draft under another key → `409 DRAFT_ALREADY_CONVERTED` with that flight id;
     - a ledger row exists for the key → `409 IDEMPOTENCY_CONFLICT`;
     - otherwise (stale `version` or draft dismissed) → `409 DRAFT_VERSION_CONFLICT`.

  Lifecycle per row follows the create rows of §2. Conversion receipts are kept **37 days from their own creation**: the 30-day draft life, plus the 6-day client retry, plus a 1-day margin. That outlives the 7-day `flight_idempotency` purge.
- **`PATCH /api/import/drafts/:id`** is version-checked and owner-scoped. It returns `409 DRAFT_VERSION_CONFLICT` when the version is stale or the draft is converted.
- **Duplicate matching** runs over the full owned history at batch read and confirm, with the `duplicate-candidates.ts` json_each tuple query (`date`, `origin`, `destination`, excluding `converted_flight_id`).

**Retention and deletion.**

- **Expiry.** Expired batches cannot convert. Cleanup (§8) deletes drafts at `expires_at` and batch rows at `expires_at + 7 days`. Receipts age independently from their own `created_at`.
- **Discard** (`DELETE /api/import/batches/:id`) deletes the batch's drafts explicitly, then the batch, in one batch. It never relies on the FK cascade (`0001_init.sql:13-14`).
- **Account deletion.** `deleteUserCascade` (`functions/api/_lib/users.ts:72-96`) adds `import_conversion_receipts`, `import_drafts`, `import_batches`, `lifecycle_operation_receipts`, `transit_cleanup_markers`, `country_evidence_suppressions` and `country_visit_evidence` ahead of `flights`, in the same atomic batch.
- **Deletion fence.** Every job write is `INSERT … SELECT … WHERE EXISTS (SELECT 1 FROM import_batches WHERE id = ? AND user_id = ? AND status = 'processing' AND generation = ?)`. After cancel (`generation + 1`), discard or account deletion, late writes match nothing.

### 7. Migration numbering and deploy order

The next free numbers come from `db/migrations` (latest `0005_profiles_created_at.sql`):

- **`0006_flight_lifecycle.sql`**: columns, backfill and assertions, triggers, indexes, `country_visit_evidence` plus seed, `user_derived_state.evidence_revision` (seeded to `published_revision`), `country_evidence_suppressions`, `lifecycle_operation_receipts`, `transit_cleanup_markers`.
- **`0007_import_drafts.sql`**.

Both are additive (no DROP or rename), and the numbers are rechecked against the architecture ledger (H5).

**Deploy order:** apply `0006` and `0007` together, then deploy T07+ code. T07 code writes the new lifecycle columns and `deleteUserCascade` deletes from the `0007` tables, so it cannot run on a schema missing either migration. `0007` is additive and inert until the T10 code uses it, so applying it early costs nothing. The pre-lifecycle build keeps creating flights through the §1 adapters between the migration and the deploy, so there is no outage.

### 8. Maintenance ordering (T09)

1. `MAINTENANCE_MODE === 'true'` → return before any DB access (unchanged, `workers/maintenance/index.ts:15`).
2. `applyDueTransitions` upcoming→awaiting: up to 50 users by oldest `awaiting_after`, up to 100 flights per user, one batch per user.
3. The same for awaiting→logged `automatic`, with the revision guard of §2.
4. Dirty repair (the existing loop, lines 48-54), now also selecting stale evidence stamps and using the §10 readiness predicate as the repair's own ready check. This publishes steps 2–3.
5. `refreshLeaderboards`.
6. Cleanup:
   - existing auth/session rows;
   - `flight_idempotency` > 7 days;
   - `lifecycle_operation_receipts` > 14 days;
   - drafts of expired batches;
   - batches past `expires_at + 7 days`;
   - `import_conversion_receipts` > 37 days.

   `processing` batches past `processing_deadline` become `partial` (rows exist) or `failed`, with `JOB_INTERRUPTED` and `generation + 1`.
7. Status update. Remaining dirty users, remaining stale evidence stamps or remaining due transitions make the cycle a retryable failure (line 72), never a false success.

**Fairness and catch-up.** Work is ordered by due instant and capped per user; the stored deadline is the cursor. Missed days and outages catch up without moving eligibility, and the cron runs every 5 minutes (`wrangler.toml:6`).

**Repair cap (T09).** Step 4 repairs up to 200 stale users per cycle, up from the previous 100. Steps 2 and 3 can dirty up to 100 users (50 per direction), and the repair selects oldest `updated_at` first, so with a cap of 100 any earlier leftovers would push exactly those freshly dirtied users out of the pass and make the cycle fail on remaining dirty users. 200 leaves room for both.

**Production state.** `workers/maintenance/wrangler.toml` keeps `MAINTENANCE_MODE = "true"` (the cron is held; default and `preview`). The Pages and Next configs (`wrangler.toml`, `apps/next/wrangler.toml`) carry `"false"`, which for them means normal serving (`"true"` would be an application-wide hold applied at deploy time). No task changes any of the three. While the cron is held, the Next member shell's owner sync (§2, R1) is the only path for both due transitions. It runs when a member uses the app, and a member who never visits keeps upcoming flights until the cron is enabled. T09 ships preview-enablement steps only.

### 9. Recognition job runtime (C5, A6): option (a) decided

**Target design** (requires a binding):

- `workers/import/{index.ts, ImportJob.ts, tsconfig.json}`: one Durable Object per batch, `idFromName(`${userId}:${batchId}`)`. It is reached only through the same-origin API adapter via a service/DO binding, with no public endpoint.
- **Submission.** `POST /api/import/jobs` inserts the batch (`processing`, `accepted`), hands the in-memory input to the DO, then responds `{batchId}`. A duplicate submission returns the same batch and never starts a second provider call.
- **Extraction.** The DO runs `generateContentStream` with the unchanged prompt, schema and normalization (`extractFlights`). A bounded incremental scanner emits only complete `flights[]` objects. Each row is persisted (fenced insert through `persistDraftRows`, `sequence + 1`) **before** the notify. The final envelope reconciles ordinals, and an invalid tail keeps the valid rows as `partial`.
- **Events.** `GET /api/import/batches/:id/events?after=N` is SSE carrying `{sequence, rowIds}`. D1 is authoritative. A sequence gap returns a snapshot instruction, and a disconnect only unsubscribes.
- **Cancel and discard.** Cancel aborts the provider and increments `generation`. Discard follows §6.
- **Restart.** A restart loses the unextracted input. Reconciliation marks the batch interrupted, keeps its rows and asks for a reupload.
- **Limits.** As today: 10 MiB file, 14 MiB body, 100,000 characters, 90 s (`parse.ts:18-22`, `_provider.ts:6`). Output, events and drafts are bounded.

**Options:**

- **(a)** T11 builds `workers/import`, a local-only binding and a Miniflare disconnect/interrupt proof. Production wiring (Wrangler, DO migration tag, compatibility date) goes to architecture.
- **(b)** Wait for architecture.
- **(c)** No streaming: the T10 synchronous batch writer (§6) is the whole runtime and clients poll the batch.

**Decision: (a), chosen by the owner on 2026-10-05.** Rationale:

- It honours the user-selected streaming scope, which (c) drops.
- It does not stall W3 on an unscheduled dependency, as (b) would.
- (c) is fully built in T10 under R3. `POST /api/import/jobs` dispatches to the DO only when the binding is present, so if architecture declines or delays the wiring, (a) degrades to (c) through configuration, without rework.
- Risks: the DO needs its own Worker script and binding outside the OpenNext bundle, and the keep-alive and compatibility claims in C5 (Cloudflare changelog 2026-10-01) are unverified until the Miniflare proof.

T11 builds the local DO and the Miniflare proof in `workers/import`. Production binding and wiring go to the architecture owner. Without the binding, the runtime is (c) with no rework. T07–T10 do not depend on the binding.

### 10. Rollback floor

**The floor.** After `0006`, the rollback floor for normal operation is a build of the post-T07 `functions/api`, the lifecycle-aware writer. That covers both the Next worker and the fallback Pages worker, which share the bundle (Context).

**Below the floor.** Builds below the floor (current production Pages and maintenance) are *tolerated* by the §1 adapters rather than blocked:

- old creates become `save`/`upcoming` (UTC);
- the old sync and cron move flights to `awaiting`, never silently `logged`. They do it on the UTC departure day, not the local day after: a known degradation;
- old re-dates become `upcoming`/`awaiting` with deadlines that follow the new date (triggers 2–3). Across a DST change the deadlines are approximate, off by at most the DST delta;
- an old route edit clears the canonical transit decision (trigger 4). The *published* `country_evidence_suppressions` row and the projection are written only by the new repair, though, and the old repair publishes without touching them. So until the roll-forward reconcile below runs, the stale row could still suppress the new destination on the Overview year path. The evidence stamp makes every reader in the readiness list below treat that state as `updating` instead.

**Roll-forward reconcile (F2).**

- **The stamp.** `0006` adds `user_derived_state.evidence_revision INTEGER NOT NULL DEFAULT 0`, set to `published_revision` at the end of the seed. Only the new repair writes it: in its guarded publish batch it sets `evidence_revision` to the revision it publishes. The old repair does not know the column, so any publication below the floor leaves `evidence_revision < published_revision`.
- **Readiness.** "Published and current" everywhere (§4 Overview gate, Passport `derivedState`, the §5 snapshot, the queue) means `revision = published_revision AND evidence_revision = published_revision`. A stale stamp reads as `updating`, so the Overview year path returns `countries: null` rather than applying the stale suppressions.
- **Forced repair.**
  - New maintenance selects users for repair by `revision <> published_revision OR evidence_revision <> published_revision`, with a matching partial index.
  - The R1 owner sync (`POST /api/flights/sync-upcoming`) runs `repairUserDerivedState` inline when the stamp is stale, so a member's first new-code session reconciles even while the cron is held.
  - **The repair's own ready check uses the same predicate.** Today it returns `ready` as soon as `revision = published_revision` (`derivedState.ts:186-188`), which would turn every forced repair into a no-op and leave the user selected, and "updating", forever. The new early return requires `revision = published_revision AND evidence_revision = published_revision`. A stale-stamp repair therefore runs the full publish and republishes the same revision R: the existing guard `published_revision = CASE WHEN revision = ? THEN ? ELSE -1 END` (`derivedState.ts:207-211`) accepts it because `revision` is still R, and the batch sets `evidence_revision = R`. The user then satisfies the predicate and drops out of both selections, so the repair terminates.
- **What the repair clears.** Its publish batch writes `country_evidence_suppressions` and `country_visit_evidence` as the full computed set: it deletes rows outside the set and upserts the rest. That removes the stale suppression of the old hub and re-includes the new destination.

- **Public readers are not gated (I3: documented degradation).** The shared `PUBLISHED_DERIVED_STATE` filter (`_lib/leaderboard.ts:24`, used by the public leaderboard, public profiles, total users and `me/rankings`) keeps checking only `revision = published_revision`. For a member whose stamp is stale, these readers show the `user_stats.countries_count` the old repair wrote from `visits`, which can include a transit hub, until the member's next new-code session or the cron runs the forced repair. Reason: gating would hide such members from public leaderboards and profiles for as long as the cron is held, a larger visible regression than a count that may be off by a transit hub.
- **Same-revision race.** While builds below and above the floor run at the same time, an old repair that read revision R before the new repair published R can still pass the guard and rewrite `visits`, `user_stats`, `user_advanced_stats` and badges after the stamp is already R; it leaves the evidence tables and the stamp untouched, so those old-meaning values persist until the user's next mutation is repaired, and the race is accepted because it ends when the old builds are retired.

So the plan's "old silent sync must not resume" holds in effect. Such builds still lose confirmation, auto-confirm, transit decisions and drafts, so rollback targets the floor. The adapter only prevents outage and corruption. Rollback procedures must not drop the triggers.

**During rollback:**

- hold `MAINTENANCE_MODE=true`;
- stop new job starts (the binding is absent or the jobs route returns 503; the synchronous paths remain);
- keep all additive tables, drafts and receipts;
- let the roll-forward reconcile above repair every user written below the floor (no manual step);
- rely on the `generation`/status fences.

No down-migration exists and no rollback deletes user data.

**Rollback rehearsal waiver.** T07 does not extend `scripts/rehearse-next-rollback.ts` to run a real pre-lifecycle Pages bundle against a post-`0006` database. The old-writer SQL in `functions/test/lifecycle-fixture.ts` (old sync, old cron rollover, old create, old edit) was checked against the pre-lifecycle code at `abe1d80` and stands in for the bundle in A2. Running the real pre-lifecycle bundle against a post-`0006` database is a release gate before `0006` reaches production, owned by whoever deploys.

### 11. Conflicts between C2–C5 and the code, and their resolutions

| # | Conflict | Resolution |
|---|---|---|
| 1 | Sync and cron flip on `date <= today` (UTC), so a same-day flight completes on its departure day (`sync-upcoming.ts:18`, maintenance `:24`). | Stored `awaiting_after`. Same-day creates log directly (`save`). |
| 2 | Create uses UTC today (`flights/index.ts:29-32`). | Captured zone; UTC only as the old-client fallback. |
| 3 | An edit without a date keeps `is_upcoming` (`[id].ts:76`). C2 has no "upcoming edited to past" row. | §2 rows, including the added one. |
| 4 | `digestInput` hashes the full input. | `timezone` is excluded. |
| 5 | Countries come from `visits`, and Overview reads them live from endpoints (`overview.ts:38-57`). | Published projection plus suppressions. Overview reads only published data and returns `updating` while a repair is pending. |
| 6 | Three region models exist: `continentOf7`, `regionOf` and the six-region catalog. | §4 table. Six regions are read-time only. |
| 7 | Claims and ground visits feed no derived table. | They feed the projection. |
| 8 | C5 has no `interrupted` status. | `partial`/`failed` plus `JOB_INTERRUPTED`. |
| 9 | `flight_idempotency` lives 7 days; drafts live 30. | 37-day conversion receipts. Lifecycle receipts are kept 14 days. |
| 10 | A rebuild risks `sqlite_sequence` id reuse. | `ADD COLUMN` plus triggers. |
| 11 | `parse.ts:241` returns `raw_text`. | Kept for old clients; never stored. |
| 12 | The `0003` mass dirty mark precedent. | Exact seed; no mass mark. |
| 13 | Next never calls sync-upcoming, and the cron is held, so D11 would never fire for Next users. | R1 activity-island trigger (§2). |
| 14 | C4 names one top-level `candidateRevision`. | Per-item `candidateToken`. Same validation intent, without spurious conflicts. |

## Consequences

- Most `is_upcoming` readers (routes, durations, stats, advanced stats, dashboard-stats) stay correct because `awaiting` projects to `0`, which counts as completed, as C2 requires. T07 audits every reader and moves new code to `lifecycle_state`.
- Old `apps/web` clients keep working. They send no zone (UTC), see awaiting flights as completed and never confirm. Their own sync calls and the Next shell's sync resolve those flights.
- Migrate-then-deploy has no create outage. Pre-lifecycle writers degrade but never corrupt.
- Repair does more work per mutation: one more read and a country diff of at most 246 rows. Confirm and create add one published-projection read.
- Seven new tables join the account-deletion cascade.

## Alternatives considered

- **Table rebuild with full CHECKs:** rejected (id reuse, §11 #10).
- **Abort pre-lifecycle writers:** rejected under R2 (create outage between migrate and deploy).
- **`BEFORE` triggers:** SQLite cannot assign `NEW.*` in a trigger, so adaptation requires `AFTER` plus an `UPDATE`.
- **`user_derived_state.revision` or a whole-queue hash as the candidate revision:** rejected (spurious conflicts).
- **Per-item partial confirmation:** rejected. All-or-nothing keeps replay and conflict semantics unambiguous.
- **Recomputing explicit-transit suppression from the live chain:** rejected (stamp revival, review I2). The matched leg is stored.
- **Storing contributing flight IDs per country:** rejected. Derived at read with the same policy.
- **A dedicated `did_not_fly` state:** rejected (C2).
- **Auto-confirm in the cron only:** rejected, because the cron is held. The owner sync shares the function (R1).

## Acceptance tests (must be proven)

| # | Proof | Task |
|---|---|---|
| A1 | `CREATE TRIGGER … BEGIN … END;` applies through `wrangler d1 migrations apply` (statement splitting) on Miniflare, and later on remote isolated D1. A `RAISE(ABORT)` inside `db.batch` rolls back the whole batch. SQL `changes()` excludes trigger writes; `meta.changes` behaviour on remote isolated D1 is recorded, and old `synced`/`rolledOver`/`created` readers are shown to be zero-tested, logged or trigger-free. | T07 |
| A2 | Upgrade `0001`→`0005`→fixture→`0006`: identical IDs, `visits`, `countries_count` and badges; the seed equals the first repair, including the `''`-country case. Old sync, old past and future insert, and old edit-to-future behave per §1. Old re-date without a flag change (upcoming future→future, awaiting past→past) shifts the deadlines with the date, and the flight is not awaiting or auto-confirmed before its new date. An old route edit on a flight with `arrival_transit = 1` clears the decision. No lifecycle-aware writer fires adapters 1–3. F1 sequence: upcoming(D0) → logged → lifecycle-aware re-date to D1 → old re-date to future D2 gives `awaiting_after` = start of D2+1 (UTC), not D0+1+(D2−D1). F3 case: an old route+date-to-future edit on a logged flight with `arrival_transit = 1` succeeds, ends `upcoming` with transit NULL, and the outcome is the same if the trigger order is reversed. F2: an old edit followed by an old repair leaves the stamp stale, `/api/me/derived-state` reports it not ready, and the first new sync repairs and drops the stale suppression. I1: with a stale stamp and `revision = published_revision`, both the maintenance repair and the owner sync's inline repair run the full publish (no early `ready`), rewrite `country_evidence_suppressions` and `country_visit_evidence`, set `evidence_revision = R` with `published_revision` still R, and a second maintenance pass selects no user and reports success. | T07 |
| A3 | Concurrent same-operation and different-operation confirms. Exact replay after commit and after the rolled-back path. Committed-but-pending, then a replay. | T09 |
| A4 | Two-tab conversion with different keys yields exactly one flight. Replay after 8 and after 36 days. `410` tombstone after the flight is deleted. | T10 |
| A5 | Explicit transit, then each of: adding an ambiguous leg, deleting the matched leg, adding an unrelated leg D. The hub stamp neither reappears from A nor from the stored leg, and never moves (see open item 7 for D). | T08 |
| A6 | DST-midnight zones (America/Santiago, America/Havana), ±14h, UTC; multi-week missed-cron catch-up; the 7-day boundary ±1 ms. | T07/T09 |
| A7 | Overview, Passport and the queue agree before and after confirm and during a pending repair. After an old edit and old repair leave the evidence stamp stale (A2 F2), Overview returns `updating` until the repair publishes. | T08/T09 |
| A8 | `newlyStampedCountries` with a concurrent claim and a stale published projection. | T09 |
| A9 | A Next-only session (no `apps/web`) moves flights to `awaiting` and auto-confirms with the cron held, through the R1 trigger. | T09 |
| A10 | A job write after cancel, discard or account deletion matches nothing. Under option (a), DO keep-alive after client disconnect. | T10/T11 |

**Release gate:** remote-D1 A1 (trigger creation through `wrangler d1 migrations apply`, `RAISE(ABORT)` batch rollback, and `meta.changes` with adapter writes) must be run against an isolated remote D1 before `0006` reaches production. Miniflare proves it locally only.

## Open items

1. **H5 runtime (§9): decided.** The owner chose option (a) on 2026-10-05: a local DO with a Miniflare proof in `workers/import`. Production binding and wiring are handed to the architecture owner. Without them the runtime falls back to (c) with no rework.
2. **D1 support for triggers and the migration assertion table** is assumed and proven by A1. If triggers fail, the invariants become application-only and old-writer adaptation is lost. The deploy order would then need a short write hold, which is an owner decision.
3. **Migration ledger:** confirm `0006`/`0007` with the architecture owner before T07.
4. **DO compatibility date and keep-alive** (C5 citation) are unverified and must be proven in T11.
5. **Production enablement** of the cron and the job bindings stays in the architecture release procedure.
6. **Transit-only production estimate:** `docs/research/2026-10-05-transit-validation-proposal.md`. It runs only with authorization.
7. **Review test 5, the "add D" case: resolved by controller ruling (fix round 2).** An unrelated later departure D from the hub country may count that country. A's suppressed evidence (its destination and the stored `arrival_transit_leg_id` origin) never reappears or moves. A5 tests exactly this.
8. **The Overview `'all'` period now includes legacy evidence** (§4). The figure can rise for accounts with legacy-only countries. W4 labels it accordingly.
