# ADR 0001: Flight lifecycle, country evidence and import drafts

- **Status:** Accepted for implementation, 2026-10-05. One item (§9, H5 runtime) is an open owner decision.
- **Scope:** Binding spec for W3 (T07–T11) of [Redesign 2.0](../plans/2026-10-04-redesign-2.0-implementation.md). Resolves contracts C2–C5 under Addendum A (A1, A2, A6).
- **Vocabulary:** [GLOSSARY.md](../../GLOSSARY.md), "Flight lifecycle & evidence vocabulary".

## Context

The current schema has one lifecycle flag. `flights.is_upcoming INTEGER NOT NULL DEFAULT 0` (`db/migrations/0001_init.sql:129`) is set at create from the UTC calendar day (`functions/api/flights/index.ts:29-32`). On edit it is recomputed only when the patch carries a date (`functions/api/flights/[id].ts:75-76`). Two writers clear it with `date <= today` (UTC): the owner sync (`functions/api/flights/sync-upcoming.ts:15-18`) and the cron (`workers/maintenance/index.ts:20-45`). So a same-day upcoming flight becomes completed on its own departure day, and nothing records how a flight became completed.

Derived data is revision-published. Each canonical mutation adds `dirtyUserStatement` to its D1 batch (`functions/api/_services/derivedState.ts:47-61`). `repairUserDerivedState` reads every canonical source in one batch and publishes `visits`, `user_stats`, `user_advanced_stats` and badges in a second batch. That second batch is guarded by a CHECK violation that rolls it back if a newer revision exists (`derivedState.ts:170-224`, schema `0003_derived_recovery.sql:2-12`). `visits` is an airport aggregate built from both endpoints of every non-upcoming flight, max-merged with contributing `legacy_visit_evidence` (`derivedState.ts:63-132`). Countries are also read from it: `countries_count` and `continents_count` (`functions/api/_services/stats.ts:151-152`), the passport endpoints (`functions/api/passport/countries/index.ts:11-26`, `countries/[cc]/stats.ts:21-27`) and `apps/next/src/server/passport.ts`. Claims and ground visits mark the user dirty, but they feed no derived table today.

Create replay uses `flight_idempotency` (`0003:18-26`). Its rows are written in the same batch as the flight using a `changes()` chain (`flights/index.ts:99-132`) and purged after 7 days (`workers/maintenance/index.ts:56-63`). The client stops retrying after 6 days (`apps/web/src/lib/flightCreateOperations.ts:9`). Import makes one synchronous `generateContent` call (`functions/api/import/parse.ts:112`) and returns `raw_text` to the browser (`parse.ts:241`). Review drafts live only in `localStorage` (`apps/next/src/client/capture/drafts.ts:9-13`: 10 drafts, 100 rows, 30 days). `apps/next/wrangler.toml` binds only D1, with no Durable Object, Queue or Workflow (A2/H5). Both checked-in maintenance configs set `MAINTENANCE_MODE = "true"` (`workers/maintenance/wrangler.toml:9,25`). The release-candidate runbook (gate 6) defers lifecycle, transit, auto-confirm and undo to this work.

## Decision

### 1. Lifecycle columns (migration `0006_flight_lifecycle.sql`)

Columns are added with `ALTER TABLE flights ADD COLUMN`. The table is not rebuilt. A rebuild would have to carry `sqlite_sequence` forward: a reused deleted `id` would turn a `flight_idempotency` tombstone (`flight_id` of a deleted flight, `flights/index.ts:158-160`) into a replay of an unrelated flight.

| Column | Type / constraint | Default | Meaning |
|---|---|---|---|
| `lifecycle_state` | `TEXT NOT NULL CHECK (lifecycle_state IN ('upcoming','awaiting','logged'))` | `'logged'` | Canonical state. Never `draft`. |
| `confirmation_source` | `TEXT CHECK (confirmation_source IS NULL OR confirmation_source IN ('save','user','automatic','legacy'))` | NULL | Non-null exactly when `logged`. |
| `confirmed_at` | `TEXT` (canonical ISO UTC, `_lib/time.ts`) | NULL | Set for `save`/`user`/`automatic`. NULL for `legacy`. |
| `lifecycle_timezone` | `TEXT CHECK (lifecycle_timezone IS NULL OR length(lifecycle_timezone) BETWEEN 1 AND 64)` | NULL | Captured IANA zone. Required when `upcoming`/`awaiting`. |
| `awaiting_after` | `TEXT` (ISO UTC) | NULL | Start of local day `date + 1` in `lifecycle_timezone`. Required when `upcoming`/`awaiting`. |
| `auto_confirm_after` | `TEXT` (ISO UTC) | NULL | Start of local day `date + 8`, i.e. 7 calendar days after `awaiting_after`. Required when `upcoming`/`awaiting`. |
| `arrival_transit` | `INTEGER CHECK (arrival_transit IS NULL OR arrival_transit IN (0,1))` | NULL | NULL means no decision yet. 1 means transit (no country evidence at the destination). 0 means the member left the airport. |
| `is_upcoming` (existing) | unchanged | | Compatibility projection: `1` iff `lifecycle_state = 'upcoming'`. |

