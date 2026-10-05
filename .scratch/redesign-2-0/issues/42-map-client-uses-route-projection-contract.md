# Opened map client still ignores the route-projection publication contract

Status: resolved
Owner task: controller (after T16 and T17 merge)
Source: T17 review I3; C6 in docs/plans/2026-10-04-redesign-2.0-implementation.md; `GET /api/flights/route-projection`

## What changed on the server (T17, additive)
`GET /api/flights/route-projection?period=all|YYYY` keeps `period`, `ownerId` and the directed `routes` list, and now also returns (type `RouteProjection` in `packages/shared/src/routeProjection.ts`):
- `revision`, `publishedRevision`, `derivedState`, `countryState`: the same stamps the Overview summary carries.
- `pairs`: undirected, deduplicated airport pairs (`a` sorts before `b`; `count = forward + reverse`) with geometry and country codes. `routeCount` is the exact number of pairs and equals the summary's `map.routeCount`.
- `limit` (5,000), `truncated`: both lists are bounded and newest first.
- `countries`: `{id, visits, pending}[]` for the period after the published transit suppressions, identical to the summary's `map.countries`; null while `countryState` is `updating`.
The predicate (owner, completed = awaiting or logged, period) and the country statement are shared with the summary through `functions/api/_services/periodScope.ts`.

## What the client must switch to (not done here: `apps/next/src/client/maps/**` is T16-owned)
1. `client/maps/panel.tsx` (about lines 43-67): replace the local `RouteProjection` type in `maps/types.ts` with the shared one; draw arcs from `pairs` (one arc per pair) and keep the directed `routes` list only if the list should show direction.
2. Stop rebuilding period country counts from route endpoints (`mapVisits` in `panel.tsx`); use `projection.countries` (it already applies transit suppression and the C3 pending flag). Claims stay a Passport collection layer: merge the `claimed` flag from the Passport data as today.
3. Compare `projection.revision` / `publishedRevision` with the revision of the summary or Passport data being shown. On a mismatch, or when `countryState` is `updating`, show the existing updating state and refresh the summary instead of combining the two. Show a "showing the first N routes" note when `truncated`.
4. Pending ring: use `countries[].pending` (see issue 41).

## Left alone on purpose
The legacy `GET /api/flights/routes` (rollback consumer, `apps/web`) is unchanged: it is still unbounded, has no revision stamps and no default completed restriction.

## Acceptance check
Playwright or component test where the summary revision differs from the projection revision shows the updating state; a transit hub (see `functions/test/route-projection-contract.test.ts`) does not appear on the country layer; the arc count equals `routeCount` when `truncated` is false.

## Continuation disposition — 2026-10-05

8bca555 and 434e3fa consume the shared period/revision/country-count projection contract, server country visits and one canonical undirected pair. Stale/retry/abort/truncation/ground/claim cases have independent source and functional acceptance. Final current-build gates are tracked in the handoff; map timing/memory and visual proof remain deferred.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
