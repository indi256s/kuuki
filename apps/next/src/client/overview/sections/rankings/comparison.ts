import { matches, previousPeriod } from '@kuuki/shared/overview/filter'
import type { OverviewFilter, OverviewPayload } from '@kuuki/shared/overview/model'
import { rankings } from '@kuuki/shared/overview/rankings'

export type AirlineComparison = { key: string; start: number; end: number }

export function airlineComparison(payload: OverviewPayload, filter: OverviewFilter): AirlineComparison[] | null {
  const previous = previousPeriod(filter)
  if (!previous || !payload.derivedReady) return null
  if (payload.mode === 'aggregate' && payload.aggregateResolution !== 'day' && filter.period && 'from' in filter.period && (filter.period.from.length === 10 || filter.period.to.length === 10)) return null
  const counted = payload.rows.filter(row => row.state === 'logged' || row.state === 'awaiting')
  const before = rankings(counted.filter(row => matches(row, previous, payload.refs))).airlines
  const after = rankings(counted.filter(row => matches(row, filter, payload.refs))).airlines
  const starts = new Map(before.map(row => [row.key, row.count]))
  const ends = new Map(after.map(row => [row.key, row.count]))
  return [...new Set([...starts.keys(), ...ends.keys()])].map(key => ({ key, start: starts.get(key) ?? 0, end: ends.get(key) ?? 0 }))
    .sort((a, b) => Math.max(b.start, b.end) - Math.max(a.start, a.end) || a.key.localeCompare(b.key))
}