Cross-column invariants are enforced by `BEFORE INSERT` and `BEFORE UPDATE OF lifecycle_state, is_upcoming, confirmation_source, confirmed_at, lifecycle_timezone, awaiting_after, auto_confirm_after` triggers that `RAISE(ABORT, 'LIFECYCLE_INVARIANT')` unless all of these hold:

- `is_upcoming = (lifecycle_state = 'upcoming')`.
- `(confirmation_source IS NOT NULL) = (lifecycle_state = 'logged')`.
- `confirmed_at IS NULL OR lifecycle_state = 'logged'`.
- When `lifecycle_state IN ('upcoming','awaiting')`: `lifecycle_timezone`, `awaiting_after` and `auto_confirm_after` are not null.

Triggers are used because SQLite cannot add a table-level CHECK without a rebuild. They also fail closed against pre-lifecycle writers (§10): an old create of a future flight, the old sync and the old cron all violate the first two invariants.

Indexes:

- `idx_flights_user_lifecycle ON flights(user_id, lifecycle_state, date)`.
- `idx_flights_due_upcoming ON flights(awaiting_after, id) WHERE lifecycle_state = 'upcoming'`.
- `idx_flights_due_awaiting ON flights(auto_confirm_after, id) WHERE lifecycle_state = 'awaiting'`.

`FLIGHT_COLUMNS` (`flights/index.ts:24-27`), `FlightRow` and `toOwnFlight` (`_lib/flights.ts`) gain the lifecycle fields additively. `is_upcoming` stays in every DTO.

**Calendar rule.** A new pure helper (`packages/shared/src/calendar.ts`) does all date-only arithmetic. `date` stays a `YYYY-MM-DD` label and is never passed to `new Date(date)` for presentation.

- `localToday(tz, now)` returns the calendar date at `now` in `tz`.
- `startOfLocalDay(dateLabel, tz)` returns the UTC instant of local 00:00. If local midnight does not exist (DST gap), it returns the first existing instant after it. If midnight is ambiguous, it returns the earlier instant.
- Day arithmetic works on labels (`addDays('2026-03-28', 1)`). It never adds 24 hours.
- Tests cover DST at midnight, ±14h offsets, `UTC` and month/year rollover.

**Time zone capture.** Create, bulk create, draft conversion and date edits accept an optional `timezone` request field. It is validated with `Intl.DateTimeFormat(undefined, { timeZone })` and canonicalized via `resolvedOptions().timeZone`. If it is missing, an edit falls back to the flight's stored zone and everything else falls back to `UTC` (old clients). An invalid value returns `400 INVALID_TIMEZONE`. `timezone` is request context, not part of `FlightInput`. It is excluded from `digestInput` (`flights/index.ts:38-41`), so replays that were stored before the deploy keep their digest. Deadlines are computed once, at create or date edit. Transitions compare `now` with the stored instants and never with the time a transition ran. A late sync or a missed cron day never restarts the clock. Countdown labels use the viewer's locale and zone; eligibility does not.

### 2. Transition table

`today` means `localToday(capturedTz, now)`. "Recompute" means recomputing `awaiting_after` and `auto_confirm_after` from `date` and the zone.

| Operation | From | Result |
|---|---|---|
| Create / bulk create / draft conversion, `date <= today` | none | `logged`, `save`, `confirmed_at = now`. Deadlines NULL. `arrival_transit` NULL (existing endpoint policy, §3). Response lists newly pressed countries after publication. |
| Same, `date > today` | none | `upcoming`. Deadlines computed. No completed totals, visits or stamps. |
| Owner sync (`POST /api/flights/sync-upcoming`) or cron, `now >= awaiting_after` | `upcoming` | `awaiting`. Counts in completed totals and airport visits. Its countries are pending unless pressed elsewhere. |
| Same pass, `now >= auto_confirm_after` | `awaiting` | `logged`, `automatic`. `arrival_transit` set to the effective policy (§3). No animation. A flight past both deadlines makes both moves in one pass. |
| `POST /api/flights/confirm` | `awaiting` | `logged`, `user`, `confirmed_at = now`. `arrival_transit` = submitted value, else the effective default. Always written as 0/1. |
| Edit `date` to future | `upcoming`/`awaiting`/`logged` | `upcoming`. Clears `confirmation_source`, `confirmed_at` and `arrival_transit`. Recompute. |
| Edit `date` to today/past | `upcoming` | `awaiting` if `now >= awaiting_after` after recompute, else stays `upcoming`. A corrected upcoming flight never skips the queue (gap in C2, §11). |
| Edit `date` to today/past | `awaiting` | Stays `awaiting`. Recompute from the corrected date, never from the edit time. "Changed" does not answer the arrival question. |
| Edit `date` to today/past | `logged` | Stays `logged`. Provenance kept. Deadlines untouched. |
| Edit `origin`/`destination` | any | Lifecycle unchanged. `arrival_transit` reset to NULL, because the decision referred to the old airport. |
| Other field edits | any | Lifecycle and decision unchanged. |
| Delete / bulk delete | any | Row removed as today. "Did not fly" is client-only: the card hides, then the existing `DELETE /api/flights/:id` is sent after a 6 s undo window. Closing before submission leaves the flight `awaiting`. There is no server-side "did not fly" state. |
| Transit review apply (§4) | `logged` with `confirmation_source IN ('legacy','save')` | `arrival_transit = 1` on the selected flights. Lifecycle and provenance unchanged. |

