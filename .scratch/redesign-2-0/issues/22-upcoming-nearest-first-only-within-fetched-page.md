# Nearest upcoming flights are reordered only inside the fetched page

Status: needs-triage
Owner task: T13
Source: T13 minor M6 (UI re-review round 1); `apps/next/src/client/reads/journal.tsx` (upcoming group sort), `apps/next/src/server/journal.ts`, `functions/api/_lib/flightQuery.ts` (`orderByClause`)

## What differs
The Journal sorts the Upcoming group ascending by date on the client, but the server returns the default date-descending page of 20. With more than 20 future flights the nearest trip can be missing from page 1, so "nearest first" is only true within the page.

## Decision needed
Server ordering for upcoming rows: for the default sort, order by lifecycle group (upcoming ascending by date, then the rest descending) in `readJournal`/`orderByClause`, with the count, ids and pagination staying in lockstep. This changes the shared list contract (API tests required).

## Acceptance check
An API test with 25 upcoming flights asserts that page 1 holds the 20 nearest, in ascending date order, with other sorts unchanged; the client-side re-sort is then removed.
