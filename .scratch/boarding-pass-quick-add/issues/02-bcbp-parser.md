# 02 — BCBP payload projection

Status: resolved
Type: task
Requirements: QA-02, QA-04, QA-05, QA-12

## Outcome

A pure client module turns decoded barcode text into allowlisted leg candidates: `{ legs: Leg[]; incomplete: boolean } | null` where `Leg = { origin; destination; airline?; flightNumber?; dayOfYear? }` matching the [admission contract](../spec.md#engineering-resolution-implementation-thread-2026-10-12). `null` means "not a boarding pass" (fallback). Passenger name, PNR, seat, sequence, status and conditional/security data are read past and never returned.

## Owned paths

`apps/next/src/client/import/bcbp.ts`, `apps/next/src/client/import/bcbp.test.ts`.

## Acceptance

- IATA BCBP Resolution 792 mandatory layout: format `M`, leg count 1–4, first leg 60 chars, later legs 37 chars, each followed by its hex-sized conditional section.
- Multi-leg payloads yield one leg per encoded leg in source order. Truncated/malformed later legs keep earlier valid legs with `incomplete: true`; a malformed first leg → `null`.
- Flight number strips leading zeros and keeps an alpha suffix; 2-character IATA carrier kept, 3-letter ICAO or blank → `airline` absent; blank/invalid Julian day → `dayOfYear` absent; never a full year.
- `combineLegs(results)` dedupes identical legs across repeated renderings of one barcode and caps at 8.
- Check: `pnpm --filter @kuuki/next exec vitest run src/client/import/bcbp.test.ts`, `pnpm --filter @kuuki/next typecheck`.
