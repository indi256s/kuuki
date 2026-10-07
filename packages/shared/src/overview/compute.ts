import { coverage, figures, home, totals, type OverviewScope } from './figures'
import { matches, previousPeriod } from './filter'
import type { OverviewFilter, OverviewPayload } from './model'
import { records } from './records'

export function computeOverview(payload: OverviewPayload, filter: OverviewFilter): OverviewScope {
  const counted = payload.rows.filter(row => row.state === 'logged' || row.state === 'awaiting')
  const rows = counted.filter(row => matches(row, filter, payload.refs))
  const previous = previousPeriod(filter)
  const deltas = previous ? totals(counted.filter(row => matches(row, previous, payload.refs))) : null
  return { filter, figures: figures(rows, payload, filter, deltas), coverage: coverage(rows), home: home(counted, payload),
    records: records(rows, payload.refs, payload.mode) }
}
