# ADR 0016: An import leg takes one decision, and By land becomes a ground visit

- **Status:** Accepted, 26 November 2026. Amended the same day after review: By land is stored on the draft instead of in session storage.
- **Origin:** [Import 2.0 plan](../plans/2026-11-26-import-2.0.md) §1 and §5, built on `feature/import-2.0`.
- **Builds on:** [ADR 0001 §6](0001-flight-lifecycle-and-import-drafts.md#6-import-drafts-migration-0007_import_draftssql) import drafts, [ADR 0015](0015-nomads-stays-import.md) Nomads stays, the ground visit in the [glossary](../../GLOSSARY.md#ground-visit).

## Context

`/import` asked one candidate several independent questions: a selection checkbox, "Did you take", Include/Exclude, and per-row question cards. A Nomads export is mostly cities connected by journeys the owner may have made by train or road, and those journeys had nowhere to go: the owner could only leave them unticked, and their countries never reached the passport.

## Decision

### One decision per leg, stored on the draft

Every review candidate is a leg with exactly one decision: Flew, By land or Skip, or none yet. [`route-model.ts`](../../apps/next/src/client/import/route-model.ts) maps it onto the draft contract, and each decision is one draft patch:

- **Flew** writes `selected: true, dismissed: false`; a duplicate of a journal flight, or a copy of another leg in the same import, also gets `duplicateAcknowledged: true`, because choosing Flew on it is the acknowledgement. `dismissed` is always sent, so Flew replaces a dismissal that is still waiting to be saved. Readiness rules are unchanged, so a Flew leg with a missing airport or year stays out of the save until it is filled.
- **Skip** writes `dismissed: true`.
- **By land** writes `dismissed: true, byLand: true`. The draft patch ([importDrafts.ts](../../functions/api/_services/importDrafts.ts)) accepts `byLand` only as `true` and only together with `dismissed: true`, and keeps it as `fields.by_land: true`; any other dismissal (Skip) or a restore (`dismissed: false`) clears it. Like the flown confirmation it is the member's answer, not a correction: it never marks the draft `edited`, cannot be set through `fields`, and follows the usual version check. A patch that would push `fields_json` past its 2048-character limit is refused as `INVALID_DRAFT`.
- A dismissed draft reads back as By land when `fields.by_land` is set, otherwise as Skip, so the decision survives a reload, a fresh tab and lost session storage, and a failed or discarded write leaves the previous decision in place. This amends the first version of this ADR, which kept By land only in the session's `landIds`: losing session storage turned a By land leg into Skip with no ground visit, and a failed write left that record out of step with the draft. Older session records that still carry `landIds` are read without it.
- A single confident document row still counts as Flew without a write (the implicit singleton); Nomads rows start undecided.
- A leg with the same date and airports as an earlier leg in the import is a copy of it, whatever the earlier leg's decision. The copy shows undecided until the member decides it: its stored preselection from recognition never counts as Flew, so skipping or sending the first copy by land cannot turn the second into a saved flight.

### By land creates a ground visit on save

On save, each By land leg whose destination country is known (an airport code through the catalog, or the `CC` suffix of a `City, CC` hint) and differs from its origin country creates a ground visit through `POST /api/passport/ground-visits`: `countryCode` is the destination country, `visitYear` the leg's year when its date is settled, otherwise `null`, `entryMethod: 'land'`, `mode: null`, and the visit `id` is the draft id. An unknown origin country counts as different, since reaching the destination by land is still true. A leg inside one country, or one whose destination country is unknown, creates nothing; the leg and the save bar name which of the two it is (`landOutcome` in `route-model.ts`).

Visits are sent up to four at a time, alongside the flight save, since neither depends on the other. The draft id is the idempotency key: a retry after an unknown outcome replays (200) instead of adding a second visit. A replay returns the visit as first stored, so when its year differs from the leg's current year (the member changed the leg after a lost response) the client corrects it with `PATCH /api/passport/ground-visits/:id` before counting the leg as recorded ([land-visits.ts](../../apps/next/src/client/import/land-visits.ts)). Created ids are kept as `landDoneIds` in the session record, so the leg shows as recorded after a reload; losing that record only means the next save replays the visit. A failed visit keeps its leg actionable and the page on the review. The ground visit endpoints are unchanged; the draft patch gains only `byLand`.

## Consequences

- Ground visits from an import are ordinary manual visits: they press stamps at once, count under Manual (no `mode`), and can be edited or deleted in Passport like any other.
- The session record carries `landDoneIds`; malformed values are dropped on resume.
- By land is part of the draft, so it lives and expires with the import batch like every other review decision.
- The finish reports trips by land beside flights and shows the newly pressed stamps that either produced.
