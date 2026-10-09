# 04 Search parsing and matching

Status: open
Type: task
Owner: Sonnet
Blocked by: —
Spec: Search

## What

Pure `apps/next/src/client/journal/search.ts` (+ `search.test.ts`):

- `parseJournalSearch(text, ctx): JournalSearch` and `matchesJournalSearch(flight, search, ctx): boolean`, where `ctx = { refs: JournalRefs, locale }`.
- Understands: places (city, airport code or name, country name in EN and RU via `Intl.DisplayNames`, verified aliases from `packages/shared/src/airportSearch.ts` with `foldSearchText`); flight numbers ("TK 381", "TK381"); airline code or name; aircraft code, name or family ("A350", "737", "Dreamliner" if in refs); dates ("2019", "march 2024", "май 2023", "2024-03") as a period; route pairs ("TBS IST", "TBS-IST", "TBS → IST", "Tbilisi Istanbul") matching either direction.
- Words that are not recognised fall back to substring match on the haystack the server used (`origin destination flight_number airline_iata date` + city and name), AND across words, as in `functions/api/_lib/flightQuery.ts` `buildFlightWhere`.
- The API server tests in `functions/test/flights.test.ts` (search cases) are the reference behaviour; mirror their cases in unit tests.

## Done

- Unit tests per form above in EN and RU.
- `pnpm --filter @kuuki/next typecheck`, `pnpm --filter @kuuki/next test` green.
