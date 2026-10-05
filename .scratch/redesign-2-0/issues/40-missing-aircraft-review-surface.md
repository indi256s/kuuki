# Missing-aircraft line on Overview has no dedicated review surface

Status: needs-triage
Owner task: T18
Source: T17 Overview rankings; ADR 0001 open item 8 (missing-aircraft line)

## What differs
Overview shows "N flights have no aircraft listed" from `dataAvailability.missingAircraft` and links to the Journal sorted by aircraft ascending (`/journal?[year=]&sort=aircraft_icao&order=asc`), which puts flights without an aircraft first. There is no Journal filter for "aircraft is missing", so the link can show completed flights that do have one after the missing ones, and the member cannot page only the missing set. Bulk entry belongs to issue 11 (bulk aircraft outcome contract).

## Decision needed
Add a `missing=aircraft` Journal filter (and a matching count in the list API), or accept the sorted view. Recommendation: add the filter; then point the Overview link at it and drop the sort workaround in `apps/next/src/client/overview/rankings.tsx`.

## Acceptance check
A Journal URL with the new filter lists exactly the flights counted by `dataAvailability.missingAircraft` for the same period (API test using `overviewAccount` from `functions/test/overview-fixture.ts`); the Overview link uses it; its count equals the Journal total.
