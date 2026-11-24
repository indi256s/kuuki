import type { OverviewMapCountry } from './overview'

export interface ProjectedRoute {
  origin: string
  destination: string
  originCountry: string | null
  destinationCountry: string | null
  count: number
  lastDate: string
  from: [number, number] | null
  to: [number, number] | null
}

export interface ProjectedPair {
  a: string
  b: string
  aCountry: string | null
  bCountry: string | null
  count: number
  forward: number
  reverse: number
  lastDate: string
  from: [number, number] | null
  to: [number, number] | null
}

export interface RouteProjection {
  schemaVersion: 1
  period: string
  ownerId: string
  revision: number
  publishedRevision: number
  derivedState: 'ready' | 'pending' | 'error'
  countryState: 'ready' | 'updating'
  routeCount: number
  limit: number
  truncated: boolean
  routes: ProjectedRoute[]
  pairs: ProjectedPair[]
  countries: OverviewMapCountry[] | null
}
