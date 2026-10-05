# Overview mini map draws country dots only; route arcs need a period-scoped geometry read

Status: resolved
Owner task: T16 / T18
Source: T17 brief ("period-correct mini map + legend"); `functions/api/flights/routes`

## What differs
`GET /api/me/overview` returns `map.countries[{id, visits, pending}]` and `map.routeCount`, enough for the period-correct country preview and its legend, but no per-route geometry. The Overview map therefore reuses T16's `CountryPreview` (pressed countries only, bucket colours from `BUCKET_TOKENS`) and shows the route count as text. Pending countries are listed and counted as "waiting for a stamp" but are not drawn, because `CountryPreview` has no pending ring. `client/maps/preview.tsx` and `lib/map-buckets.ts` are T16-owned and were not changed.

Update: the server side of route geometry now exists (`pairs`, `routeCount`, `countries` on `GET /api/flights/route-projection`, issue 42). What remains here is the Overview mini map drawing arcs and a pending ring, which needs a T16 renderer change.

## Decision needed
Whether the Overview map should draw route arcs (extend `GET /api/flights/routes?year=` with deduplicated unordered pairs) and a pending ring (a `pending` prop on `CountryPreview`). Recommendation: do both in T16/T18 so Overview and Passport share one renderer.

## Acceptance check
`map.routeCount` equals the number of arcs drawn for the same period; a pending country renders a ring distinct from a pressed one; the Overview legend keeps matching `BUCKET_LABELS`.

## Continuation disposition — 2026-10-05

3685fbb adds a pending ring to the period-correct Overview preview without counting it as pressed; claim evidence still overrides pending. The preview intentionally stays lightweight and delegates route geometry to Open Passport map, which consumes issue 42. Inline Overview arcs remain unimplemented; no arc-count equality, map timing/memory or visual proof is claimed.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.

## Resolution — 2026-10-06

8537c7a draws the period's route arcs on the Overview preview from the same `GET /api/flights/route-projection` contract and client read as the Passport map: `useRouteProjection` (`apps/next/src/client/maps/projection.ts`) now owns the fetch, owner/period check and stamp mismatch refresh for both, and `CountryPreview` draws one static arc per canonical undirected pair with the shared `routeGeometry`, beneath the country dots and the pending ring. No new endpoint or pair derivation.

- Arcs appear only for a ready projection whose stamps and `routeCount` equal the summary's; otherwise the countries stay and a status says route lines are updating (a newer projection refreshes the summary once) or unavailable. The legend line keeps the summary's route count, so a pending or failed read never reads as zero routes.
- A truncated projection draws the bounded set and says "Showing the first N of M routes."; pairs without a known airport position are named instead of silently drawing fewer arcs.
- No pan/zoom and no arc motion (so nothing to reduce). The "Open Passport map" link and the `BUCKET_LABELS` legend are unchanged. The first-run sample passes no owner and never reads routes.
- Overview now makes one route-projection request for the shown period; the read-journeys navigation test asserts that request and still asserts no interactive map assets load.

Tests: `map-band.test.tsx` (arc count = projection.routeCount = map.routeCount, truncation in EN/RU, unplaceable pairs, pending/failed/other-owner/stale/disagreeing projection fallbacks, single refresh, no read without routes, pending ring vs pressed, legend parity in EN/RU), `preview.test.tsx` (arc per drawable pair, antimeridian split, arcs under dots), existing panel tests unchanged; read-journeys asserts one arc for the fixture's one 2026 route. No visual, timing or memory claim.
