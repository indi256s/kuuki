# Ground travel handoff

Plan: [2026-10-13-ground-travel.md](2026-10-13-ground-travel.md). Owner checkout:
`~/.t3/worktrees/kuuki/feature-ground-travel`, branch `feature/ground-travel` (base main `7188d198`,
seed docs commit `e5e0b657`).

## Status (13 October 2026)

Paused by the owner after wave 1. Source implementation only: no remote D1 migration, no remote GeoNames
load and no deploy were performed or authorized.

- **Wave 0 accepted:** migration `0011_ground_travel.sql` and `packages/shared/src/groundTravel.ts`
  (`61182c04`, doc note `4db884c7`).
- **Wave 1 implemented, primary-checked, not yet independently reviewed:**
  - S1 journeys API with receipt-first atomic mutations — `83c0837f`.
  - D1 Passport evidence, journey contributions, JSON export, account deletion, receipt cleanup — `01c3c923`
    (also adjusted `transitReview.ts` and `lifecycle-migration.test.ts`).
  - O1 rail ticket OCR endpoint — `2d130ce1`.
  - P1 GeoNames generator, place search and manual places — `baaf8332`.
  - Integration: route inventory current, `restore-export-local.test.ts` expects 0011.
- **Pre-UI inputs committed:** [Arc research](../../.scratch/ground-travel/arc-components-research.md),
  [dxe UI brief](../../.scratch/ground-travel/dxe-ui-brief.md).

Latest checks on the wave 1 integration state: `pnpm test:api` 73 files / 922 tests pass;
`pnpm typecheck:api`, `typecheck:maintenance`, Next typecheck and `pnpm lint` clean (one pre-existing
React Compiler warning); Passport UI unit tests pass. P1 measured the real catalog: 236,112 places,
327,696 search keys, 47.6 MB SQL in 5 chunks, local load 92 s, index-only search plans.

## Next action

1. Independent Sonnet-high review of the wave 1 backend diff (`61182c04..HEAD` excluding docs), then fixes.
2. Wave 2 UI (U1 shell/list, U2 forms, U3 OCR/Passport/settings) per the plan, using the dxe brief.

Decisions taken during wave 1 (reversible, recorded for review):

- Completing a plan opens the unified review at `/ground-travel/<id>/edit?complete=1`.
- An explicitly empty confirmed-country list is valid (storage contract).
- Rail OCR shares the existing `import-parse` quota (20/hour); a batch of 10 files uses half of it.
- Catalog search starts at 3 characters for GeoNames (prefix buckets); manual places match from 2.

Open items for review: OCR quota sizing; untagged/other-script aliases are not searchable;
`SettingsCounts` client type needs `journeys`/`manualPlaces` in the UI wave.

## Inputs needed to resume

- **Committed:** spec and contracts under `.scratch/ground-travel/`, this plan, migration 0011, shared
  module, `scripts/geonames/manifest.json` (pinned dump SHA-256), `db/seed/ground_places_fixture.sql`.
- **Reproducible:** full catalog via `pnpm exec tsx scripts/generate-geonames-places.ts` (see
  `scripts/geonames/README.md`); output SQL under `.wrangler/geonames/` stays out of Git.
- **Checkout-local:** none required.