Owner sync and cron share one domain function: `applyDueTransitions(db, { userId?, now, limits })` in `functions/api/_services/lifecycle.ts`. Its updates are guarded by the source state and the deadline (`WHERE lifecycle_state = 'awaiting' AND auto_confirm_after <= ?`) and batched with `dirtyUserStatement(..., true)`, the same pattern as `workers/maintenance/index.ts:36-42`. A concurrent winner therefore makes the loser a no-op. Sync keeps its response shape `{ synced, ...derived }`: `synced` counts flights moved, and the response adds `awaited` and `autoConfirmed`.

### 3. Historical backfill (inside `0006`)

```sql
-- after ADD COLUMN (all rows default 'logged'), before triggers are created
UPDATE flights SET confirmation_source = 'legacy' WHERE is_upcoming = 0;
UPDATE flights SET lifecycle_state = 'upcoming', lifecycle_timezone = 'UTC',
  awaiting_after     = strftime('%Y-%m-%dT%H:%M:%fZ', date, '+1 day'),
  auto_confirm_after = strftime('%Y-%m-%dT%H:%M:%fZ', date, '+8 days')
WHERE is_upcoming = 1;
```

- Old non-upcoming flights become `logged`/`legacy` with `arrival_transit` NULL. Their effective policy includes both endpoints, as today, so no stamp changes. IDs, `flight_idempotency`, claims, ground visits, `legacy_visit_evidence`, `visits` and `user_stats` are not touched.
- Old upcoming flights keep `upcoming` with UTC deadlines, which is the zone the old system used. Overdue ones go through the ordinary transitions. A flight more than 7 days past its date makes both moves in one pass and lands as `automatic`. Only flights within their 7-day window enter the queue, and those are genuinely unconfirmed recent flights. No historical *logged* flight ever becomes `awaiting`.
- `0006` seeds `country_visit_evidence` (§4) from the published `visits`, `country_claims` and `ground_visits`. The seed equals what a repair produces when there are no awaiting flights and no transit decisions, so the migration needs **no** mass dirty mark. A mass mark (as in `0003:14-16`) would leave every account "updating" until it mutates while production cron is held. Accounts that were already dirty repair as usual.
- Acceptance (T07): apply `0001`–`0005` to Miniflare D1, then load the fixture: upcoming-past, upcoming-future, upcoming beyond 7 days, completed, legacy-evidence-only, claim-only, a ground visit, a deleted-flight idempotency tombstone and an already-dirty account. Then apply `0006`. Assert identical `flights.id`, `visits`, `user_stats.countries_count`, claims and badges, and the expected lifecycle per row. The triggers must reject the old sync statement and an old-style insert. A fresh-database test alone does not count.

### 4. Country evidence and connections (C3)

**Projection.** `visits` stays the airport aggregate with both endpoints of every non-upcoming flight, so airport counts keep their meaning. `0006` adds:

| Column | Type / constraint |
|---|---|
| `user_id` | `TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE` |
| `country_code` | `TEXT NOT NULL` (ISO-2) |
| `status` | `TEXT NOT NULL CHECK (status IN ('pressed','pending'))` |
| `logged_visit_count` | `INTEGER NOT NULL DEFAULT 0 CHECK (logged_visit_count >= 0)`: Σ airport visit counts of country-contributing endpoints of logged flights, max-merged with legacy evidence exactly as `derivedState.ts:109-130` |
| `awaiting_visit_count` | `INTEGER NOT NULL DEFAULT 0 CHECK (awaiting_visit_count >= 0)` |
| `claimed` | `INTEGER NOT NULL DEFAULT 0 CHECK (claimed IN (0,1))` |
| `ground_visit_count` | `INTEGER NOT NULL DEFAULT 0 CHECK (ground_visit_count >= 0)` |
| `first_visit`, `last_visit` | `TEXT` (`YYYY-MM-DD`; NULL when only claim/ground evidence) |
| `policy_version` | `INTEGER NOT NULL DEFAULT 1` |
| key / index | `PRIMARY KEY (user_id, country_code)`; `idx_country_evidence_user_status ON (user_id, status)` |

A row exists only when at least one count or `claimed` is positive. `status = 'pressed'` iff `logged_visit_count > 0 OR claimed = 1 OR ground_visit_count > 0`. Otherwise the status is `pending` (awaiting-only).

