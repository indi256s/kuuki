# ADR 0016: An import leg takes one decision, and By land becomes a ground visit

- **Status:** Accepted, 26 November 2026.
- **Origin:** [Import 2.0 plan](../plans/2026-11-26-import-2.0.md) §1 and §5, built on `feature/import-2.0`.
- **Builds on:** [ADR 0001 §6](0001-flight-lifecycle-and-import-drafts.md#6-import-drafts-migration-0007_import_draftssql) import drafts, [ADR 0015](0015-nomads-stays-import.md) Nomads stays, the ground visit in the [glossary](../../GLOSSARY.md#ground-visit).

## Context

`/import` asked one candidate several independent questions: a selection checkbox, "Did you take", Include/Exclude, and per-row question cards. A Nomads export is mostly cities connected by journeys the owner may have made by train or road, and those journeys had nowhere to go: the owner could only leave them unticked, and their countries never reached the passport.

## Decision

### One decision per leg, mapped onto the existing draft fields

Every review candidate is a leg with exactly one decision: Flew, By land or Skip, or none yet. [`route-model.ts`](../../apps/next/src/client/import/route-model.ts) maps it onto the draft contract without a new field:

- **Flew** writes `selected: true`; a dismissed draft also gets `dismissed: false`, and a duplicate of a journal flight gets `duplicateAcknowledged: true`, because choosing Flew on it is the acknowledgement. Readiness rules are unchanged, so a Flew leg with a missing airport or year stays out of the save until it is filled.
- **Skip** writes `dismissed: true`.
- **By land** writes `dismissed: true` and records the leg in the session's `landIds` (owner-scoped session storage, like exclusions). After a reload a dismissed leg reads back as By land only from that record; otherwise it reads as Skip.
- A single confident document row still counts as Flew without a write (the implicit singleton); Nomads rows start undecided.

### By land creates a ground visit on save

On save, each By land leg whose destination country is known (an airport code through the catalog, or the `CC` suffix of a `City, CC` hint) and differs from its origin country creates a ground visit through `POST /api/passport/ground-visits`: `countryCode` is the destination country, `visitYear` the leg's year when its date is settled, otherwise `null`, `entryMethod: 'land'`, `mode: null`, and the visit `id` is the draft id. An unknown origin country counts as different, since reaching the destination by land is still true. A leg inside one country, or one whose destination country is unknown, creates nothing; the leg and the save bar name which of the two it is (`landOutcome` in `route-model.ts`).

Visits are sent up to four at a time, alongside the flight save, since neither depends on the other. The draft id is the idempotency key: a retry after an unknown outcome replays (200) instead of adding a second visit. Created ids are kept as `landDoneIds` in the same session record, so the leg shows as recorded after a reload. A failed visit keeps its leg actionable and the page on the review. No server endpoint or draft contract changes.

## Consequences

- Ground visits from an import are ordinary manual visits: they press stamps at once, count under Manual (no `mode`), and can be edited or deleted in Passport like any other.
- The session record now carries `landIds` and `landDoneIds`; malformed values are dropped on resume.
- The finish reports trips by land beside flights and shows the newly pressed stamps that either produced.
