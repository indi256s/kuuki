# Overview mini map draws country dots only; route arcs need a period-scoped geometry read

Status: needs-triage
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