**Publish flow.** `repairUserDerivedState` adds one batched read to its existing `combineReads` round trip. The read covers lifecycle and time columns of the user's flights (including upcoming flights as potential outgoing legs), claims and ground visits. A pure `deriveCountryEvidence` (`functions/api/_services/countryEvidence.ts`) and a pure `connectionChains` (`_services/connections.ts`) compute the projection. It is written in the same guarded publish batch with the diff-upsert pattern of `visitStatements` (`derivedState.ts:145-168`): delete stale countries, then upsert changed rows. All consumers read only the published projection: passport list and detail, `apps/next/src/server/passport.ts`, `_services/overview.ts`, `me/dashboard-stats.ts` and advanced-stats region breakdowns.

- `user_stats.countries_count` counts rows with `logged_visit_count + awaiting_visit_count > 0`. These are flight and legacy countries after transit policy, without claims or ground visits, which is today's meaning. The leaderboard `countries` category, its 5-flight eligibility and `cities` → `airports_count` stay unchanged (`_services/leaderboard.ts:18-24,58`).
- The passport collection count (pressed, including claims and ground visits) and `pendingCountryCount` are separate DTO fields with distinct labels.
- `continents_count` and continent badges keep `continentOf7` (`_lib/continents.ts:25-34`, `stats.ts:224`) over the same flight country set, as versioned `badge-continents-v1`. Badges stay award-only (`stats.ts:186-233`), so suppression never revokes an award. The six-region collection model (catalog `continent`: africa 58, americas 54, asia 52, europe 51, oceania 28, antarctica 3; 246 total) is used for Overview, Passport, profile and geographic progress. `functions/` cannot import `@kuuki/data` today, so T08 generates a checked-in country→region map from `packages/data/src/countries.json` with a parity test.

**Connection chains** (deterministic, no trips entity):

1. Legs are the user's flights, sorted by `departure_utc` when present, otherwise by `date`, with `id` as the stable tiebreak.
2. A *precise* link A→B needs `A.destination = B.origin`, both `A.arrival_utc` and `B.departure_utc` present, and `0 <= B.departure_utc - A.arrival_utc <= 24h`.
3. An *estimated* link has the same airport, at least one instant missing, and `B.date ∈ {A.date, A.date + 1 day}`.
4. For incoming leg A, if one or more precise candidates exist, exactly one must exist. Otherwise exactly one estimated candidate must exist. B must also be the unique incoming candidate under the same rule. Anything else is *ambiguous*: shown for review only, never suppressed automatically.
5. A maximal chain of unambiguous links has a start country (first origin) and a final country (last destination). A connection endpoint whose country equals either of them is not a third-country candidate.

**Effective arrival policy** for flight F's destination, used identically by queue DTOs, the projection, Overview/Passport, auto-confirm and cleanup:

1. `arrival_transit` not NULL: use it.
2. Otherwise, if F is `awaiting`: transit if F has an unambiguous outgoing link (precise or estimated; estimated is labelled) whose hub is a third-country candidate. Otherwise include.
3. Otherwise (logged `legacy`/`save`, or a changed route): include. This is the existing endpoint policy. No prospective default reclassifies history.

When F's effective policy is transit, the hub country gets no country evidence from F's destination **or** from the matched outgoing leg's origin (whatever that leg's state). Airport evidence keeps both endpoints. A country supported by any other flight, legacy row, claim or ground visit stays. «Выходил в город» (`arrival_transit = 0`) includes the hub, as pending or pressed according to lifecycle.

Period-scoped reads (`_services/overview.ts:56-57,85-114` counts countries straight from flight endpoints, not from `visits`) need the suppressed endpoints in SQL. The same publish batch therefore writes `country_evidence_suppressions`:

- columns: `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `flight_id INTEGER NOT NULL`, `endpoint TEXT NOT NULL CHECK (endpoint IN ('origin','destination'))`, `country_code TEXT NOT NULL`;
- key: `PRIMARY KEY (user_id, flight_id, endpoint)`.

It holds only suppressed endpoints, so it stays small. Period queries anti-join it. `0006` creates it empty, because no transit decisions exist at migration time.

### 5. Queue, confirmation and transit cleanup (C4)

`0006` adds two tables:

| Table | Columns / constraints |
|---|---|
| `lifecycle_operation_receipts` | `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `operation_id TEXT NOT NULL CHECK (length(operation_id) BETWEEN 8 AND 128)`, `kind TEXT NOT NULL CHECK (kind IN ('confirm','transit_review'))`, `request_digest TEXT NOT NULL`, `batch_nonce TEXT NOT NULL`, `expected_count INTEGER NOT NULL`, `applied_count INTEGER CHECK (applied_count IS NULL OR applied_count = expected_count)`, `pressed_before_json TEXT NOT NULL`, `result_json TEXT`, `created_at TEXT NOT NULL`. `PRIMARY KEY (user_id, operation_id)`; `idx_lifecycle_receipts_created ON (created_at)` |
| `transit_cleanup_markers` | `user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`, `status TEXT NOT NULL CHECK (status IN ('dismissed','completed'))`, `candidate_revision TEXT NOT NULL`, `updated_at TEXT NOT NULL` |

