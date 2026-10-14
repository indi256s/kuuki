# Ground travel handoff

Plan: [2026-10-13-ground-travel.md](2026-10-13-ground-travel.md). Owner checkout:
`~/.t3/worktrees/kuuki/feature-ground-travel`, branch `feature/ground-travel` (seed docs commit `e5e0b657` on
main `7188d198`; local main `43d7002a` merged in `1fad4e5a` on 14 October).

## Status (14 October 2026)

Waves 0–2 are implemented, reviewed and fixed; wave 3 docs are written. Source implementation only: no remote
D1 migration, no remote GeoNames load and no deploy were performed or authorized. Nothing was checked in a real
browser.

- **Wave 0:** migration `0011_ground_travel.sql`, `packages/shared/src/groundTravel.ts` (`61182c04`, `4db884c7`).
- **Wave 1 backend:** journeys API `83c0837f`, Passport evidence/export/deletion/receipt cleanup `01c3c923`,
  rail OCR `2d130ce1`, GeoNames places `baaf8332`. Independent review found no critical/high defects; fixes in
  `811de5e9` (owner child-read indexes, operation-key charset and code-point lengths, 5 MiB body cap with
  chunked child inserts, leg date order, fresh-account `ready`, binary tie-break, CAS-loss-after-classify test).
- **Wave 2 UI:** client API/formatters `8582a4a9`; Passport sources `066d125d`; Settings export and counts
  `d8454dc8`; nav with four mobile tabs `22e349a8`; list/detail `0b33e680`; async combobox `4e1805e0`; forms and
  unified review `4d6a71f7`; return-context fix `0a42014e`; multi-file dropzone `9a4ca346`; rail OCR UI
  `b04c0d46`. Independent UI review fixes: `58f20182`, `35b82cbd`, `e295b9e1`, `45b5e99d`.
- **Wave 3:** ownership in `docs/README.md`, DESIGN shell note and Ground travel section `9bf7bc14`.

## Release gates (not done, separate approval)

1. Apply migration 0011 remotely **before** deploying this code: `countryEvidenceRead` (used by every repair,
   flight confirm and transit review) now reads `ground_journey_countries`. The migration is additive, so rolling
   back code is safe.
2. Load the GeoNames catalog remotely (`scripts/geonames/README.md`; ~47.6 MB SQL in 5 chunks).
3. Visual pass: «Наземные» tab at 320px and 200% text, desktop header at 700–900px, segmented control at 320px,
   Safari/Firefox combobox footer clicks, live OCR with a large PDF, Safari JSON export.

## Decisions (reversible, recorded for review)

- Completing a plan opens the unified review at `/ground-travel/<id>/edit?complete=1`.
- An explicitly empty confirmed-country list is valid; the UI sends it only after “None of these”.
- Place search starts at 3 characters for the catalog and manual places alike (catalog buckets are 3-char
  prefixes), so a 2-letter manual place is not found by search.
- Rail OCR shares the `import-parse` quota (20/hour); the client waits up to 120 s per file.
- Mobile: the bottom + key is removed; phones add flights from the Journal header.
- Opening another journey aborts an in-flight detail action; it then shows as unconfirmed on its own journey.
- Dates and times use native inputs; drag reorder is a small local pointer handler with ↑/↓ buttons.

Open items: no per-account cap on journeys or manual places; `listManualPlaces` stops at 1000; the country detail
`totalVisits` excludes `ground_journey_count` (journeys are shown in their own section); crowded 3-letter search
buckets may return fewer than 10 results.

## Inputs needed to resume

- **Committed:** spec and contracts under `.scratch/ground-travel/`, this plan, migration 0011, shared module,
  `scripts/geonames/manifest.json` (pinned dump SHA-256), `db/seed/ground_places_fixture.sql`.
- **Reproducible:** full catalog via `pnpm exec tsx scripts/generate-geonames-places.ts`; output SQL under
  `.wrangler/geonames/` stays out of Git.
- **Checkout-local:** none required.
