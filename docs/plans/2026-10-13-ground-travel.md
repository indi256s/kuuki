# Ground travel implementation plan

Source: [spec](../../.scratch/ground-travel/spec.md) (ready-for-agent) and its contracts:
[page flow](../../.scratch/ground-travel/page-flow-contract.md),
[places](../../.scratch/ground-travel/places-contract.md),
[rail OCR](../../.scratch/ground-travel/rail-ocr-contract.md),
[storage](../../.scratch/ground-travel/storage-contract.md). Execution status lives in the
[handoff](2026-10-13-ground-travel-handoff.md). The five `.scratch/ground-travel/issues/` files are
resolved research, not implementation tickets.

Branch `feature/ground-travel`, worktree `~/.t3/worktrees/kuuki/feature-ground-travel`, base main `7188d198`.
Authorized: local development, local migrations, checks, commits, draft PR. Not authorized: merge,
deploy, remote D1 writes, remote GeoNames load (separate runbook gates). WebMCP is out of scope.

## Shared contract (wave 0, primary)

- `db/migrations/0011_ground_travel.sql` — catalog (`ground_places`, `ground_place_names`), private
  `ground_manual_places`, `ground_journeys` (live/tombstone CHECKs), `ground_rail_legs`,
  `ground_road_points`, `ground_journey_countries`, `ground_operation_receipts`
  (nonce/applied/complete CHECK), `country_visit_evidence.ground_journey_count`.
- `packages/shared/src/groundTravel.ts` — DTOs, `GroundCommand`, place snapshots, straight-line
  metrics, schedule duration, year attribution, list order. Tests in `groundTravel.test.ts`.

## Requirement map

| Req                                                                 | Node                               | Acceptance evidence                           |
| ------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------- |
| GT-01 page, filter, Add chooser, 4 mobile tabs, flight capture kept | U1                                 | navigation suite, nav tests                   |
| GT-02 plans/history/cancel/restore order                            | S1 (API), U1 (list)                | API tests, shared order test, UI test         |
| GT-03/GT-06 simple rail/road input, manual place                    | P1 (search/manual API), U2 (forms) | places API tests, form tests                  |
| GT-04 legs in one journey                                           | S1, U2                             | API tests                                     |
| GT-05 OCR batch, explicit add/replace                               | O1 (API), U3 (UI)                  | fake-provider tests, UI unit tests            |
| GT-07 straight-line ≈ distance, partial unknown                     | W0 shared, U1/U2                   | shared tests, UI copy                         |
| GT-08 local draft per owner                                         | U2                                 | unit tests (owner isolation, late response)   |
| GT-09/GT-12 unified review, reopen, receipts/CAS                    | S1, U2                             | D1 seam tests (CAS loser, races, replay, 410) |
| GT-10 undated completed                                             | S1, D1                             | API + passport tests                          |
| GT-11 confirmed countries → Passport                                | D1                                 | passport projection tests                     |
| GT-13 totals per mode                                               | W0 shared, U1                      | shared tests                                  |
| GT-14 states/a11y                                                   | U1–U3                              | navigation suite, UI review, browser check    |
| Export/account deletion                                             | D1                                 | API tests                                     |

Superseded in part (15 October 2026): GT-01's four mobile tabs, the page's Add chooser and the All / Rail / Road
segmented filter are replaced by the mobile dock spec ([`.scratch/mobile-dock/spec.md`](../../.scratch/mobile-dock/spec.md),
[plan](2026-10-15-mobile-dock.md)): Ground travel is the Journal's Ground section, adding goes through the shared Add list
(rail + key on phones), and transport is a facet chip.

## Nodes and waves

**Wave 1 (backend, parallel, disjoint paths)** — each a Sonnet implementer:

- **S1 storage/API**: `functions/api/_services/groundJourneys.ts`, `functions/api/ground-journeys/{index,[id]}.ts`,
  `functions/api/ground-journeys/operations/[key].ts`, `functions/test/ground-journeys*.test.ts`.
- **P1 places**: `scripts/generate-geonames-places.ts` (+ manifest), `functions/api/_services/groundPlaces.ts`,
  `functions/api/ground-places/**`, `functions/test/ground-places*.test.ts`, small test fixture.
- **D1 passport/account**: `countryEvidence.ts`, `passport.ts`, `passportDtos.ts`, `_lib/users.ts`,
  `workers/maintenance/index.ts`, `functions/api/ground-journeys/export.ts`, delete-preview counts,
  `functions/test/ground-passport*.test.ts` and touched existing tests.
- **O1 OCR**: `functions/api/ground-journeys/ocr.ts`, `functions/api/_services/railTicketOcr.ts`,
  `functions/test/ground-ocr*.test.ts`.

Primary owns `apps/next/api-routes.generated.ts` regeneration and integration checks.
Gate: Sonnet-high review of the backend diff, fixes, `pnpm typecheck:api`, `pnpm test:api`.

**Wave 2 (UI)** — starts after the backend gate, the [dxe brief](../../.scratch/ground-travel/dxe-ui-brief.md)
and the [Arc research](../../.scratch/ground-travel/arc-components-research.md):

- **U1 shell + list**: nav (4 mobile destinations, desktop link), Journal page Add keeps flight capture,
  `/ground-travel` page, cards, filters, totals, detail Sheet with schematic map, client API module.
- **U2 forms**: `/ground-travel/new`, `/ground-travel/[id]/edit`, rail/road editors, city combobox,
  manual place, local draft, unified review, submit state machine (unknown/409/pending).
- **U3 OCR UI + Passport/settings**: multi-file OCR in rail form, Passport country sources link to
  `/ground-travel?journey=`, settings JSON export and delete-preview counts.

Gate: Sonnet-high UI review, fixes, `pnpm next:build`, full `pnpm test:next:navigation`, lint, format.

**Wave 3 (close)**: docs (README ownership, DESIGN "built" note, glossary if needed), handoff, final checks,
draft PR. Remote catalog load and D1 migration stay release gates.