Endpoints are owner-scoped. Writes require CSRF. They are composed through `apps/next/api-capture.ts` and the generated route table (A1).

- **`GET /api/me/awaiting`** has no side effects. It returns:
  - awaiting flights, each with its candidate link, label (`precise`/`estimated`/`ambiguous`) and effective default;
  - `candidateRevision`;
  - unresolved server draft summaries;
  - `awaitingFlightCount`, `draftRowCount` (server `import_drafts` with `status = 'review'` in unexpired batches) and `actionableCount = awaitingFlightCount + draftRowCount`;
  - `derivedState` and `revision`.

  A transport failure is an error, never an empty queue. Browser-local legacy drafts (`drafts.ts`) are not counted. They remain readable locally until their own 30-day expiry and are not uploaded.
- **`candidateRevision`** is the SHA-256 of the canonical JSON of `[flightId, lifecycle_state, date, origin, destination, linkedLegId, label, effectiveDefault]` over the owner's awaiting flights and their linked legs. It is deliberately not `user_derived_state.revision`, which unrelated claims and edits also bump.
- **`POST /api/flights/confirm`** takes `{operationId, candidateRevision, timezone?, items:[{flightId, arrivalTransit?}]}`, with 1–100 unique items.
  - Validation is all-or-nothing: an unknown or foreign ID returns `404 NOT_FOUND` for the whole request, and nothing is disclosed. A non-awaiting item returns `409 STATE_CONFLICT` with a per-item `cause` (`logged`/`upcoming`). A recomputed revision that differs returns `409 CANDIDATES_CHANGED`, and the client refetches.
  - Before the commit, pressed countries are read from the published projection into `pressed_before_json`.
  - One D1 batch then: inserts the receipt (`ON CONFLICT DO NOTHING`, fresh `batch_nonce`); runs one guarded `UPDATE flights ... WHERE user_id = ? AND id = ? AND lifecycle_state = 'awaiting' AND EXISTS (receipt with this batch_nonce)` per item; sets `applied_count` to the number of rows now `logged` and `user` with this `confirmed_at`, where a mismatch violates the CHECK and rolls back the whole batch (the `derivedState.ts:205-211` technique); and adds `dirtyUserStatement`. A replay carries a different nonce, so its updates are no-ops.
  - Afterwards, the receipt digest is compared with the request digest: a mismatch returns `409 IDEMPOTENCY_CONFLICT`, and a match returns the replay.
  - Repair then runs. On success, `result_json = {results, newlyStampedCountries (pressed after − pressed_before), pendingCountryCount}` is stored once and returned with `derivedState: 'ready'` and `revision`. If repair fails, the response is `200` with `derivedState: 'pending'` and `newlyStampedCountries: null`. That is committed-but-pending: the UI shows "finishing save", polls publication and never re-submits the canonical mutation. A replay after publication computes and freezes `result_json` once, then returns it verbatim.
  - Receipts are kept 14 days. The supported client replay interval is 6 days, the same as create operations.
- **`GET /api/me/transit-review`** has no side effects. It returns candidates among logged `legacy`/`save` flights with `arrival_transit` NULL and an unambiguous third-country link, with estimate labels, `wouldRemoveStamp` per country (false when the country is supported elsewhere), `candidateRevision` and the marker status.
- **`POST /api/me/transit-review`** takes `{operationId, candidateRevision, action: 'apply'|'dismiss', flightIds?}`. It uses the same receipt, nonce and all-or-nothing rules. `apply` sets `arrival_transit = 1` on the selected flights, upserts the marker as `completed`, repairs and returns the actual `removedCountries`. `dismiss` writes only the marker. The banner shows only when candidates exist and no marker does. The GET stays reachable from Passport.

### 6. Import drafts (migration `0007_import_drafts.sql`)

