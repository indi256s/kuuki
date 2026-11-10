# ADR 0008: Flighty CSV history import

- **Status:** Accepted for local implementation, 10 November 2026. Remote migration and deployment need separate authorization.
- **Plan:** [Flighty CSV import](../plans/2026-11-10-flighty-csv-import.md), Task 3 decision.
- **Amends:** [ADR 0001 §6](0001-flight-lifecycle-and-import-drafts.md#6-import-drafts-migration-0007_import_draftssql) storage rule for this one source; [ADR 0002](0002-flight-metrics-provenance.md) clock provenance gains explicit instants.
- **Evidence:** [format research](../research/2026-11-10-flighty-csv-format-research.md); read-only dry run `scripts/evaluate-flighty.ts` on the synthetic fixtures in `packages/shared/src/fixtures/flighty/`.

## Context

A Flighty export is one CSV of the owner's whole history. The document import path (ADR 0001 §6) is the wrong container for it: drafts cap at 100 per batch and 10 open batches, `fields_json` at 2 048 characters with a closed field set, `import_batches.source_type` is a CHECK that only a table rebuild could widen, drafts expire after 30 days and conversion receipts after 37. ADR 0001 also forbids persisting source text until a verified parser field exists.

The observed export (profile `flighty-observed-33/v1`) has 33 named columns, ICAO airline designators and airport-local timestamps without offsets. No published Flighty schema exists in the inspected sources, so the profile describes observed files, not a vendor contract.

The dry run settled what the importer must hold. On 10 000 synthetic records, parsing and mapping take about 0.2 s and leave two owner decisions (one summary confirmation and one shared question for a recurring unknown airline code); the hand-labelled fixture reconciles with no missing, extra or mismatched record. Every observed column is either interpreted or preserved.

## Decision

### Parsing and mapping are shared and deterministic

`packages/shared/src/flighty.ts` parses with `csv-parse@7.0.3` (browser ESM build, so neither the browser nor a Worker needs Node compatibility). It maps by header name, keeps every cell verbatim, strips one leading BOM, and rejects the whole file on bad quoting, uneven rows, duplicate or missing required headers, more than 10 000 records, a record over 64 KiB or a file over 10 MiB. Errors name lines, records and headers, never values. No AI is involved.

`mapFlightyRecord` projects one record onto journal fields given caller-supplied catalog lookups (`functions/api/_services/flightyRefs.ts`) and the owner's answers. It resolves ICAO airlines only when exactly one IATA airline carries that code; resolves each timestamp in its airport's historical IANA zone and reports a DST fold or gap instead of choosing; takes clock times from one consistent gate pair (actual first, then scheduled, never mixed, never runway); keeps a diversion's booked and reached airports apart; and turns everything else it cannot establish into an issue. Issues about a recurring short token (`airline:XQZ`, `airport:ZZZ`, `canceled:`) form groups with one answer each. The server maps again on every write; the client's projection is never trusted.

### Two tables: runs and rows

Migration `0020_history_import.sql` adds:

| Table                 | Role                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `history_import_runs` | One upload. Owner, `submission_operation_id` (unique per owner), provider `flighty`, profile, mapper version, headers, the declared chunk manifest and its digest, totals, status `receiving → review → completed`, or `closed` after discard or expiry; `generation` fences late writes, `revision` fences group answers. Staging expires 30 days after creation.                 |
| `history_import_rows` | One per logical record: `UNIQUE (run_id, ordinal)`. Verbatim cells, record digest, opaque Flighty flight ID, a match key (date, route, airline and number tokens), the canonical date and route for duplicate checks, answers, current issues, the server's match finding, action, state, version, the flight link and the confirmation receipt (`operation_key`, request digest). |

The planned chunk and identity tables are not needed. The manifest (count and SHA-256 per chunk) is fixed when the run opens; a chunk is accepted only when its recomputed digest equals the manifest entry, so a replay inserts nothing (`ON CONFLICT (run_id, ordinal) DO NOTHING`) and a changed payload is a conflict. A committed row is itself the durable source identity and, after its flight is deleted, the tombstone. Rows never expire into nothing: the per-run total always equals the sum of row states.

Row states: `ready`, `needs_review`, `error` (an empty record), and after a decision `created`, `duplicate` (the record was already in the journal; linked, nothing written to `flights`), `preserved_only` (a cancellation or other kept record, never a flight), `ignored` (with reason `owner`, `discarded` or `expired`), and `removed` (its flight was deleted).

### Admission and review

All routes live under `/api/import/history`, authenticate before any read, require CSRF on writes, and share a CSV budget separate from the provider quota: 10 new runs and 600 requests per owner per hour, at most 3 open runs. Chunks carry at most 100 records and 256 KiB, and a run at most 200 chunks (10 000 records with long notes split by bytes into more than the 100 a record count needs); a run stores at most 200 × 256 KiB of serialized rows. When the last chunk lands, the same D1 batch classifies the run against the owner's journal and earlier imports and moves it to `review`. If that seal is interrupted, replaying any chunk of the complete run seals it; the seal is fenced on the run still being `receiving`, so racing attempts are harmless.

Matching never treats a fingerprint as a proven identity:

1. **Same file, retried:** the chunk digest and ordinals.
2. **Same record in a new export:** an earlier committed row with the same record digest, matched one to one by multiplicity, is linked automatically (`duplicate`). Only rows that accepted a record (action `create` or `preserve_only`, including `removed` tombstones) count as occurrences; a `duplicate` receipt never adds one, so re-importing a file cannot let a third export link the same record twice. A matching row whose flight was deleted asks whether to add it again.
3. **Changed record:** the same Flighty flight ID or match key with a different digest asks whether to keep the existing flight or add a new one; member edits are never overwritten.
4. **Possible manual duplicate:** an owned flight with the same date and route asks whether it is the same flight.
5. **Repeated sector in the file:** rows with the same date and route each need a decision.
6. **New since an earlier Flighty import:** with no candidate, one group answer adds them all.

An answer `new` waives the SQL same-date-and-route guard only for findings that name a reviewed conflict (`existing_flight`, `repeated_in_file`, `source_changed`, `previous_deleted`); for `new_since_import` the guard stays, so a flight added by hand in the meantime still returns the row to review.

Grouped answers apply to every row of the group at the run revision the owner saw, so a page of 10 000 clean rows needs one confirmation, not 10 000.

### Confirmation

`POST /api/import/history/:id/confirm` takes at most 50 `{rowId, version, key}`. A created flight goes through the shared `bulkCreate`/`createFlightStatements` chain with a history guard in place of the draft guard: the ledger insert requires the reviewed row version, an open run of the same generation and, unless the owner acknowledged it, no owned flight on that date and route. The flight, ledger link, row state, flight link and receipt commit in one D1 batch with the usual dirty mark. A link or a preserved record updates only its row; a link whose target flight was deleted after review sends its row back to `needs_review` with a `previous_deleted` finding (`HISTORY_ROW_NEEDS_REVIEW`). The receipt is the row itself (`operation_key` plus request digest), so a replay of the same key returns the same flight after any delay; another key on a committed row is `HISTORY_ROW_CONFIRMED`.

Created flights keep `flights.source = 'ai_import'`, the compatible technical value; their provenance is the owner-scoped row link, and owner views name Flighty. No `flights` rebuild.

### Explicit clock times

Migration 0020 adds `flights.utc_explicit` (0 or 1, server-owned, outside DTOs). A history create passes the resolved instants as trusted timing context: they override wall-clock inference, set `utc_explicit = 1`, and set `times_from_schedule = 1` when the pair was scheduled. Ordinary APIs cannot supply UTC. An owner PATCH keeps the instants while date, route, clock times and zones are unchanged and resets the marker when any of them changes; schedule acceptance resets it too. Durations above the 1 200-minute clamp or not positive are never clipped into a measured value: the row asks the owner, whose answer keeps the source times and writes no clock times. Historical flights are not recalculated.

### Private source data and deletion

Accepted cells (including PNR and Notes) persist with the owner's records until the owner deletes the flight, deletes the run's source data or deletes the account. They appear only in the owner's run pages and the archive (`GET /api/import/history/:id?representation=archive`), never in journal lists, events, public profiles, generic snapshots or logs. Archive entries state whether a record created a flight, linked one, was preserved only or had its source erased.

- **Flight delete, single and bulk:** in the same D1 batch as the `DELETE FROM flights`, linked rows lose their cells and flight link and become `removed`; the record digest, Flighty ID and match key remain as the tombstone.
- **Source erasure** (`DELETE /api/import/history/:id/source`): uncommitted rows become `ignored`, every row's cells are cleared and the run closes. Flights stay. Erased cells are never restored by a replay.
- **Discard** (`DELETE /api/import/history/:id`): a run with no committed row is deleted; otherwise unconfirmed rows become `ignored` with reason `discarded` and lose their cells. Created flights stay.
- **Expiry:** the maintenance sweep closes runs 30 days after creation; unconfirmed rows become `ignored`/`expired` and lose their cells.
- **Account delete:** rows, then runs, explicitly, before `flights`.

## Consequences

- Imports bigger than 10 000 records or 10 MiB are refused before any write. These are Kuuki's limits, not Flighty's.
- Compatibility is claimed only for the observed profile until a fresh original export with a known app version is reconciled (plan Task 10 holdout).
- A fingerprint can still miss a heavily edited record; the importer then asks rather than merges.

## Alternatives considered

- **CSV through the AI path or a pipe list:** probabilistic, row-capped, and loses columns.
- **Many ordinary batches:** hits the open-batch limit, expires source identity with the drafts and cannot widen `source_type` without a rebuild.
- **Four tables (runs, chunks, rows, identities):** the manifest replaces chunk receipts and committed rows replace the identity table, with the same replay and tombstone guarantees.
