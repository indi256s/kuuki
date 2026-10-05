# Missing-aircraft line on Overview opens the retained enrichment review

Status: closed (T17 fix round 2, review I2, N1)
Owner task: T17
Source: T17 Overview rankings; ADR 0001 open item 8 (missing-aircraft line)

## Outcome
The first T17 pass linked the line to the Journal sorted by aircraft ascending, which is not the set the summary counts. The line now opens the retained enrichment review (`AircraftPanel`, apps/next/src/client/import/aircraft-panel.tsx) in a `Sheet` (`client/overview/missing-aircraft.tsx`).
- Targets come from a dedicated owner-scoped read, `GET /api/me/overview/missing-aircraft?period=all|YYYY[&after=<cursor>]` (`functions/api/me/overview/missing-aircraft.ts`, `functions/api/_services/missingAircraft.ts`). It uses the Overview's `completedScope` plus `aircraft_icao IS NULL`, so it is the set `dataAvailability.missingAircraft` counts. It returns one keyset page (newest first by date, then id; at most 100) with the exact `total`, the `offset` of the page inside the set, and `nextCursor` (`YYYY-MM-DD:id`, null on the last page). Malformed `period` or `after` is a 400.
- An earlier round added a `missing=aircraft` filter to the shared Journal query (`flightQuery.ts`). It was removed: it was not part of the Journal's C1 URL contract (not owned, not reset, not visible), so it narrowed the Journal invisibly. `?missing=aircraft` is now an ordinary unknown parameter with no effect (regressions in `functions/test/overview-modules.test.ts` and `apps/next/src/lib/url-state.test.ts`). A Journal "no aircraft" filter, if wanted, belongs to the Journal's own URL-state work (T13) with a visible, resettable control.
- The sheet shows one page at a time. "Show the next N" (EN/RU, real plural forms) reads the next page by cursor, so every qualifying flight is reachable whether or not earlier rows could be identified or saved; "Back to the newest" restarts. The disclosure reads "Flights a-b of TOTAL without an aircraft" from the server's exact `offset`/`total`, formatted by the shared formatter.
- After a confirmed save the sheet re-reads the same page (the saved flights leave it, the next ones move up, the total follows), then calls `router.refresh()` for the figures behind it.
- `functions/test/overview-modules.test.ts` ("missing-aircraft review targets") proves set equality for all-time and year periods, traversal of more than 100 targets at the real page size of 100 (page sizes 100/100/52, offsets, no gap or repeat, union equals the counted set), stability when a row is saved mid-traversal, owner isolation across pages, and the 400s.

## Still open (not part of this issue)
Bulk entry for flights the service cannot identify stays with issue 11 (bulk aircraft outcome contract).