| Table | Columns / constraints |
|---|---|
| `import_batches` | `id TEXT PRIMARY KEY` (UUID); `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`; `source_type TEXT NOT NULL CHECK (source_type IN ('pdf','image','text'))`; `source_label TEXT CHECK (source_label IS NULL OR length(source_label) <= 120)` (sanitized base filename or a fixed text label, never content); `status TEXT NOT NULL CHECK (status IN ('processing','review','partial','failed','cancelled','completed'))`; `stage TEXT CHECK (stage IS NULL OR stage IN ('accepted','recognizing','validating','review_ready'))`; `sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0)` (monotonic event/revision); `generation INTEGER NOT NULL DEFAULT 1` (job lease fence); `submission_operation_id TEXT NOT NULL`; `error_code TEXT`; `retry_after TEXT`; `processing_deadline TEXT`; `created_at`, `updated_at`, `expires_at TEXT NOT NULL` (`created_at + 30 days`). `UNIQUE (user_id, submission_operation_id)`; `idx_import_batches_user ON (user_id, status, created_at)`; `idx_import_batches_expiry ON (expires_at)` |
| `import_drafts` | `id TEXT PRIMARY KEY` (immutable UUID); `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`; `batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE`; `ordinal INTEGER NOT NULL CHECK (ordinal >= 0)`; `fields_json TEXT NOT NULL CHECK (length(fields_json) <= 2048)` (ExtractedFlight fields only); `confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1)`; `field_confidence_json TEXT CHECK (field_confidence_json IS NULL OR length(field_confidence_json) <= 1024)`; `year_explicit`, `year_confirmed`, `selected`, `edited`, `duplicate_acknowledged` `INTEGER NOT NULL DEFAULT 0 CHECK (… IN (0,1))`; `status TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('review','dismissed','converted'))`; `version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)`; `converted_flight_id INTEGER`; `created_at`, `updated_at`. `UNIQUE (batch_id, ordinal)`; `idx_import_drafts_user_status ON (user_id, status)` |
| `import_conversion_receipts` | `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`; `operation_key TEXT NOT NULL`; `draft_id TEXT NOT NULL`; `batch_id TEXT NOT NULL`; `request_digest TEXT NOT NULL`; `flight_id INTEGER NOT NULL`; `created_at TEXT NOT NULL`. `PRIMARY KEY (user_id, operation_key)`; `UNIQUE (user_id, draft_id)`; `idx_import_conversion_receipts_created ON (created_at)`. No FK to drafts, batches or flights, so receipts outlive them as tombstones. |

- **Limits.** A batch holds at most 100 drafts (the current `MAX_DRAFT_ROWS`). An owner may have 10 unexpired batches and 1 batch in `processing`. Invalid references stay correctable drafts and never enter `flights`.
- **Never persisted.** Uploaded bytes, base64, pasted text, provider responses and `raw_text` are never written to D1, DO storage, queues, R2, logs or browser storage. The job path drops `raw_text` at normalization. No snippet is stored until a verified parser field exists.
- **Shared bulk-create service.** `createFlightStatements` and the result reconciliation move from `flights/bulk.ts:40-77` into `functions/api/_services/flightCreate.ts` as `bulkCreate(db, userId, items, {timezone, conversion?})`. `/flights/bulk` and draft confirmation both call it. There is no internal HTTP round trip and no second validation path (`parseFlightBodies`, `_lib/flightValidation.ts:26-51`).
- **Draft conversion.** `POST /api/import/batches/:id/confirm` takes `{timezone?, items:[{draftId, version, key}]}`, with at most `FLIGHT_BULK_CREATE_MAX` (50) items. The batch must be unexpired. Each key is used as the `flight_idempotency` key.
  - In the same batch as the flight: `INSERT INTO import_conversion_receipts ... SELECT ... FROM flight_idempotency WHERE key = ? AND flight_id IS NOT NULL ON CONFLICT DO NOTHING`, plus `UPDATE import_drafts SET status = 'converted', converted_flight_id = ..., version = version + 1 WHERE id = ? AND version = ? AND status = 'review'`.
  - Before creating, the service checks the conversion receipt. A matching digest replays. A deleted flight returns `410 CONVERTED_FLIGHT_DELETED` and is never recreated. A differing digest returns `409`.
  - Receipts are kept **37 days** from creation: the 30-day draft lifetime, plus the 6-day client retry window, plus a 1-day margin. That outlives the 7-day `flight_idempotency` purge.
  - Lifecycle per row follows the create rows of §2.
- **`PATCH /api/import/drafts/:id`** is version-checked: `409 DRAFT_VERSION_CONFLICT` when the version is stale or the draft is already converted.
- **Duplicate matching** runs against the full owned history at batch read and confirm, using the `duplicate-candidates.ts` json_each tuple query (`date`, `origin`, `destination`, excluding `converted_flight_id`). It is never computed from client pages.
- **Expiry.** Expired batches cannot convert. Cleanup (§8) deletes drafts at `expires_at` and batch rows 7 days later, which equals the 37-day receipt horizon.
- **Account deletion.** `deleteUserCascade` (`functions/api/_lib/users.ts:72-96`) adds `import_conversion_receipts`, `import_drafts`, `import_batches`, `lifecycle_operation_receipts`, `transit_cleanup_markers`, `country_evidence_suppressions` and `country_visit_evidence` ahead of `flights`, in the same atomic batch. There is no reliance on the FK cascade.
- **Deletion fence.** Every job write is `INSERT … SELECT … WHERE EXISTS (SELECT 1 FROM import_batches WHERE id = ? AND user_id = ? AND status = 'processing' AND generation = ?)`. After cancel, discard (`DELETE`) or account deletion, late writes match nothing. Discard deletes the batch row, so a later callback cannot resurrect it.

### 7. Migration numbering

The next free numbers are confirmed from `db/migrations` (latest `0005_profiles_created_at.sql`): **`0006_flight_lifecycle.sql`** (lifecycle columns, triggers, backfill, `country_visit_evidence` plus seed, `country_evidence_suppressions`, `lifecycle_operation_receipts`, `transit_cleanup_markers`) and **`0007_import_drafts.sql`**. Both are additive (no DROP, no rename) and ship as separate files so deployment can be sequenced. Numbering is rechecked against the architecture migration ledger (H5) before T07 lands.

