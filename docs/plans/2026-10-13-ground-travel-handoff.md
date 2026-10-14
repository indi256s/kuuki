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

### Design-review corrections (14 October)

The accepted follow-up fixes the source findings in
[design-review-r1.md](../../.scratch/ground-travel/design-review-r1.md). H1–H3, M1–M10 and M12–M14 are
implemented: focus return, separate list/form classes, compact totals after plans, one page Add when empty,
typed Calendar dates, stable field placement, visible but disabled old search results, six-second row Undo,
collapsed row/ticket summaries, form skeletons, Arc save notices and deletion toasts. The Journal title and
mobile Add now wrap with flex layout. L1, L3–L11, L13, L14 and L16 are also addressed.

M11 is superseded by the accepted four-tab navigation; L2, L12, L15 and L17 were explicitly excluded from
this correction round. No final interface review was run, as requested. Visual acceptance remains open.

The implementation delegate stopped at the Claude API limit. The primary agent completed integration and
read the full correction diff. Local lint (two existing warnings), typecheck, formatting, Next build and
1617 Next unit tests and all 48 navigation scenarios pass (port 8813; 8800 was occupied). Focus return, Undo
and retained search-result regressions fail against the old source and pass with these changes.

The draft PR is [#59](https://github.com/indi256s/kuuki/pull/59). Its old Workers Build on `59a8108c` failed
one import-runtime test: the fixture announced a provider call before its stream existed. The existing
`main` fix `da3f4108` was cherry-picked as `f4214e66`; no import production code changed. All 911 API tests
pass after this fixture fix. Remote CI success is a separate release gate.

### Local main integration requested (14 October)

The user corrected the destination to local `main`; do not push further updates. `fc545138` merges local
`main` at `2fadf597` into the feature branch, preserving the new import flow, aircraft search and locale
switching. The Settings conflict retains localized notices and the ground-journey JSON export.

Integration checks: lint, typecheck, API typecheck and Next build pass; 911 API tests pass. The full Next
unit run passed 1639 of 1645 tests, with six five-second timeouts under parallel verification load; all six
affected files then passed (95 tests, one worker). The navigation run passed 50 of 52 tests; both account
timeouts then passed in the five-test account suite without other verification load. No tests or timeouts
were changed to obtain these results.

Local `main` is still checked out at `/Users/indi256/Documents/kuuki/kuuki`, with other threads' staged and
unstaged work. Its HEAD advanced during preparation. The user has been asked to pause those threads before
the checkout update; no main files or index entries have been changed by this transfer. The 23 existing
untracked files overlapping incoming additions matched the incoming contents exactly. Next: after the
pause, take fresh preservation snapshots, update local main to the integrated feature tip and restore the
uncommitted work with its staging state. Retain the snapshots until preservation is verified.

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
- Dates use the shared typed Calendar; times stay native. Drag reorder is a small local pointer handler
  with up/down icon buttons; row removal offers six-second Undo.

Open items: no per-account cap on journeys or manual places; `listManualPlaces` stops at 1000; the country detail
`totalVisits` excludes `ground_journey_count` (journeys are shown in their own section); crowded 3-letter search
buckets may return fewer than 10 results.

## Inputs needed to resume

- **Committed:** spec and contracts under `.scratch/ground-travel/`, this plan, migration 0011, shared module,
  `scripts/geonames/manifest.json` (pinned dump SHA-256), `db/seed/ground_places_fixture.sql`.
- **Reproducible:** full catalog via `pnpm exec tsx scripts/generate-geonames-places.ts`; output SQL under
  `.wrangler/geonames/` stays out of Git.
- **Checkout-local:** none required.
