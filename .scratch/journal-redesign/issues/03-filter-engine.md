# 03 Client filter, sort and connections engine

Status: open
Type: task
Owner: Opus
Blocked by: — (codes against `client/journal/model.ts`; search matcher from 04 is injected)
Spec: Data and state; Default contents; Sorting and grouping; Page structure 1, 5

## What

Pure module `apps/next/src/client/journal/filter.ts` (+ `filter.test.ts`):

- `selectJournal(payload, filters, sort, search?)` → `{ rows: LedgerItem[], matching: JournalFlight[], summary, statusCounts, facetCounts }`.
- Default contents: logged + awaiting. Status facet replaces the default when set.
- Facets per `JournalFilters` (ORed within, ANDed across). Period: `from`/`to` inclusive, else `years`. Places: either end, airports and countries. Aircraft: `aircraft` codes OR `families` via `refs.aircraft`. Alliance at flight date via `allianceAt` (`@kuuki/data/alliance-membership`). Missing: aircraft, airline, times (no departure_time), flight_number.
- Sort: date (default newest first), duration, distance; nulls last; tie by id. Non-date sorts are flat.
- Connections: `connectionChains` from `functions/api/_services/connections.ts` over the whole payload (all flights, real countries), computed once per payload (memoise by payload identity). Under date sort, adjacent matching legs of one chain become `{ kind: 'leg' }` items joined by `{ kind: 'connector', airport, minutes }` items. Under non-date sorts no connectors.
- Summary: matching count, distance and duration summed over logged flights only (confirmed-only), plus how many lack each.
- Must run 1,000 flights in under 10 ms on desktop (add a bench-style assertion with a generous bound or a measured note).

## Done

- Unit tests for each facet, default contents, sort orders, connector insertion and removal under non-date sort, confirmed-only summary.
- `pnpm --filter @kuuki/next typecheck`, `pnpm --filter @kuuki/next test` green.