### 8. Maintenance ordering (T09)

The order in `workers/maintenance/index.ts`:

1. `MAINTENANCE_MODE === 'true'` → return before any DB access (unchanged, line 15).
2. `applyDueTransitions` upcoming→awaiting. Up to 50 users per cycle, chosen by oldest `awaiting_after`, and up to 100 flights per user. Each user is one batch with a dirty mark.
3. The same function for awaiting→logged `automatic`, with the same bounds and effective-policy computation.
4. Dirty repair (the existing 100 oldest-first loop, lines 48-54). This publishes steps 2–3.
5. `refreshLeaderboards`.
6. Cleanup of: existing auth/session rows; `flight_idempotency` older than 7 days; `lifecycle_operation_receipts` older than 14 days; `import_drafts` of expired batches; `import_batches` older than `expires_at + 7 days`; `import_conversion_receipts` older than 37 days. Batches in `processing` past `processing_deadline` become `partial` (if they have rows) or `failed` with `JOB_INTERRUPTED`, and `generation` increments.
7. Status update. Remaining dirty users or remaining due transitions make the cycle a retryable failure, as at line 72, never a false success.

Ordering by due instant and capping work per user is the fairness rule. The cursor is the stored deadline itself, so a missed day or a long outage catches up without moving eligibility. The 5-minute cron (`wrangler.toml:6`) bounds the lag. Both checked-in configs keep `MAINTENANCE_MODE = "true"`, and no task flips production. Until the authorized release enables the cron, owner sync (§2) still applies due transitions on visit. T09 delivers preview enablement steps only.

### 9. Recognition job runtime (C5, A6): OPEN owner decision

**Target design**, used if the binding exists:

- `workers/import/{index.ts, ImportJob.ts, tsconfig.json}`. One Durable Object per batch, named `idFromName(`${userId}:${batchId}`)`, reached only through the same-origin API adapter via a service/DO binding. There is no public endpoint.
- `POST /api/import/jobs` (auth, CSRF, `import-parse` rate limit, `parse.ts:267`): insert the batch (`processing`, `accepted`, idempotent on `submission_operation_id`), then hand the in-memory input to the DO, then respond with `{batchId}`. A duplicate submission returns the same batch and never starts a second provider call.
- The DO runs `generateContentStream` with the unchanged prompt, schema and normalization (extracted from `parse.ts`). A bounded incremental scanner emits only complete `flights[]` objects. Each row is validated and persisted (fenced insert, `sequence + 1`) **before** the notify. The final envelope reconciles ordinals. An invalid tail keeps the valid rows as `partial`.
- `GET /api/import/batches/:id/events?after=N` is SSE carrying `{sequence, rowIds}` only. D1 is authoritative. A sequence gap returns a snapshot instruction. A disconnect only unsubscribes.
- Cancel aborts the provider and increments `generation`. Discard deletes the batch.
- A runtime restart loses the unextracted input. Reconciliation marks the batch interrupted, keeps its rows and asks for a reupload.
- Limits stay as today: 10 MiB file, 14 MiB body, 100,000 characters, 90 s provider timeout (`parse.ts:18-22`, `_provider.ts:6`). Output, events and drafts are bounded.

**Options:**

- (a) T11 builds `workers/import` plus a **local-only** binding and a Miniflare disconnect/interrupt proof. Production wiring (Wrangler, DO migration tag, compatibility date) goes to architecture.
- (b) Wait for the architecture session.
- (c) Narrow T11 to server-persisted drafts over the existing synchronous parse: same tables and API, no SSE, the client polls `GET /api/import/batches/:id`.

**Recommendation: (a).**

- It honours the user-selected streaming scope, which (c) silently drops.
- It does not stall W3 on an unscheduled dependency, which (b) does.
- Everything (c) needs (§6 tables, conversion, the synchronous path kept for old clients) is built in T10 regardless. If architecture declines or delays production wiring, (a) degrades to (c) with no rework.
- Risks: a Durable Object needs its own Worker script and binding, outside the OpenNext bundle. The keep-alive compatibility claim in C5 (Cloudflare changelog 2026-10-01) is unverified here, and the Miniflare proof must establish it.

**This is the owner's decision (A6) and must be recorded before T11 starts.** T07–T10 do not depend on it.

### 10. Rollback floor

Once `0006` has run, the rollback floor is a build of the post-T07 `functions/api` (the lifecycle-aware compatibility writer that dual-writes `is_upcoming`). That applies to both the Next worker and the fallback Pages worker, which share this code (`apps/next/worker.ts:33-47`). The current production Pages and maintenance builds are **below** the floor. If they resume, the §1 triggers make their sync, cron and future-create writes fail with `LIFECYCLE_INVARIANT` instead of corrupting state. That is intended, and rollback procedures must not drop the triggers.

