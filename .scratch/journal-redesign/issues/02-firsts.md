# 02 Firsts over the whole journal

Status: done
Type: task
Owner: Opus (same agent as 01)
Blocked by: 01
Spec: Firsts; D1, D2

## What

Pure `journalFirsts(input): Record<number, FlightFirsts>` in `functions/api/_services/firsts.ts`, wired into `readJournalAll`. Rules in spec D2: order `date, departure_utc, id`; upcoming never earns; awaiting earns with `pending: true`; country firsts from `countryContributions` (transit suppression, D12); non-flight evidence (claims, ground visits, legacy) dated on or before the flight, or undated, blocks a country first; airline on `airline_iata`, aircraft type on `aircraft_icao`. Tolerate malformed legacy rows (skip, never throw).

## Done

- Unit tests: transit endpoint earns no country first; awaiting first is pending; deleting the first flight moves the first to the next; claim dated earlier blocks; same-day tie by `departure_utc` then id; upcoming excluded.
- `pnpm typecheck:api`, `pnpm test:api` green.
