# Ground journey storage: proposed technical contract

Date: 2026-10-13. Source HEAD observed: `c6cfd1bd` (advanced during triage).
Research only: no application changes, migration execution, tests or remote writes.
The owner accepted completed-to-planned and cancelled-to-planned reversal.
Research proposals below are inputs; the parent's [final contract](./storage-contract.md)
owns the chosen separate journey counter, live/tombstone constraints,
37-day receipts, account-lifetime deleted-ID marks and JSON export.

## Current facts and integration seams

- Manual `ground_visits` have owner/country/nullable year, but no journey link.
  Keep them intact. Country projection has `ground_visit_count`; pressed status
  supports unknown dates without synthetic timestamps.
  [schema](../../db/migrations/0001_init.sql), [projection](../../db/migrations/0006_flight_lifecycle.sql).
- `countryEvidenceRead` currently groups all manual ground rows by country.
  Extend its canonical batch with confirmed countries joined to completed journeys;
  combine counts in the pure policy, without altering flight transit suppressions.
  [policy](../../functions/api/_services/countryEvidence.ts).
- `ground_visit_count` may aggregate manual and journey support; Passport detail
  needs distinct rail/road contribution DTOs with journey IDs, not manual-visit IDs.
  Preserve existing first/last flight evidence semantics until explicitly extended.
  [Passport](../../functions/api/_services/passport.ts).
- Flight `countries_count`, Overview and leaderboards intentionally use only flight
  and legacy evidence; adding ground support must not change that input.
  [policy](../../functions/api/_services/countryEvidence.ts), [ADR](../../docs/adr/0001-flight-lifecycle-and-import-drafts.md#4-country-evidence-and-connections-c3).
- Trap: unclaim deletes every manual `ground_visits` row for that owner/country.
  Journey country evidence must live separately so this cannot erase it.
  [unclaim](../../functions/api/passport/claims/[cc]/index.ts).

## Minimum additive tables/DTOs — proposal, not applied SQL

- `ground_journeys`: UUID PK; owner FK; mode `rail|road`; state
  `planned|completed|cancelled`; positive version; nullable start/end dates;
  bounded optional title/note; creation/update and explicit confirmation metadata.
  Add unique `(id,user_id)` for composite child ownership references and list index
  `(user_id,mode,state,start_date,id)`. Unknown start has no year attribution.
- `rail_legs`: UUID, journey/owner composite FK, nonnegative ordinal unique within
  journey; boarding/alighting place snapshots; optional stations/operator/train;
  nullable dated local times, duration and provenance. No road point rows for rail.
- `road_points`: UUID, journey/owner composite FK, ordinal unique within journey,
  place snapshot. Repeated city IDs retain distinct point IDs and order.
  Validate child type against parent mode inside each guarded write, not only DTO.
- `journey_countries`: journey/owner composite FK, ISO-2 country, unique
  `(journey_id,country_code)`; canonical explicitly confirmed support. Completion
  requires reviewed countries; planned/cancelled rows publish none. Validate the
  existing country catalog server-side. Parent decides lifecycle reversal cleanup.
- `manual_places`: UUID/owner composite identity; name and country required;
  optional valid WGS84 coordinates and IANA timezone; source/version metadata.
  Search and writes scope by owner. Same name never auto-merges identities.
- Catalog tables: stable GeoNames ID, country/admin references, locale aliases and
  indexed normalized search keys. Selected places store source/ID plus name,
  country/region, coordinate/timezone snapshots and catalog revision. Preserve
  snapshots on catalog refresh; manual edits also do not silently rewrite journeys.
  Validate owned manual references before private reads. [places contract](./places-contract.md).
- `ground_operation_receipts`: owner/key PK, request digest, journey ID without
  cascading FK, operation kind, expected/result version, deletion outcome, timestamps.
  Include bounded transaction nonce and applied/complete guards for atomic writes.
  Internal receipts never appear in public/ordinary owner journey DTOs.
- Owner DTO: journey identity/mode/state/version/dates; ordered typed children;
  reviewed countries; preserved place snapshots; nullable metrics with coverage and
  provenance; `derived_state/revision`. Strip `user_id`; auth supplies the owner.

## Safe aggregate mutation and lost-response recovery

- Require operation key for create/edit/complete/delete. Normalize and digest the
  full typed command including target, expected version and ordered children.
  Receipt lookup runs before expected-version checks: same digest replays its
  recorded outcome; changed digest returns 409; deleted original returns gone
  for an old save replay, while replay of successful deletion returns deletion ack.
- Existing flight precedent dedupes insert using `changes()` and payload digest;
  import conversion consults tombstones before missing/expired batch checks.
  [creation](../../functions/api/_services/flightCreate.ts), [conversion](../../functions/api/_services/importConversion.ts).
- One D1 batch: insert a new incomplete receipt with fresh nonce; CAS header using
  owner/ID/expected version and immediately preceding receipt insert success;
  immediately mark that nonce's receipt applied only when CAS changed one row.
  Child replacement/deletes/inserts all test that same applied incomplete receipt,
  nonce, owner and mode. Finalize receipt with a CHECK requiring applied=1, then
  dirty the owner. A zero-row CAS must fail finalization and roll back everything.
- Do not carry `changes()` blindly through child deletes: an empty child set resets
  it to zero; a successful earlier DELETE can also unlock an unrelated write.
  Use the transaction-owned receipt predicate throughout the variable child set.
  A replay inserts no new receipt, so CAS/children/finalization/dirty are all inert.
- Re-read receipt after the batch to classify a race/lost acknowledgement. On a CAS
  conflict return 409 plus current owner DTO; no partial receipt may commit. Assert
  that the transaction's expected receipt reached complete before treating success.
  This guard design needs focused D1 regression proof during implementation.
- Owner operation-status lookup returns saved version/deleted/gone/unknown without
  exposing other owners. An expired receipt cannot guarantee replay: return
  explicit unknown; client reconciles by immutable journey ID instead of silently
  retrying as a fresh create. Proposed UUID creation IDs must never be resurrected.
- Keep deletion tombstones for journey IDs independently of short operation receipts
  if lifetime nonresurrection is promised. Receipt retention alone only bounds replay.
- Propose receipts 37 days from creation, aligning import conversion; existing
  flight keys retain 7 days, lifecycle receipts 14, conversion receipts 37.
  This is a technical proposal, not an existing universal retry guarantee.
  [maintenance](../../workers/maintenance/index.ts).
- Canonical save + dirty mark are atomic; projection repair runs afterward. Failed
  publication returns saved with `derived_state:pending`; client polls status rather
  than replaying save. Repair's revision/zero-row guards protect publication.
  [derived state](../../functions/api/_services/derivedState.ts).

## Account scope and remaining design choices

- Explicit account deletion must add receipts/tombstones, journey countries,
  rail legs/road points, journeys, then manual places before user deletion, in its
  existing single batch. Keep global catalog. Do not rely only on FK cascades.
  [account deletion](../../functions/api/_lib/users.ts), [schema warning](../../db/migrations/0001_init.sql).
- Existing export covers flights, claims and manual ground CSV only; add full owner
  journey/child/country/place export and delete-preview counts, including plans and
  cancelled records. Preserve auth-generation/abort guards and unknown values.
  [export](../../apps/next/src/client/account/settings-data.ts), [delete UI](../../apps/next/src/client/account/settings-delete.tsx).
- Parent can settle caps, table/DTO names, receipt retention and snapshot indexes.
  Product decisions remain lifecycle reversals and completed-route country recheck;
  export representation and tombstone retention need an explicit technical choice.