During rollback:

- hold `MAINTENANCE_MODE=true` (no automatic transitions);
- stop new job starts (the DO binding is absent or the jobs route returns 503; the synchronous parse remains);
- keep all additive tables, drafts and receipts;
- let repair reconcile dirty state;
- rely on the `generation`/status fences for cancelled or deleted jobs.

No down-migration exists, and no rollback deletes user data. T07 extends `scripts/rehearse-next-rollback.ts` to a post-`0006` database.

### 11. Conflicts between C2–C5 and the code, and their resolutions

| # | Conflict | Resolution |
|---|---|---|
| 1 | Sync and cron flip on `date <= today` (UTC), so same-day flights complete on departure day (`sync-upcoming.ts:18`, maintenance `:24`). C2: awaiting only from the next local midnight. | Replaced by stored `awaiting_after`. Same-day creates still log directly (`save`). |
| 2 | Create uses UTC "today" (`flights/index.ts:29-32`). | Captured zone; UTC only as the old-client fallback. |
| 3 | An edit without `date` keeps `is_upcoming` (`[id].ts:76`). A date edit has no awaiting concept. | §2 edit rows. Adds the C2-missing "upcoming edited to past → awaiting/upcoming" row. |
| 4 | `digestInput` hashes the full input. Adding `timezone` to it would conflict every pre-deploy replay. | `timezone` is excluded from the digest. |
| 5 | Countries come from `visits` in four consumers, and Overview derives period countries from raw flight endpoints (`overview.ts:56-57`). Suppression must keep airport rows. | `country_visit_evidence` for all-time reads and `country_evidence_suppressions` anti-join for period reads. Every country consumer switches. `visits` is unchanged. |
| 6 | `continents_count` uses the 7-way `continentOf7` (NA/SA split, `OTHER` counts), not the six regions. Badges read it. | Badges and the stat keep `continentOf7` (`badge-continents-v1`). Six regions are a separate collection metric. |
| 7 | Claims and ground visits mark dirty but feed no derived table. | They now feed the projection; the existing marks become meaningful. |
| 8 | C5 status enum has no `interrupted`. | `partial`/`failed` plus `error_code = 'JOB_INTERRUPTED'`. |
| 9 | C4 says "reuse create replay". `flight_idempotency` lives 7 days, but drafts live 30. | Conversion receipts with 37-day retention. Lifecycle receipts get their own table (14 days). |
| 10 | A table rebuild for CHECKs risks `sqlite_sequence` id reuse against tombstones. | `ADD COLUMN` plus triggers (§1). |
| 11 | `parse.ts:241` returns `raw_text` to clients. | The synchronous endpoint keeps it for old clients. Job and draft paths never store it. |
| 12 | A mass dirty mark (the `0003` precedent) would show "updating" for every account while cron is held. | An exact seed of the projection (§3). No mass mark. |

## Consequences

- Most `is_upcoming` readers (overview, dashboard-stats, routes, durations, stats, advanced stats) are correct without change, because `awaiting` projects to `0` and counts as completed, which C2 wants. T07 still audits each reader and switches new code to `lifecycle_state`.
- Old `apps/web` clients keep working. They send no zone (UTC fallback), see awaiting flights as completed and never confirm, and auto-confirm or owner sync resolves those flights.
- Pre-lifecycle writers fail loudly after `0006`. The release order must deploy compatible code with or before the migration (architecture-owned release step).
- Repair does more work per mutation: one more read and a country diff of at most 246 rows.
- Seven new tables are added to the account-deletion cascade.

## Alternatives considered

- **Table rebuild with full CHECKs:** rejected because of id-reuse and FK/rebuild risk on D1 (§11 #10).
- **`user_derived_state.revision` as the candidate revision:** rejected because unrelated mutations would cause spurious conflicts.
- **Per-item partial confirmation:** rejected. All-or-nothing makes replay and the "state conflict" contract unambiguous.
- **Storing contributing flight IDs per country:** rejected. The detail endpoint derives them with the same pure policy at the published revision and returns `derivedState` if a repair is pending.
- **A dedicated `did_not_fly` state:** rejected (C2: a client-deferred delete).
- **Auto-confirm in cron only:** rejected, because production cron is held. Owner sync shares the function.

## Open items

1. **H5 runtime (§9):** owner chooses (a), (b) or (c) before T11. The recommendation is (a).
2. **D1 trigger support in migrations** is assumed. T07's Miniflare upgrade test must prove it. If triggers are unavailable, the invariants become application-only and the rollback floor becomes procedural.
3. **Migration ledger:** confirm `0006`/`0007` with the architecture owner (H5) before T07 writes them.
4. **DO compatibility date and keep-alive behaviour** (C5 citation) are unverified and must be proven in the T11 Miniflare and isolated-environment checks.
5. **Production enablement** of the maintenance cron and of job bindings stays in the architecture release procedure.
6. **Transit-only production estimate:** see `docs/research/2026-10-05-transit-validation-proposal.md`. It runs only with authorization.
