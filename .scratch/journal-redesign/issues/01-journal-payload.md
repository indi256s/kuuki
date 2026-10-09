# 01 Whole-journal payload and endpoint

Status: open
Type: task
Owner: Opus
Blocked by: —
Spec: Data and state; D3, D4

## What

`readJournalAll(db, userId): Promise<JournalPayload>` in `functions/api/_services/journal.ts` (keep `readJournal` for `/api/flights`). One owner-scoped D1 batch: every flight (all lifecycle states) joined to `airports_reference` for `origin_country`/`destination_country`, the `user_derived_state` row, the airport and aircraft reference rows used by the journal, plus what ticket 02 needs. Airline names come from `@kuuki/data` `airlines.json` (server-side). Shape: `functions/api/_services/journalPayload.ts` (do not change it without telling the orchestrator).

`GET /api/flights/journal` (new `functions/api/flights/journal.ts`) returns the same payload, owner-scoped like `index.ts`. Regenerate `apps/next/api-routes.generated.ts` with `node scripts/build-next.mjs --inventory-only`. `apps/next/src/server/journal.ts` gets `getOwnJournalAll()` (identity → `readJournalAll`).

## Done

- API test in `functions/test/` for the endpoint: owner scoping (another user's flights absent), all states present, countries joined, refs populated, revision fields.
- `pnpm typecheck:api`, `pnpm test:api` green.
