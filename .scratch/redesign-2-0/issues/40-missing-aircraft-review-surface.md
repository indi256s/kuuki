# Missing-aircraft line on Overview opens the retained enrichment review

Status: closed (T17 fix round 1, review I2)
Owner task: T17
Source: T17 Overview rankings; ADR 0001 open item 8 (missing-aircraft line)

## Outcome
The first T17 pass linked the line to the Journal sorted by aircraft ascending, which is not the set the summary counts. The line now opens the retained enrichment review (`AircraftPanel`, apps/next/src/client/import/aircraft-panel.tsx) in a `Sheet` (`client/overview/missing-aircraft.tsx`).
- Targets come from `GET /api/flights?status=completed&missing=aircraft[&year=YYYY]&limit=100&sort=date&order=desc`, a bounded, owner-scoped read through the Journal list (new `missing=aircraft` filter in `functions/api/_lib/flightQuery.ts`, which also gives the Journal a "no aircraft" filter if a later task wants one).
- `functions/test/overview-modules.test.ts` ("missing-aircraft review targets") proves the target set equals `dataAvailability.missingAircraft` for all-time and year periods (completed only, owner only), and that n=500 is bounded to the page while `total` stays exact.
- After `onSaved` the page calls `router.refresh()`, so the count and every summary figure are re-read. Only the newest 100 flights load per opening; the sheet says so, and saving them brings the rest in on the next opening.

## Still open (not part of this issue)
Bulk entry for flights the service cannot identify stays with issue 11 (bulk aircraft outcome contract).
