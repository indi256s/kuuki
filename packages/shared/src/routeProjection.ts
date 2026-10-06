// Contract of `GET /api/flights/route-projection?period=all|YYYY` (C6, opened map). Same owner scope, completed-period
// predicate, country policy and publication metadata as the Overview summary (`OverviewSummary`), so a client can
// compare `revision` / `publishedRevision` with the summary it already shows and say "updating" on a mismatch.
import type { OverviewMapCountry } from './overview'

/** A flight direction on one airport pair: the legacy shape of the opened map's list, kept for the existing call site. */
export interface ProjectedRoute {
  origin: string
  destination: string
  originCountry: string | null
  destinationCountry: string | null
  /** Completed flights from `origin` to `destination` in the period. */
  count: number
  lastDate: string
  /** [longitude, latitude] from the airport reference, or null when the airport is unknown. */
  from: [number, number] | null
  to: [number, number] | null
}

/**
 * One UNDIRECTED airport pair: the unit the Overview counts as a route (`map.routeCount`). `a` sorts before `b`.
 * `count` is every completed flight between the two airports in either direction (`count = forward + reverse`).
 */
export interface ProjectedPair {
  a: string
  b: string
  aCountry: string | null
  bCountry: string | null
  count: number
  /** Flights from `a` to `b`. */
  forward: number
  /** Flights from `b` to `a`. */
  reverse: number
  lastDate: string
  from: [number, number] | null
  to: [number, number] | null
}

export interface RouteProjection {
  schemaVersion: 1
  period: string
  ownerId: string
  /** Same stamps as the Overview summary read for the same account. */
  revision: number
  publishedRevision: number
  derivedState: 'ready' | 'pending' | 'error'
  /** `updating` while the published country evidence is stale; `countries` is then null (never a mixed figure). */
  countryState: 'ready' | 'updating'
  /** Distinct undirected airport pairs in the period, exact even when the lists below are truncated. Equals the summary's `map.routeCount`. */
  routeCount: number
  /** Maximum entries returned in each of `routes` and `pairs`. */
  limit: number
  /** True when `routeCount` or the directed route count exceeds `limit`; lists are the most recent first. */
  truncated: boolean
  /** Directed airport pairs (legacy shape used by the current client), newest first. */
  routes: ProjectedRoute[]
  /** Undirected airport pairs, newest first: the deduplicated geometry. */
  pairs: ProjectedPair[]
  /** Period countries after the published transit suppressions; the same set and visit counts as the summary's `map.countries`. Null while updating. */
  countries: OverviewMapCountry[] | null
}
