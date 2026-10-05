# Nearest upcoming flights are reordered only inside the fetched page

Status: resolved
Owner task: T13
Source: T13 minor M6 (UI re-review round 1); `apps/next/src/client/reads/journal.tsx` (upcoming group sort), `apps/next/src/server/journal.ts`, `functions/api/_lib/flightQuery.ts` (`orderByClause`)

## What differs
The Journal sorts the Upcoming group ascending by date on the client, but the server returns the default date-descending page of 20. With more than 20 future flights the nearest trip can be missing from page 1, so "nearest first" is only true within the page.

## Decision needed
Server ordering for upcoming rows: for the default sort, order by lifecycle group (upcoming ascending by date, then the rest descending) in `readJournal`/`orderByClause`, with the count, ids and pagination staying in lockstep. This changes the shared list contract (API tests required).

## Acceptance check
An API test with 25 upcoming flights asserts that page 1 holds the 20 nearest, in ascending date order, with other sorts unchanged; the client-side re-sort is then removed.

## Continuation disposition — 2026-10-05

The accepted Journal orders upcoming rows within its fetched page. Globally nearest-first pagination still needs a shared API/list/ids ordering decision and the 25-upcoming acceptance fixture described above. No claim of global nearest-first acceptance is made.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.

## Resolution — 2026-10-06

Status: resolved. The default Journal sort (`date`, descending) now orders `lifecycle_state = 'upcoming'` rows first, ascending by date then id, followed by every other row in the existing date/id descending order. The change is in `orderByClause` (`functions/api/_lib/flightQuery.ts`), the only ORDER BY consumer (`readJournal`), so page, count and cursor offsets share it; `/api/flights/ids` returns an unordered id set that matches the list. Explicit sorts are unchanged. The Journal's client-side re-sort of the Upcoming group was removed.

Tests: new API test in `functions/test/flights.test.ts` (25 upcoming and 3 past rows: page 1 holds the 20 nearest ascending, page 2 holds the remaining 5 then past rows descending, total and ids match, date asc and origin sorts unchanged); the Journal unit test now asserts the group keeps server order. `pnpm typecheck:api`, `pnpm test:api` (500), `@kuuki/next` test/lint/typecheck, `pnpm next:build`, and `read-journeys` plus `capture` navigation files on port 8802 pass.
